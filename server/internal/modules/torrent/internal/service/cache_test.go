package service

import (
	"context"
	"errors"
	"testing"
)

// cachingClient is a debrid client that holds some torrents already.
type cachingClient struct {
	*fakeClient
	held  map[string]bool
	asked [][]string
	err   error
}

func (c *cachingClient) Service() string { return "Fake" }

func (c *cachingClient) Cached(_ context.Context, hashes []string) (map[string]bool, error) {
	c.asked = append(c.asked, hashes)
	if c.err != nil {
		return nil, c.err
	}

	out := map[string]bool{}
	for _, hash := range hashes {
		out[hash] = c.held[hash]
	}

	return out, nil
}

const (
	hashA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	hashB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
)

func withCachingTorBox(t *testing.T, h *harness) *cachingClient {
	t.Helper()

	client := &cachingClient{fakeClient: h.client, held: map[string]bool{hashA: true}}
	h.svc.opts.Debrid = map[string]DebridService{DebridTorBox: {Client: client}}

	// The library downloads through qBittorrent; the marks come from the debrid
	// service all the same.
	h.configure(t)
	setUpDebrid(t, h, DebridTorBox, "key")

	return client
}

func releasesByTitle(result *TorrentSearchResult) map[string]TorrentRelease {
	out := map[string]TorrentRelease{}
	for i := range result.Releases {
		out[result.Releases[i].Title] = result.Releases[i]
	}

	return out
}

func TestSearchMarksWhatTheDebridServiceHolds(t *testing.T) {
	h := newHarness(t)
	h.withSearch(frierenNames)
	client := withCachingTorBox(t, h)
	ix := newIndexer(t)
	addSource(t, h, "Jackett", ix.server.URL+"/api", "key")

	result, err := h.svc.Search(context.Background(), SearchRequest{Query: "Frieren: Beyond Journey's End"})
	if err != nil {
		t.Fatal(err)
	}

	if result.CacheService != "Fake" {
		t.Errorf("cache service = %q", result.CacheService)
	}

	got := releasesByTitle(result)
	if c := got["[SubsPlease] Sousou no Frieren - 13 (1080p)"].Cached; c == nil || !*c {
		t.Errorf("held release cached = %v, want true", c)
	}
	if c := got["[SubsPlease] Sousou no Frieren - 12 (1080p)"].Cached; c == nil || *c {
		t.Errorf("other release cached = %v, want false", c)
	}
	// Only a .torrent link, no hash: nothing to ask about, so no mark either way.
	if c := got["[Erai-raws] Frieren - 01 ~ 28 [1080p][Batch]"].Cached; c != nil {
		t.Errorf("release without a hash cached = %v, want absent", *c)
	}
	if len(client.asked) != 1 || len(client.asked[0]) != 3 {
		t.Errorf("asked = %v, want one batch of the three hashes", client.asked)
	}

	if best := bestTitle(result); best != "[Erai-raws] Frieren - 01 ~ 28 [1080p][Batch]" {
		t.Errorf("best without the preference = %q, want the most seeded", best)
	}

	if _, profileErr := h.svc.SetProfile(context.Background(), TorrentProfile{PreferCached: true}); profileErr != nil {
		t.Fatal(profileErr)
	}

	h.svc.forgetSearches()
	result, err = h.svc.Search(context.Background(), SearchRequest{Query: "Frieren: Beyond Journey's End"})
	if err != nil {
		t.Fatal(err)
	}
	if best := bestTitle(result); best != "[SubsPlease] Sousou no Frieren - 13 (1080p)" {
		t.Errorf("best preferring cached = %q, want the held one", best)
	}
}

func TestSearchWithoutAnAnswerFromTheServiceHasNoMarks(t *testing.T) {
	h := newHarness(t)
	h.withSearch(frierenNames)
	client := withCachingTorBox(t, h)
	client.err = errors.New("TorBox cannot be reached")
	ix := newIndexer(t)
	addSource(t, h, "Jackett", ix.server.URL+"/api", "key")

	result, err := h.svc.Search(context.Background(), SearchRequest{Query: "Frieren: Beyond Journey's End"})
	if err != nil {
		t.Fatalf("a failed cache check failed the search: %v", err)
	}
	if result.CacheService != "" {
		t.Errorf("cache service = %q, want none", result.CacheService)
	}
	for _, found := range result.Releases {
		if found.Cached != nil {
			t.Errorf("%s marked %v", found.Title, *found.Cached)
		}
	}
}

func TestSearchWithQBittorrentHasNoMarks(t *testing.T) {
	h := newHarness(t)
	h.configure(t)
	h.withSearch(frierenNames)
	ix := newIndexer(t)
	addSource(t, h, "Jackett", ix.server.URL+"/api", "key")

	result, err := h.svc.Search(context.Background(), SearchRequest{Query: "Frieren: Beyond Journey's End"})
	if err != nil {
		t.Fatal(err)
	}
	if result.CacheService != "" {
		t.Errorf("cache service = %q", result.CacheService)
	}
}

func bestTitle(result *TorrentSearchResult) string {
	for i := range result.Releases {
		if result.Releases[i].Best {
			return result.Releases[i].Title
		}
	}

	return ""
}
