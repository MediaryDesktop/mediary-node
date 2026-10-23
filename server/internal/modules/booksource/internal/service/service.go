// Package service searches the sources of free copies of books and turns a copy
// the user picked into a download.
package service

import (
	"context"
	"errors"
	"io"
	"strings"
	"sync"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/download"
	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/source"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

const (
	// How long a search waits for the slowest source.
	searchTimeout = 20 * time.Second
	// How long a copy found by a search can still be downloaded by its reference.
	editionTTL = 30 * time.Minute
)

// Works names a book by its media reference, from what the node knows of it:
// the book page it was opened on. Wired by internal/app.
type Works interface {
	// Work returns nil when the node does not know the book.
	Work(ctx context.Context, mediaRef string) (*Work, error)
}

type Work struct {
	Title   string
	Authors []string
}

// Sources are the sources on now: one the user turned off is not searched, and
// a download from it fails.
type Sources func(ctx context.Context) []source.Source

type Options struct {
	Sources Sources
	Works   Works
	Now     func() time.Time
}

type Service struct {
	sources Sources
	works   Works
	now     func() time.Time

	mu       sync.Mutex
	editions map[string]cachedEdition
}

type cachedEdition struct {
	edition source.Edition
	at      time.Time
}

func New(opts Options) *Service {
	if opts.Now == nil {
		opts.Now = time.Now
	}

	return &Service{
		sources:  opts.Sources,
		works:    opts.Works,
		now:      opts.Now,
		editions: map[string]cachedEdition{},
	}
}

// SourceInfo is a source the node searches.
type SourceInfo struct {
	ID   string
	Name string
}

func (s *Service) Sources(ctx context.Context) []SourceInfo {
	sources := s.sources(ctx)

	out := make([]SourceInfo, 0, len(sources))
	for _, src := range sources {
		out = append(out, SourceInfo{ID: src.ID(), Name: src.Name()})
	}

	return out
}

// SourceOutcome is how one source answered a search.
type SourceOutcome struct {
	ID      string
	Name    string
	Results int
	Error   string
}

type SearchResult struct {
	Editions []source.Edition
	Sources  []SourceOutcome
}

// Search looks for copies of a book in every source at once: the book with
// mediaRef when the search starts on its page, or the text typed. A source
// that fails says why beside the others' results.
func (s *Service) Search(ctx context.Context, mediaRef, text string) (*SearchResult, error) {
	query := source.Query{Text: strings.TrimSpace(text)}

	if mediaRef = strings.TrimSpace(mediaRef); mediaRef != "" {
		work, err := s.works.Work(ctx, mediaRef)
		if err != nil {
			// The media module already says what went wrong: "Open Library has no
			// such book" is a 404 the user can act on, not a failed upstream.
			var appErr *apperr.Error
			if errors.As(err, &appErr) {
				return nil, err
			}

			return nil, apperr.Wrap(err, apperr.KindUpstream, "read the book %s", mediaRef)
		}
		if work == nil || strings.TrimSpace(work.Title) == "" {
			return nil, apperr.New(apperr.KindPrecondition, "the node does not know the book %s yet; open its page first", mediaRef)
		}

		query.Title, query.Authors = work.Title, work.Authors
	}

	if query.Text == "" && query.Title == "" {
		return nil, apperr.Invalid("q", "give the text to search for, or a book")
	}

	sources := s.sources(ctx)

	result := &SearchResult{
		Editions: []source.Edition{},
		Sources:  make([]SourceOutcome, len(sources)),
	}
	found := make([][]source.Edition, len(sources))

	searchCtx, cancel := context.WithTimeout(ctx, searchTimeout)
	defer cancel()

	var wg sync.WaitGroup
	for i, src := range sources {
		result.Sources[i] = SourceOutcome{ID: src.ID(), Name: src.Name()}

		wg.Add(1)
		go func() {
			defer wg.Done()

			editions, err := src.Search(searchCtx, query)
			if err != nil {
				result.Sources[i].Error = messageOf(err)
				return
			}

			found[i] = usable(editions, src.Name())
			result.Sources[i].Results = len(found[i])
		}()
	}
	wg.Wait()

	now := s.now()

	s.mu.Lock()
	defer s.mu.Unlock()

	for ref := range s.editions {
		if now.Sub(s.editions[ref].at) > editionTTL {
			delete(s.editions, ref)
		}
	}

	for _, editions := range found {
		for i := range editions {
			s.editions[editions[i].Ref] = cachedEdition{edition: editions[i], at: now}
			result.Editions = append(result.Editions, editions[i])
		}
	}

	return result, nil
}

// usable keeps the formats the library can hold, and the editions left with
// one. A source names itself on every edition it returns.
func usable(editions []source.Edition, sourceName string) []source.Edition {
	out := make([]source.Edition, 0, len(editions))

	for i := range editions {
		edition := editions[i]
		edition.Source = sourceName

		formats := make([]source.Format, 0, len(edition.Formats))
		for _, format := range edition.Formats {
			if download.Extensions[format.Ext] {
				formats = append(formats, format)
			}
		}
		edition.Formats = formats

		if len(formats) > 0 && edition.Ref != "" {
			out = append(out, edition)
		}
	}

	return out
}

// Prepare turns a copy a search found into a book to queue. The client names
// the copy and its format; where the file comes from is what the source said in
// that search, never what the client sends.
func (s *Service) Prepare(editionRef, formatType, mediaRef string) (download.NewBook, error) {
	mediaRef = strings.TrimSpace(mediaRef)
	if provider, id, ok := strings.Cut(mediaRef, ":"); !ok || provider == "" || id == "" {
		return download.NewBook{}, apperr.Invalid("media_ref", "a media reference looks like provider:id, got %q", mediaRef)
	}

	s.mu.Lock()
	cached, ok := s.editions[editionRef]
	s.mu.Unlock()

	if !ok || s.now().Sub(cached.at) > editionTTL {
		return download.NewBook{}, apperr.New(apperr.KindPrecondition, "search for the book again: the copy %s was not found in the last %v", editionRef, editionTTL)
	}

	edition := cached.edition
	for _, format := range edition.Formats {
		if format.Type != formatType {
			continue
		}

		return download.NewBook{
			EditionRef: edition.Ref,
			Format:     format.Type,
			Ext:        format.Ext,
			Location:   format.Location,
			MediaRef:   mediaRef,
			Title:      edition.Title,
			Authors:    strings.Join(edition.Authors, ", "),
			SourceName: edition.Source,
			Size:       format.Size,
		}, nil
	}

	return download.NewBook{}, apperr.Invalid("format", "the copy %s does not come as %s", editionRef, formatType)
}

// Open fetches a file for the download queue from the source the reference
// belongs to.
func (s *Service) Open(ctx context.Context, ref, location string) (io.ReadCloser, error) {
	id := source.SourceOf(ref)

	for _, src := range s.sources(ctx) {
		if src.ID() == id {
			return src.Open(ctx, ref, location)
		}
	}

	return nil, apperr.New(apperr.KindPrecondition, "the source of %s is turned off or no longer set up", ref)
}

// messageOf is what a source's failure says to the user: an apperr's own
// message without its kind, or the error as it is.
func messageOf(err error) string {
	var appErr *apperr.Error
	if errors.As(err, &appErr) {
		return appErr.Message
	}

	return err.Error()
}
