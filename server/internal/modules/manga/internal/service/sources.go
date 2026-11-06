package service

import (
	"context"
	"sort"
	"strconv"
	"strings"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/manga/internal/store"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

// SourceInfo is a place chapters can come from.
type SourceInfo struct {
	ID   string // "opds:3"
	Name string
	Kind string // "opds"
}

func (s *Service) Sources(ctx context.Context) ([]SourceInfo, error) {
	servers, err := s.store.Servers(ctx)
	if err != nil {
		return nil, err
	}

	sources := make([]SourceInfo, 0, len(servers))
	for _, server := range servers {
		sources = append(sources, SourceInfo{ID: sourceID(server.ID), Name: server.Name, Kind: "opds"})
	}

	plugins, err := s.pluginSources(ctx)
	if err != nil {
		return nil, err
	}

	return append(sources, plugins...), nil
}

type SeriesHit struct {
	ID    string
	Title string
	// Detail tells similar names apart, such as a year.
	Detail string
	// Matched is true when the source itself links the series to the title being
	// linked, by its AniList id.
	Matched bool
}

// Search finds series in one source, for the user to link a title to. mediaRef is
// the title being linked, when the source can say which result belongs to it.
func (s *Service) Search(ctx context.Context, source, query, mediaRef string) ([]SeriesHit, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, apperr.Invalid("q", "the search is empty")
	}

	if id, ok := pluginOf(source); ok {
		return s.searchPlugin(ctx, id, query, mediaRef)
	}

	serverID, ok := serverOf(source)
	if !ok {
		return nil, apperr.Invalid("source", "unknown source %q", source)
	}

	row, server, err := s.connection(ctx, serverID)
	if err != nil {
		return nil, err
	}

	series, err := s.opts.Client.Search(ctx, server, query)
	if err != nil {
		return nil, upstream(err, row.Name)
	}

	hits := make([]SeriesHit, 0, len(series))
	for _, item := range series {
		hits = append(hits, SeriesHit{ID: item.ID, Title: item.Title})
	}

	return hits, nil
}

type Link struct {
	Source      string
	SourceName  string
	SeriesID    string
	SeriesTitle string
	ChosenBy    string
}

func (s *Service) Links(ctx context.Context, mediaRef string) ([]Link, error) {
	rows, err := s.store.Links(ctx, mediaRef)
	if err != nil {
		return nil, err
	}

	names, err := s.sourceNames(ctx)
	if err != nil {
		return nil, err
	}

	links := make([]Link, 0, len(rows))
	for _, row := range rows {
		links = append(links, Link{
			Source:      row.Source,
			SourceName:  names[row.Source],
			SeriesID:    row.SeriesID,
			SeriesTitle: row.SeriesTitle,
			ChosenBy:    row.ChosenBy,
		})
	}

	return links, nil
}

// SetLink records the user's choice of series. A choice the user made is never
// overwritten by a guess.
func (s *Service) SetLink(ctx context.Context, mediaRef, source, seriesID, seriesTitle string) error {
	if strings.TrimSpace(mediaRef) == "" {
		return apperr.Invalid("media_ref", "the title is missing")
	}

	if id, ok := pluginOf(source); ok {
		if !pluginIDOK(seriesID) {
			return apperr.Invalid("series_id", "a series is named by its id in the plugin, as the search returns it")
		}
		if _, err := s.provider(ctx, id); err != nil {
			return err
		}

		return s.putLink(ctx, mediaRef, source, seriesID, seriesTitle)
	}

	if !strings.HasPrefix(seriesID, "/") {
		return apperr.Invalid("series_id", "a series is named by its path on the server, as the search returns it")
	}

	serverID, ok := serverOf(source)
	if !ok {
		return apperr.Invalid("source", "unknown source %q", source)
	}
	if row, err := s.store.Server(ctx, serverID); err != nil {
		return err
	} else if row == nil {
		return apperr.New(apperr.KindNotFound, "OPDS server %d does not exist", serverID)
	}

	return s.putLink(ctx, mediaRef, source, seriesID, seriesTitle)
}

func (s *Service) putLink(ctx context.Context, mediaRef, source, seriesID, seriesTitle string) error {
	return s.store.PutLink(ctx, store.Link{
		MediaRef:    mediaRef,
		Source:      source,
		SeriesID:    seriesID,
		SeriesTitle: strings.TrimSpace(seriesTitle),
		ChosenBy:    "user",
		CreatedAt:   s.opts.Now(),
	})
}

func (s *Service) DeleteLink(ctx context.Context, mediaRef, source string) error {
	deleted, err := s.store.DeleteLink(ctx, mediaRef, source)
	if err != nil {
		return err
	}
	if !deleted {
		return apperr.New(apperr.KindNotFound, "%s is not linked to %s", mediaRef, source)
	}

	return nil
}

// ChapterInfo is one chapter a source holds for a title.
type ChapterInfo struct {
	Ref        string
	Source     string
	SourceName string
	Number     string
	Title      string
	Pages      int
	// Language and Groups credit who translated it, where the source says.
	Language string
	Groups   []string
	// ExternalURL is the publisher's page for a chapter the source only links to.
	ExternalURL string
}

// SourceProblem is a linked source that could not be read; the others still are.
type SourceProblem struct {
	Source     string
	SourceName string
	Detail     string
}

// Chapters lists what every linked source holds for a title, in chapter order.
// A source that fails is reported next to the others rather than failing them.
func (s *Service) Chapters(ctx context.Context, mediaRef string) ([]ChapterInfo, []SourceProblem, error) {
	links, err := s.store.Links(ctx, mediaRef)
	if err != nil {
		return nil, nil, err
	}

	chapters := []ChapterInfo{}
	problems := []SourceProblem{}

	for _, link := range links {
		if _, ok := pluginOf(link.Source); ok {
			found, err := s.pluginChapters(ctx, link.Source, link.SeriesID)
			if err != nil {
				if ctx.Err() != nil {
					return nil, nil, ctx.Err()
				}
				problems = append(problems, SourceProblem{Source: link.Source, SourceName: s.pluginName(ctx, link.Source), Detail: err.Error()})

				continue
			}

			chapters = append(chapters, found...)

			continue
		}

		serverID, ok := serverOf(link.Source)
		if !ok {
			continue
		}

		row, server, err := s.connection(ctx, serverID)
		if err != nil {
			problems = append(problems, SourceProblem{Source: link.Source, Detail: err.Error()})
			continue
		}

		books, err := s.opts.Client.Books(ctx, server, link.SeriesID)
		if err != nil {
			if ctx.Err() != nil {
				return nil, nil, ctx.Err()
			}
			problems = append(problems, SourceProblem{Source: link.Source, SourceName: row.Name, Detail: err.Error()})
			continue
		}

		for _, book := range books {
			// A book the server cannot stream page by page is not one the reader
			// can open yet.
			if book.PageTemplate == "" {
				continue
			}

			key, err := encodeKey(chapterKey{
				Series:   link.SeriesID,
				Template: book.PageTemplate,
				Pages:    book.Pages,
				Title:    book.Title,
				Number:   book.Number,
				Archive:  book.Archive,
			})
			if err != nil {
				return nil, nil, err
			}

			chapters = append(chapters, ChapterInfo{
				Ref:        "opds:" + strconv.FormatInt(serverID, 10) + ":" + key,
				Source:     link.Source,
				SourceName: row.Name,
				Number:     book.Number,
				Title:      book.Title,
				Pages:      book.Pages,
			})
		}
	}

	sortChapters(chapters)

	return chapters, problems, nil
}

// sortChapters puts numbered chapters in number order and unnumbered ones last,
// keeping a source's own order among equals.
func sortChapters(chapters []ChapterInfo) {
	number := func(c ChapterInfo) (float64, bool) {
		value, err := strconv.ParseFloat(c.Number, 64)
		return value, err == nil
	}

	sort.SliceStable(chapters, func(i, j int) bool {
		a, aok := number(chapters[i])
		b, bok := number(chapters[j])

		switch {
		case aok && bok:
			return a < b
		default:
			return aok && !bok
		}
	})
}

func (s *Service) sourceNames(ctx context.Context) (map[string]string, error) {
	sources, err := s.Sources(ctx)
	if err != nil {
		return nil, err
	}

	names := make(map[string]string, len(sources))
	for _, source := range sources {
		names[source.ID] = source.Name
	}

	return names, nil
}
