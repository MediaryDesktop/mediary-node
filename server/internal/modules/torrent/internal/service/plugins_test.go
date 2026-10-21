package service

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// fakeProviders stands in for the extension module: plugins that answer what
// a test sets, and record what they were asked.
type fakeProviders struct {
	mu        sync.Mutex
	providers []Provider
	answers   map[string][]ProviderRelease
	errs      map[string]error
	// Plugins that answer only when the search stops waiting.
	hangs   map[string]bool
	asked   map[string][]ProviderQuery
	fetched []string
	torrent []byte
}

func newFakeProviders(providers ...Provider) *fakeProviders {
	return &fakeProviders{
		providers: providers,
		answers:   map[string][]ProviderRelease{},
		errs:      map[string]error{},
		hangs:     map[string]bool{},
		asked:     map[string][]ProviderQuery{},
	}
}

func (f *fakeProviders) TorrentProviders(context.Context) ([]Provider, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	return f.providers, nil
}

func (f *fakeProviders) Search(ctx context.Context, id string, query ProviderQuery) ([]ProviderRelease, error) {
	f.mu.Lock()
	f.asked[id] = append(f.asked[id], query)
	answers, err, hangs := f.answers[id], f.errs[id], f.hangs[id]
	f.mu.Unlock()

	if hangs {
		<-ctx.Done()
		return nil, ctx.Err()
	}

	return answers, err
}

func (f *fakeProviders) FetchTorrent(_ context.Context, id, link string) (data []byte, magnet string, err error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.fetched = append(f.fetched, id+" "+link)

	return f.torrent, "", nil
}

func (f *fakeProviders) askedOf(id string) []ProviderQuery {
	f.mu.Lock()
	defer f.mu.Unlock()

	return append([]ProviderQuery(nil), f.asked[id]...)
}

var nyaa = Provider{ID: "nyaa", Name: "Nyaa", Version: "1.0.0"}

func TestAPluginIsEnoughToSearch(t *testing.T) {
	h := newHarness(t)
	h.withSearch(frierenNames)
	plugins := newFakeProviders(nyaa)
	plugins.answers["nyaa"] = []ProviderRelease{
		{Title: "[SubsPlease] Sousou no Frieren - 13 (1080p)", InfoHash: "dddddddddddddddddddddddddddddddddddddddd", Seeders: 50},
		{Title: "[SubsPlease] Sousou no Frieren - 14 (1080p)", Magnet: "magnet:?xt=urn:btih:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", Seeders: 30},
	}
	h.svc.opts.Providers = plugins

	result, err := h.svc.Search(context.Background(), SearchRequest{MediaRef: "anilist:154587", Episode: 13})
	if err != nil {
		t.Fatal(err)
	}

	if len(result.Releases) != 1 || result.Releases[0].Plugin != "nyaa" || result.Releases[0].SourceName != "Nyaa" || result.Releases[0].Match != "episode" {
		t.Fatalf("releases %+v", result.Releases)
	}
	if len(result.Sources) != 1 || result.Sources[0].Plugin != "nyaa" || result.Sources[0].ID != 0 || result.Sources[0].Results != 4 {
		t.Fatalf("sources %+v; want the plugin with two results for each of two queries", result.Sources)
	}

	// The plugin gets one call per query, each with every name, the episode
	// and the title's id.
	asked := plugins.askedOf("nyaa")
	if len(asked) != len(result.Queries) {
		t.Fatalf("asked %d times for %d queries", len(asked), len(result.Queries))
	}
	for _, q := range asked {
		if len(q.Titles) != 3 || q.Episode != 13 || q.AniListID != 154587 || q.TMDBID != 0 {
			t.Fatalf("asked %+v", q)
		}
	}
}

func TestPluginsAndSourcesShareOneList(t *testing.T) {
	h := newHarness(t)
	h.withSearch(frierenNames)
	ix := newIndexer(t)
	addSource(t, h, "Jackett", ix.server.URL+"/api", "key")

	broken := Provider{ID: "broken", Name: "Broken", Version: "1.0.0"}
	plugins := newFakeProviders(nyaa, broken)
	// The same 13th episode Jackett finds, by its hash, with more seeders.
	plugins.answers["nyaa"] = []ProviderRelease{
		{Title: "[SubsPlease] Sousou no Frieren - 13 (1080p)", InfoHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", Seeders: 400},
	}
	plugins.errs["broken"] = errors.New("plugin broken: the site is down")
	h.svc.opts.Providers = plugins

	result, err := h.svc.Search(context.Background(), SearchRequest{MediaRef: "anilist:154587", Episode: 13})
	if err != nil {
		t.Fatal(err)
	}

	thirteen := 0
	for _, r := range result.Releases {
		if strings.Contains(r.Title, "- 13 ") {
			thirteen++
			if r.Plugin != "nyaa" || r.Seeders != 400 {
				t.Fatalf("kept the copy %+v; want the plugin's, with more seeders", r)
			}
		}
	}
	if thirteen != 1 {
		t.Fatalf("the 13th episode %d times; one torrent is one result", thirteen)
	}

	names := make([]string, 0, len(result.Sources))
	for _, s := range result.Sources {
		names = append(names, s.Name+":"+s.Error)
	}
	if got := strings.Join(names, "|"); got != "Jackett:|Nyaa:|Broken:plugin broken: the site is down" {
		t.Fatalf("sources %s", got)
	}
}

// A plugin that never answers costs the search its wait, not the results the
// others found.
func TestAHangingPluginLeavesTheOthersResults(t *testing.T) {
	h := newHarness(t)
	h.withSearch(frierenNames)
	stuck := Provider{ID: "stuck", Name: "Stuck", Version: "1.0.0"}
	plugins := newFakeProviders(nyaa, stuck)
	plugins.answers["nyaa"] = []ProviderRelease{
		{Title: "[SubsPlease] Sousou no Frieren - 13 (1080p)", InfoHash: "dddddddddddddddddddddddddddddddddddddddd", Seeders: 50},
	}
	plugins.hangs["stuck"] = true
	h.svc.opts.Providers = plugins
	h.svc.opts.SearchTimeout = 100 * time.Millisecond

	result, err := h.svc.Search(context.Background(), SearchRequest{MediaRef: "anilist:154587", Episode: 13})
	if err != nil {
		t.Fatal(err)
	}

	if len(result.Releases) != 1 || result.Releases[0].Plugin != "nyaa" {
		t.Fatalf("releases %+v", result.Releases)
	}
	if len(result.Sources) != 2 || result.Sources[0].Error != "" || result.Sources[1].Error == "" {
		t.Fatalf("sources %+v; want the stuck plugin's alone failed", result.Sources)
	}
}

// A plugin's .torrent link goes through the plugin's own fetch — its hosts,
// public addresses — and never through the Torznab client.
func TestAPluginsLinkIsFetchedThroughThePlugin(t *testing.T) {
	h := newHarness(t)
	h.configure(t)
	h.withSearch(frierenNames)
	plugins := newFakeProviders(nyaa)
	plugins.torrent = []byte(batchTorrent)
	plugins.answers["nyaa"] = []ProviderRelease{
		{Title: "[Erai-raws] Frieren - 01 ~ 28 [1080p][Batch]", Link: "https://nyaa.si/download/1.torrent", Seeders: 90},
		{Title: "[SubsPlease] Sousou no Frieren - 12 (1080p)", InfoHash: "ffffffffffffffffffffffffffffffffffffffff", Seeders: 10},
	}
	h.svc.opts.Providers = plugins
	h.svc.opts.Torznab = nil // anything that reached for it would panic

	result, err := h.svc.Search(context.Background(), SearchRequest{Query: "Frieren"})
	if err != nil {
		t.Fatal(err)
	}

	byTitle := map[string]TorrentRelease{}
	for _, r := range result.Releases {
		byTitle[r.Title] = r
	}

	batch := byTitle["[Erai-raws] Frieren - 01 ~ 28 [1080p][Batch]"]
	added, err := h.svc.Add(context.Background(), AddRequest{MediaRef: "anilist:154587", Title: "Frieren", ReleaseID: batch.ID})
	if err != nil {
		t.Fatal(err)
	}
	if string(h.client.added[0].Torrent) != batchTorrent || added.Source != "file" {
		t.Fatalf("added %+v", h.client.added[0])
	}
	if len(plugins.fetched) != 1 || plugins.fetched[0] != "nyaa https://nyaa.si/download/1.torrent" {
		t.Fatalf("fetched %v", plugins.fetched)
	}

	// A hash alone becomes a magnet, named for the release.
	hashOnly := byTitle["[SubsPlease] Sousou no Frieren - 12 (1080p)"]
	if _, err = h.svc.Add(context.Background(), AddRequest{MediaRef: "anilist:154587", Title: "Frieren", ReleaseID: hashOnly.ID}); err != nil {
		t.Fatal(err)
	}
	if got := h.client.added[1].Magnet; !strings.HasPrefix(got, "magnet:?xt=urn:btih:ffffffffffffffffffffffffffffffffffffffff&dn=") || !strings.Contains(got, "Frieren") {
		t.Fatalf("magnet %q", got)
	}
}

func TestPluginAnswersAreReusedUntilTheyUpdate(t *testing.T) {
	h := newHarness(t)
	h.withSearch(frierenNames)
	plugins := newFakeProviders(nyaa)
	plugins.answers["nyaa"] = []ProviderRelease{{Title: "[SubsPlease] Sousou no Frieren - 13 (1080p)", InfoHash: "dddddddddddddddddddddddddddddddddddddddd"}}
	h.svc.opts.Providers = plugins
	ctx := context.Background()

	search := func(episode int) {
		t.Helper()
		if _, err := h.svc.Search(ctx, SearchRequest{Query: "Frieren", Episode: episode}); err != nil {
			t.Fatal(err)
		}
	}

	search(13)
	search(13)
	if n := len(plugins.askedOf("nyaa")); n != 1 {
		t.Fatalf("asked %d times for the same query", n)
	}

	// Another episode is another question: a plugin may search by it.
	search(14)
	if n := len(plugins.askedOf("nyaa")); n != 2 {
		t.Fatalf("asked %d times", n)
	}

	// A new version answers anew.
	plugins.mu.Lock()
	plugins.providers = []Provider{{ID: "nyaa", Name: "Nyaa", Version: "1.1.0"}}
	plugins.mu.Unlock()
	search(13)
	if n := len(plugins.askedOf("nyaa")); n != 3 {
		t.Fatalf("an updated plugin was not asked again (%d)", n)
	}
}

func TestSearchNeedsASourceOrAPlugin(t *testing.T) {
	h := newHarness(t)
	h.withSearch(frierenNames)
	h.svc.opts.Providers = newFakeProviders()

	_, err := h.svc.Search(context.Background(), SearchRequest{MediaRef: "anilist:154587"})
	if apperr.KindOf(err) != apperr.KindPrecondition || !strings.Contains(err.Error(), "install a search plugin") {
		t.Fatalf("%v", err)
	}
}

func TestTitleIDs(t *testing.T) {
	for ref, want := range map[string][2]int{
		"anilist:154587":   {154587, 0},
		"tmdb:movie:603":   {0, 603},
		"tmdb:tv:1396":     {0, 1396},
		"openlibrary:OL1W": {0, 0},
		"anilist:-5":       {0, 0},
		"":                 {0, 0},
	} {
		anilist, tmdb := titleIDs(ref)
		if anilist != want[0] || tmdb != want[1] {
			t.Errorf("%q: %d, %d; want %v", ref, anilist, tmdb, want)
		}
	}
}

func TestSearchPluginsCountsThoseOn(t *testing.T) {
	h := newHarness(t)

	if n, err := h.svc.SearchPlugins(context.Background()); err != nil || n != 0 {
		t.Fatalf("without plugins: %d, %v", n, err)
	}

	h.svc.opts.Providers = newFakeProviders(nyaa, Provider{ID: "other", Name: "Other", Version: "1.0.0"})
	if n, err := h.svc.SearchPlugins(context.Background()); err != nil || n != 2 {
		t.Fatalf("with two: %d, %v", n, err)
	}
}
