package service

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// fakePlugins stands in for the extension module: one manga plugin that answers
// what a test sets and counts what it was asked.
type fakePlugins struct {
	mu        sync.Mutex
	providers []PluginProvider
	series    []PluginSeries
	chapters  []PluginChapter
	pages     []PluginPage
	err       error
	asked     map[string]int
	fetched   []PluginPage
}

func newFakePlugins() *fakePlugins {
	return &fakePlugins{
		providers: []PluginProvider{{ID: "comics", Name: "Comics", Revision: "r1"}},
		series:    []PluginSeries{{ID: "frieren/1", Title: "Sousou no Frieren", Detail: "2020"}},
		chapters: []PluginChapter{
			{ID: "c:2", Number: "2", Title: "Two", Language: "en", Groups: []string{"Scans"}},
			{ID: "c:1", Number: "1", Title: "One", Language: "en"},
			{ID: "c:extra", Number: "", Title: "Extra"},
		},
		pages: []PluginPage{{URL: "https://img.comics.example.org/1.png", Referer: "https://comics.example.org/"}, {URL: "https://img.comics.example.org/2.png"}},
		asked: map[string]int{},
	}
}

func (f *fakePlugins) count(what string) int {
	f.mu.Lock()
	defer f.mu.Unlock()

	return f.asked[what]
}

func (f *fakePlugins) MangaProviders(context.Context) ([]PluginProvider, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	return f.providers, nil
}

func (f *fakePlugins) MangaSearch(_ context.Context, id, query string, titles []string, anilistID int) ([]PluginSeries, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.asked["search "+id+" "+query+" "+strings.Join(titles, "|")+" "+strconv.Itoa(anilistID)]++

	return f.series, f.err
}

func (f *fakePlugins) MangaChapters(_ context.Context, _, seriesID string) ([]PluginChapter, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.asked["chapters "+seriesID]++

	return f.chapters, f.err
}

func (f *fakePlugins) MangaPages(_ context.Context, _, chapterID string) ([]PluginPage, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.asked["pages "+chapterID]++

	return f.pages, f.err
}

func (f *fakePlugins) FetchImage(_ context.Context, _ string, page PluginPage) (data []byte, contentType string, err error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.fetched = append(f.fetched, page)

	return []byte("image of " + page.URL), "image/png", nil
}

func withPlugins(t *testing.T) (*harness, *fakePlugins, *time.Time) {
	t.Helper()

	h := newHarness(t)
	plugins := newFakePlugins()
	now := time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC)
	h.svc.opts.Plugins = plugins
	h.svc.opts.Now = func() time.Time { return now }

	return h, plugins, &now
}

func TestAMangaPluginIsASource(t *testing.T) {
	h, plugins, _ := withPlugins(t)
	ctx := context.Background()

	sources, err := h.svc.Sources(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(sources) != 1 || sources[0].ID != "plugin:comics" || sources[0].Name != "Comics" || sources[0].Kind != "plugin" {
		t.Fatalf("sources = %+v", sources)
	}

	hits, err := h.svc.Search(ctx, "plugin:comics", "frieren", "anilist:118586")
	if err != nil {
		t.Fatal(err)
	}
	if len(hits) != 1 || hits[0].ID != "frieren/1" || hits[0].Detail != "2020" {
		t.Fatalf("hits = %+v", hits)
	}
	if plugins.count("search comics frieren frieren 118586") != 1 {
		t.Fatalf("asked = %v; want the query, as the title's name, and the AniList id", plugins.asked)
	}
}

func TestAPluginsSeriesIsLinkedAndItsChaptersListed(t *testing.T) {
	h, plugins, _ := withPlugins(t)
	ctx := context.Background()

	if err := h.svc.SetLink(ctx, "anilist:118586", "plugin:comics", "frieren/1", "Sousou no Frieren"); err != nil {
		t.Fatal(err)
	}

	chapters, problems, err := h.svc.Chapters(ctx, "anilist:118586")
	if err != nil || len(problems) != 0 {
		t.Fatalf("chapters: %v, problems %+v", err, problems)
	}

	var numbers []string
	for _, c := range chapters {
		numbers = append(numbers, c.Number)
		if !strings.HasPrefix(c.Ref, "plugin:comics:") || c.SourceName != "Comics" || c.Source != "plugin:comics" {
			t.Fatalf("chapter = %+v", c)
		}
	}
	if strings.Join(numbers, ",") != "1,2," {
		t.Fatalf("numbers = %v; want chapter order, the extra last", numbers)
	}
	if chapters[1].Language != "en" || len(chapters[1].Groups) != 1 {
		t.Fatalf("chapter 2 = %+v", chapters[1])
	}

	// The list is reused, until the plugin changes.
	if _, _, err = h.svc.Chapters(ctx, "anilist:118586"); err != nil || plugins.count("chapters frieren/1") != 1 {
		t.Fatalf("asked %d times, want once", plugins.count("chapters frieren/1"))
	}
	plugins.providers[0].Revision = "r2"
	if _, _, err = h.svc.Chapters(ctx, "anilist:118586"); err != nil || plugins.count("chapters frieren/1") != 2 {
		t.Fatalf("asked %d times, want again for the new revision", plugins.count("chapters frieren/1"))
	}
}

func TestAPluginThatFailsIsOneProblemAmongTheSources(t *testing.T) {
	h, plugins, _ := withPlugins(t)
	ctx := context.Background()

	if err := h.svc.SetLink(ctx, "anilist:118586", "plugin:comics", "frieren/1", "Sousou no Frieren"); err != nil {
		t.Fatal(err)
	}
	plugins.err = errors.New("the site answered 503")

	chapters, problems, err := h.svc.Chapters(ctx, "anilist:118586")
	if err != nil {
		t.Fatal(err)
	}
	if len(chapters) != 0 || len(problems) != 1 || problems[0].SourceName != "Comics" || !strings.Contains(problems[0].Detail, "503") {
		t.Fatalf("chapters %+v, problems %+v", chapters, problems)
	}
}

func TestAPluginsLinkNeedsThePluginAndAnID(t *testing.T) {
	h, _, _ := withPlugins(t)
	ctx := context.Background()

	if err := h.svc.SetLink(ctx, "anilist:1", "plugin:gone", "x", ""); apperr.KindOf(err) != apperr.KindNotFound {
		t.Errorf("a plugin that is not on: %v", err)
	}
	if err := h.svc.SetLink(ctx, "anilist:1", "plugin:comics", "", ""); apperr.KindOf(err) != apperr.KindInvalid {
		t.Errorf("no series id: %v", err)
	}
	if err := h.svc.SetLink(ctx, "anilist:1", "plugin:comics", "a\nb", ""); apperr.KindOf(err) != apperr.KindInvalid {
		t.Errorf("a control character: %v", err)
	}
}

func TestAPluginsChapterReadsPageByPage(t *testing.T) {
	h, plugins, _ := withPlugins(t)
	ctx := context.Background()

	if err := h.svc.SetLink(ctx, "anilist:118586", "plugin:comics", "frieren/1", "Sousou no Frieren"); err != nil {
		t.Fatal(err)
	}
	chapters, _, err := h.svc.Chapters(ctx, "anilist:118586")
	if err != nil {
		t.Fatal(err)
	}
	key := strings.TrimPrefix(chapters[0].Ref, "plugin:comics:")

	chapter, err := h.svc.PluginChapter(ctx, "comics", key)
	if err != nil {
		t.Fatal(err)
	}
	if chapter.Pages != 2 || chapter.MediaRef != "anilist:118586" || chapter.Title != "Sousou no Frieren" || chapter.Number != "1" || chapter.SourceName != "Comics" {
		t.Fatalf("chapter = %+v", chapter)
	}

	for i := range 2 {
		data, contentType, pageErr := h.svc.PluginPage(ctx, "comics", key, i)
		if pageErr != nil || contentType != "image/png" || !strings.Contains(string(data), plugins.pages[i].URL) {
			t.Fatalf("page %d: %q %s %v", i, data, contentType, pageErr)
		}
	}
	if plugins.fetched[0].Referer != "https://comics.example.org/" {
		t.Fatalf("fetched %+v; the referer goes with the page", plugins.fetched)
	}

	// The chapter and both pages asked the plugin for the pages once.
	if got := plugins.count("pages c:1"); got != 1 {
		t.Fatalf("pages asked %d times", got)
	}

	if _, _, err = h.svc.PluginPage(ctx, "comics", key, 2); apperr.KindOf(err) != apperr.KindNotFound {
		t.Fatalf("page past the end: %v", err)
	}
	if _, err = h.svc.PluginChapter(ctx, "comics", "not-a-key!"); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("a forged key: %v", err)
	}
}

func TestPluginPagesAreAskedAgainInTime(t *testing.T) {
	h, plugins, now := withPlugins(t)
	ctx := context.Background()

	key, err := encodePluginKey(pluginKey{Series: "frieren/1", Chapter: "c:1", Number: "1"})
	if err != nil {
		t.Fatal(err)
	}

	if _, err = h.svc.PluginChapter(ctx, "comics", key); err != nil {
		t.Fatal(err)
	}
	*now = now.Add(pluginPagesTTL + time.Second)
	if _, err = h.svc.PluginChapter(ctx, "comics", key); err != nil {
		t.Fatal(err)
	}

	if got := plugins.count("pages c:1"); got != 2 {
		t.Fatalf("pages asked %d times, want again once the list is old", got)
	}
}
