package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// SourcePrefixPlugin starts a manga plugin's source id: "plugin:<id>".
const SourcePrefixPlugin = "plugin:"

const (
	// A site's ids go back to it as they came; they only have to fit.
	maxPluginID = 512
	// How long a plugin's chapter list and a chapter's pages are reused: the
	// reader asks for every page, and each would otherwise run the plugin.
	pluginChaptersTTL = 10 * time.Minute
	pluginPagesTTL    = 15 * time.Minute
)

// Plugins are the user's manga plugins, joined in internal/app: this module does
// not know the extension module, only what it asks of it.
type Plugins interface {
	MangaProviders(ctx context.Context) ([]PluginProvider, error)
	MangaSearch(ctx context.Context, id, query string, titles []string, anilistID int) ([]PluginSeries, error)
	MangaChapters(ctx context.Context, id, seriesID string) ([]PluginChapter, error)
	MangaPages(ctx context.Context, id, chapterID string) ([]PluginPage, error)
	FetchImage(ctx context.Context, id string, page PluginPage) (data []byte, contentType string, err error)
}

// PluginProvider is a manga plugin that is on.
type PluginProvider struct {
	ID   string
	Name string
	// Revision changes with the plugin's code or settings.
	Revision string
}

type PluginSeries struct {
	ID     string
	Title  string
	Detail string
}

type PluginChapter struct {
	ID       string
	Number   string
	Title    string
	Volume   string
	Language string
	Groups   []string
}

type PluginPage struct {
	URL     string
	Referer string
}

// pluginKey is what the node needs to open a plugin's chapter again: the
// chapter for its pages, the series for the title it belongs to.
type pluginKey struct {
	Series  string `json:"s"`
	Chapter string `json:"c"`
	Number  string `json:"n,omitempty"`
}

func encodePluginKey(key pluginKey) (string, error) {
	data, err := json.Marshal(key)
	if err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(data), nil
}

func decodePluginKey(raw string) (pluginKey, error) {
	invalid := apperr.Invalid("ref", "not a chapter reference this node wrote")

	data, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return pluginKey{}, invalid
	}

	var key pluginKey
	if err := json.Unmarshal(data, &key); err != nil || !pluginIDOK(key.Series) || !pluginIDOK(key.Chapter) {
		return pluginKey{}, invalid
	}

	return key, nil
}

func pluginIDOK(id string) bool {
	return id != "" && len(id) <= maxPluginID && strings.IndexFunc(id, unicode.IsControl) < 0
}

// pluginOf reads "plugin:<id>"; ok is false for any other source.
func pluginOf(source string) (id string, ok bool) {
	id, ok = strings.CutPrefix(source, SourcePrefixPlugin)
	return id, ok && id != ""
}

// provider is the manga plugin with this id, if it is on.
func (s *Service) provider(ctx context.Context, id string) (*PluginProvider, error) {
	if s.opts.Plugins == nil {
		return nil, apperr.New(apperr.KindUnavailable, "plugins do not run on this node")
	}

	providers, err := s.opts.Plugins.MangaProviders(ctx)
	if err != nil {
		return nil, err
	}

	for i := range providers {
		if providers[i].ID == id {
			return &providers[i], nil
		}
	}

	return nil, apperr.New(apperr.KindNotFound, "no manga plugin %q is on", id)
}

// pluginName is how the user knows a linked plugin, or its id when it is off.
func (s *Service) pluginName(ctx context.Context, source string) string {
	id, _ := pluginOf(source)
	if p, err := s.provider(ctx, id); err == nil {
		return p.Name
	}

	return id
}

func (s *Service) pluginSources(ctx context.Context) ([]SourceInfo, error) {
	if s.opts.Plugins == nil {
		return nil, nil
	}

	providers, err := s.opts.Plugins.MangaProviders(ctx)
	if err != nil {
		return nil, err
	}

	sources := make([]SourceInfo, 0, len(providers))
	for _, p := range providers {
		sources = append(sources, SourceInfo{ID: SourcePrefixPlugin + p.ID, Name: p.Name, Kind: "plugin"})
	}

	return sources, nil
}

func (s *Service) searchPlugin(ctx context.Context, id, query, mediaRef string) ([]SeriesHit, error) {
	p, err := s.provider(ctx, id)
	if err != nil {
		return nil, err
	}

	anilistID := 0
	if raw, ok := strings.CutPrefix(mediaRef, "anilist:"); ok {
		anilistID, _ = strconv.Atoi(raw)
	}

	series, err := s.opts.Plugins.MangaSearch(ctx, p.ID, query, []string{query}, anilistID)
	if err != nil {
		return nil, pluginError(err, p.Name)
	}

	hits := make([]SeriesHit, 0, len(series))
	for _, item := range series {
		hits = append(hits, SeriesHit{ID: item.ID, Title: item.Title, Detail: item.Detail})
	}

	return hits, nil
}

func (s *Service) pluginChapters(ctx context.Context, source, seriesID string) ([]ChapterInfo, error) {
	id, _ := pluginOf(source)

	p, err := s.provider(ctx, id)
	if err != nil {
		return nil, err
	}

	found, err := s.plugins.chapters(ctx, p, seriesID, func() ([]PluginChapter, error) {
		return s.opts.Plugins.MangaChapters(ctx, p.ID, seriesID)
	}, s.opts.Now())
	if err != nil {
		return nil, pluginError(err, p.Name)
	}

	chapters := make([]ChapterInfo, 0, len(found))
	for _, c := range found {
		key, err := encodePluginKey(pluginKey{Series: seriesID, Chapter: c.ID, Number: c.Number})
		if err != nil {
			return nil, err
		}

		chapters = append(chapters, ChapterInfo{
			Ref:        "plugin:" + p.ID + ":" + key,
			Source:     source,
			SourceName: p.Name,
			Number:     c.Number,
			Title:      c.Title,
			Language:   c.Language,
			Groups:     c.Groups,
		})
	}

	return chapters, nil
}

// PluginChapter describes a plugin's chapter for the reader. Its title is the
// one the user linked, so progress goes where they pointed it.
func (s *Service) PluginChapter(ctx context.Context, id, rawKey string) (*ReadChapter, error) {
	key, err := decodePluginKey(rawKey)
	if err != nil {
		return nil, err
	}

	p, pages, err := s.pluginPages(ctx, id, key.Chapter)
	if err != nil {
		return nil, err
	}

	out := &ReadChapter{Number: key.Number, Pages: len(pages), SourceName: p.Name}

	link, err := s.store.LinkBySeries(ctx, SourcePrefixPlugin+id, key.Series)
	if err != nil {
		return nil, err
	}
	if link != nil {
		out.MediaRef = link.MediaRef
		out.Title = link.SeriesTitle
	}

	return out, nil
}

// PluginPage fetches one page through the node, from the plugin's own hosts.
func (s *Service) PluginPage(ctx context.Context, id, rawKey string, index int) (data []byte, contentType string, err error) {
	key, err := decodePluginKey(rawKey)
	if err != nil {
		return nil, "", err
	}

	p, pages, err := s.pluginPages(ctx, id, key.Chapter)
	if err != nil {
		return nil, "", err
	}
	if index < 0 || index >= len(pages) {
		return nil, "", apperr.New(apperr.KindNotFound, "the chapter has no page %d", index)
	}

	data, contentType, err = s.opts.Plugins.FetchImage(ctx, p.ID, pages[index])
	if err != nil {
		return nil, "", pluginError(err, p.Name)
	}

	return data, contentType, nil
}

func (s *Service) pluginPages(ctx context.Context, id, chapterID string) (*PluginProvider, []PluginPage, error) {
	p, err := s.provider(ctx, id)
	if err != nil {
		return nil, nil, err
	}

	pages, err := s.plugins.pages(ctx, p, chapterID, func() ([]PluginPage, error) {
		return s.opts.Plugins.MangaPages(ctx, p.ID, chapterID)
	}, s.opts.Now())
	if err != nil {
		return nil, nil, pluginError(err, p.Name)
	}

	return p, pages, nil
}

// pluginError keeps a plugin's own words and names the plugin: the user knows
// it by its name, and a site that changed is the plugin's to fix.
func pluginError(err error, name string) error {
	if kind := apperr.KindOf(err); kind == apperr.KindNotFound || kind == apperr.KindPrecondition || kind == apperr.KindUnavailable {
		return err
	}

	return apperr.Wrap(err, apperr.KindUpstream, "%s: %v", name, err)
}

// pluginCache keeps a plugin's chapter lists and pages a little while, under
// the plugin's revision: other code or settings answer anew.
type pluginCache struct {
	mu           sync.Mutex
	chapterLists map[string]cachedPluginChapters
	pageLists    map[string]cachedPluginPages
}

type cachedPluginChapters struct {
	chapters []PluginChapter
	at       time.Time
}

type cachedPluginPages struct {
	pages []PluginPage
	at    time.Time
}

func newPluginCache() *pluginCache {
	return &pluginCache{chapterLists: map[string]cachedPluginChapters{}, pageLists: map[string]cachedPluginPages{}}
}

func (c *pluginCache) chapters(_ context.Context, p *PluginProvider, seriesID string, fetch func() ([]PluginChapter, error), now time.Time) ([]PluginChapter, error) {
	key := p.ID + "\x00" + p.Revision + "\x00" + seriesID

	c.mu.Lock()
	cached, ok := c.chapterLists[key]
	c.mu.Unlock()
	if ok && now.Sub(cached.at) < pluginChaptersTTL {
		return cached.chapters, nil
	}

	found, err := fetch()
	if err != nil {
		return nil, err
	}

	c.mu.Lock()
	for k, old := range c.chapterLists {
		if now.Sub(old.at) >= pluginChaptersTTL {
			delete(c.chapterLists, k)
		}
	}
	c.chapterLists[key] = cachedPluginChapters{chapters: found, at: now}
	c.mu.Unlock()

	return found, nil
}

func (c *pluginCache) pages(_ context.Context, p *PluginProvider, chapterID string, fetch func() ([]PluginPage, error), now time.Time) ([]PluginPage, error) {
	key := p.ID + "\x00" + p.Revision + "\x00" + chapterID

	c.mu.Lock()
	cached, ok := c.pageLists[key]
	c.mu.Unlock()
	if ok && now.Sub(cached.at) < pluginPagesTTL {
		return cached.pages, nil
	}

	found, err := fetch()
	if err != nil {
		return nil, err
	}

	c.mu.Lock()
	for k, old := range c.pageLists {
		if now.Sub(old.at) >= pluginPagesTTL {
			delete(c.pageLists, k)
		}
	}
	c.pageLists[key] = cachedPluginPages{pages: found, at: now}
	c.mu.Unlock()

	return found, nil
}
