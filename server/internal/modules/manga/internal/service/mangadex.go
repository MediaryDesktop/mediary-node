package service

import (
	"context"
	"errors"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/mangadex"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

const (
	SourceMangaDex = "mangadex"
	mangaDexName   = "MangaDex"

	mangaDexEnabledKey   = "mangadex.enabled"
	mangaDexLanguagesKey = "mangadex.languages"

	// A chapter list or a chapter's page server is reused this long. The page
	// server is promised for fifteen minutes; asking again sooner stays inside the
	// forty-a-minute limit while a reader turns pages.
	mangaDexCacheFor = 10 * time.Minute
	maxLanguages     = 10
)

var (
	uuidPattern     = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
	languagePattern = regexp.MustCompile(`^[a-z]{2,3}(-[a-z0-9]{2,8})?$`)
)

// MangaDexSettings is whether the user reads from MangaDex, and in which
// languages, in order of preference.
type MangaDexSettings struct {
	Available bool
	Enabled   bool
	Languages []string
}

func (s *Service) MangaDexSettings(ctx context.Context) (*MangaDexSettings, error) {
	settings := &MangaDexSettings{Available: s.opts.MangaDex != nil, Languages: []string{"en"}}

	enabled, _, err := s.store.Meta(ctx, mangaDexEnabledKey)
	if err != nil {
		return nil, err
	}
	settings.Enabled = settings.Available && enabled == "1"

	languages, found, err := s.store.Meta(ctx, mangaDexLanguagesKey)
	if err != nil {
		return nil, err
	}
	if found && languages != "" {
		settings.Languages = strings.Split(languages, ",")
	}

	return settings, nil
}

func (s *Service) SetMangaDexSettings(ctx context.Context, enabled bool, languages []string) (*MangaDexSettings, error) {
	if enabled && s.opts.MangaDex == nil {
		return nil, apperr.New(apperr.KindPrecondition, "MangaDex is turned off on this node")
	}

	clean := make([]string, 0, len(languages))
	seen := map[string]bool{}
	for _, language := range languages {
		language = strings.ToLower(strings.TrimSpace(language))
		if !languagePattern.MatchString(language) {
			return nil, apperr.Invalid("languages", "%q is not a language code such as en or pt-br", language)
		}
		if !seen[language] {
			seen[language] = true
			clean = append(clean, language)
		}
	}
	if len(clean) == 0 {
		return nil, apperr.Invalid("languages", "choose at least one language")
	}
	if len(clean) > maxLanguages {
		return nil, apperr.Invalid("languages", "choose at most %d languages", maxLanguages)
	}

	flag := "0"
	if enabled {
		flag = "1"
	}
	if err := s.store.SetMeta(ctx, mangaDexEnabledKey, flag); err != nil {
		return nil, err
	}
	if err := s.store.SetMeta(ctx, mangaDexLanguagesKey, strings.Join(clean, ",")); err != nil {
		return nil, err
	}

	s.dex.clearFeeds()

	return s.MangaDexSettings(ctx)
}

// mangaDexReady is the client when the user has turned MangaDex on.
func (s *Service) mangaDexReady(ctx context.Context) (*mangadex.Client, *MangaDexSettings, error) {
	settings, err := s.MangaDexSettings(ctx)
	if err != nil {
		return nil, nil, err
	}
	if !settings.Enabled {
		return nil, nil, apperr.New(apperr.KindPrecondition, "MangaDex is turned off; turn it on in the settings")
	}

	return s.opts.MangaDex, settings, nil
}

func (s *Service) searchMangaDex(ctx context.Context, query, mediaRef string) ([]SeriesHit, error) {
	client, _, err := s.mangaDexReady(ctx)
	if err != nil {
		return nil, err
	}

	found, err := client.Search(ctx, query)
	if err != nil {
		return nil, dexError(err)
	}

	aniListID, _ := strings.CutPrefix(mediaRef, "anilist:")

	hits := make([]SeriesHit, 0, len(found))
	for _, manga := range found {
		hit := SeriesHit{ID: manga.ID, Title: manga.Title, Matched: aniListID != "" && manga.AniListID == aniListID}
		if manga.Year > 0 {
			hit.Detail = strconv.Itoa(manga.Year)
		}
		hits = append(hits, hit)
	}

	// The series MangaDex itself links to this AniList title goes first.
	sort.SliceStable(hits, func(i, j int) bool { return hits[i].Matched && !hits[j].Matched })

	return hits, nil
}

// mangaDexChapters lists a linked series in the user's languages, the preferred
// language first among copies of the same chapter.
func (s *Service) mangaDexChapters(ctx context.Context, seriesID, seriesTitle string) ([]ChapterInfo, error) {
	client, settings, err := s.mangaDexReady(ctx)
	if err != nil {
		return nil, err
	}

	key := seriesID + "|" + strings.Join(settings.Languages, ",")

	feed, ok := s.dex.feed(key)
	if !ok {
		if feed, err = client.Feed(ctx, seriesID, settings.Languages); err != nil {
			return nil, dexError(err)
		}
		s.dex.putFeed(key, feed)
	}

	preference := map[string]int{}
	for i, language := range settings.Languages {
		preference[language] = i
	}

	ordered := append([]mangadex.Chapter(nil), feed...)
	sort.SliceStable(ordered, func(i, j int) bool {
		return preference[ordered[i].Language] < preference[ordered[j].Language]
	})

	chapters := make([]ChapterInfo, 0, len(ordered))
	for i := range ordered {
		chapter := &ordered[i]
		info := ChapterInfo{
			Ref:        SourceMangaDex + ":" + chapter.ID,
			Source:     SourceMangaDex,
			SourceName: mangaDexName,
			Number:     chapter.Number,
			Title:      chapter.Title,
			Pages:      chapter.Pages,
			Language:   chapter.Language,
			Groups:     chapter.Groups,
		}
		if info.Title == "" {
			info.Title = seriesTitle
		}
		if chapter.ExternalURL != "" && chapter.Pages == 0 {
			info.ExternalURL = chapter.ExternalURL
		}

		chapters = append(chapters, info)
	}

	return chapters, nil
}

// MangaDexChapter describes a chapter for the reader. Its title is the one the
// user linked, so progress goes where they pointed it.
func (s *Service) MangaDexChapter(ctx context.Context, chapterID string) (*ReadChapter, error) {
	chapter, err := s.dexChapter(ctx, chapterID)
	if err != nil {
		return nil, err
	}

	if chapter.ExternalURL != "" && chapter.Pages == 0 {
		return nil, apperr.New(apperr.KindPrecondition, "this chapter is on the publisher's site: %s", chapter.ExternalURL)
	}

	out := &ReadChapter{
		Title:      chapter.Title,
		Number:     chapter.Number,
		Pages:      chapter.Pages,
		SourceName: mangaDexName,
		Groups:     chapter.Groups,
	}

	link, err := s.store.LinkBySeries(ctx, SourceMangaDex, chapter.MangaID)
	if err != nil {
		return nil, err
	}
	if link != nil {
		out.MediaRef = link.MediaRef
		if link.SeriesTitle != "" {
			out.Title = link.SeriesTitle
		}
	}

	return out, nil
}

// MangaDexPage fetches a page through the node: MangaDex serves no image to a page
// that links to it directly. A page server that fails is reported by the client,
// and the chapter asks MangaDex for another once.
func (s *Service) MangaDexPage(ctx context.Context, chapterID string, index int) (data []byte, contentType string, err error) {
	client, _, err := s.mangaDexReady(ctx)
	if err != nil {
		return nil, "", err
	}

	for attempt := range 2 {
		home, ok := s.dex.atHome(chapterID)
		if !ok || attempt > 0 {
			if home, err = client.AtHome(ctx, chapterID); err != nil {
				return nil, "", dexError(err)
			}
			s.dex.putAtHome(chapterID, home)
		}

		data, contentType, err = client.Image(ctx, home, index)
		if err == nil {
			return data, contentType, nil
		}
		if errors.Is(err, mangadex.ErrNotFound) {
			return nil, "", apperr.New(apperr.KindNotFound, "the chapter has no page %d", index)
		}

		s.dex.dropAtHome(chapterID)
	}

	return nil, "", dexError(err)
}

func (s *Service) dexChapter(ctx context.Context, chapterID string) (*mangadex.Chapter, error) {
	if !uuidPattern.MatchString(chapterID) {
		return nil, apperr.Invalid("ref", "%q is not a MangaDex chapter", chapterID)
	}

	client, _, err := s.mangaDexReady(ctx)
	if err != nil {
		return nil, err
	}

	if chapter, ok := s.dex.chapter(chapterID); ok {
		return chapter, nil
	}

	chapter, err := client.Chapter(ctx, chapterID)
	if err != nil {
		return nil, dexError(err)
	}
	s.dex.putChapter(chapterID, chapter)

	return chapter, nil
}

func dexError(err error) error {
	switch {
	case errors.Is(err, context.Canceled):
		return err
	case errors.Is(err, mangadex.ErrNotFound):
		return apperr.Wrap(err, apperr.KindNotFound, "MangaDex has no such chapter or series")
	default:
		return apperr.Wrap(err, apperr.KindUpstream, "MangaDex: %s", err.Error())
	}
}

// dexCache keeps what MangaDex said for a few minutes: the reader asks for a
// chapter's description and its page server with every page turn.
type dexCache struct {
	mu       sync.Mutex
	feeds    map[string]cached[[]mangadex.Chapter]
	chapters map[string]cached[*mangadex.Chapter]
	homes    map[string]cached[*mangadex.AtHome]
}

type cached[T any] struct {
	value   T
	expires time.Time
}

func newDexCache() *dexCache {
	return &dexCache{
		feeds:    map[string]cached[[]mangadex.Chapter]{},
		chapters: map[string]cached[*mangadex.Chapter]{},
		homes:    map[string]cached[*mangadex.AtHome]{},
	}
}

func lookup[T any](mu *sync.Mutex, entries map[string]cached[T], key string) (T, bool) {
	mu.Lock()
	defer mu.Unlock()

	entry, ok := entries[key]
	if !ok || time.Now().After(entry.expires) {
		delete(entries, key)

		var zero T

		return zero, false
	}

	return entry.value, true
}

func remember[T any](mu *sync.Mutex, entries map[string]cached[T], key string, value T) {
	mu.Lock()
	defer mu.Unlock()

	entries[key] = cached[T]{value: value, expires: time.Now().Add(mangaDexCacheFor)}
}

func (c *dexCache) feed(key string) ([]mangadex.Chapter, bool)  { return lookup(&c.mu, c.feeds, key) }
func (c *dexCache) putFeed(key string, v []mangadex.Chapter)    { remember(&c.mu, c.feeds, key, v) }
func (c *dexCache) chapter(id string) (*mangadex.Chapter, bool) { return lookup(&c.mu, c.chapters, id) }

func (c *dexCache) putChapter(id string, v *mangadex.Chapter) { remember(&c.mu, c.chapters, id, v) }

func (c *dexCache) atHome(id string) (*mangadex.AtHome, bool) { return lookup(&c.mu, c.homes, id) }
func (c *dexCache) putAtHome(id string, v *mangadex.AtHome)   { remember(&c.mu, c.homes, id, v) }

func (c *dexCache) dropAtHome(id string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	delete(c.homes, id)
}

func (c *dexCache) clearFeeds() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.feeds = map[string]cached[[]mangadex.Chapter]{}
}
