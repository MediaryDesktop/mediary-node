package service

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/release"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/torznab"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

type fakeTitles map[string][]string

func (f fakeTitles) Names(_ context.Context, mediaRef string) ([]string, error) {
	return f[mediaRef], nil
}

func (f fakeTitles) TotalEpisodes(context.Context, string) (*int, error) {
	total := 28
	return &total, nil
}

// A .torrent the fake indexer serves for its one result without a magnet.
const batchTorrent = "d4:infod6:lengthi1e4:name13:Frieren Batch12:piece lengthi16384e6:pieces20:aaaaaaaaaaaaaaaaaaaaee"

func item(title, hash string, seeders int, link string) string {
	attrs := fmt.Sprintf(`<torznab:attr name="seeders" value="%d"/><torznab:attr name="peers" value="%d"/>`, seeders, seeders+2)
	if hash != "" {
		attrs += fmt.Sprintf(`<torznab:attr name="infohash" value=%q/>`, hash)
	}

	return fmt.Sprintf(`<item><title>%s</title><link>%s</link>%s</item>`, title, link, attrs)
}

func feed(items ...string) string {
	return `<rss version="2.0" xmlns:torznab="http://torznab.com/schemas/2015/feed"><channel>` +
		strings.Join(items, "") + `</channel></rss>`
}

type indexer struct {
	server   *httptest.Server
	searches atomic.Int32
}

func newIndexer(t *testing.T) *indexer {
	t.Helper()

	ix := &indexer{}
	ix.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/dl/batch" {
			_, _ = w.Write([]byte(batchTorrent))
			return
		}
		if r.URL.Query().Get("apikey") != "key" {
			_, _ = w.Write([]byte(`<error code="100" description="Invalid API Key"/>`))
			return
		}

		ix.searches.Add(1)

		// Both names find the same 13th episode; only the English one finds the rest.
		results := []string{item("[SubsPlease] Sousou no Frieren - 13 (1080p)", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 40, "magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")}
		if r.URL.Query().Get("q") == "Frieren: Beyond Journey's End" {
			results = append(results,
				item("[Erai-raws] Frieren - 01 ~ 28 [1080p][Batch]", "", 90, ix.server.URL+"/dl/batch"),
				item("[SubsPlease] Sousou no Frieren - 12 (1080p)", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", 70, "magnet:?xt=urn:btih:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
				item("Frieren Movie Collection", "cccccccccccccccccccccccccccccccccccccccc", 5, "magnet:?xt=urn:btih:cccccccccccccccccccccccccccccccccccccccc"),
			)
		}
		_, _ = w.Write([]byte(feed(results...)))
	}))
	t.Cleanup(ix.server.Close)

	return ix
}

func (h *harness) withSearch(titles fakeTitles) {
	h.svc.opts.Titles = titles
	h.svc.opts.Torznab = torznab.New(5*time.Second, "test")
}

func addSource(t *testing.T, h *harness, name, url, key string) *TorrentSource {
	t.Helper()

	source, err := h.svc.CreateSource(context.Background(), SourceInput{Name: name, URL: url, APIKey: &key})
	if err != nil {
		t.Fatal(err)
	}

	return source
}

var frierenNames = fakeTitles{"anilist:154587": {"Frieren: Beyond Journey's End", "Sousou no Frieren", "frieren: beyond journey's end"}}

func TestSearchNeedsASource(t *testing.T) {
	h := newHarness(t)
	h.withSearch(frierenNames)

	_, err := h.svc.Search(context.Background(), SearchRequest{MediaRef: "anilist:154587"})
	if apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("err = %v, want precondition", err)
	}
}

func TestSearchAsksForEveryNameAndRanksForTheEpisode(t *testing.T) {
	h := newHarness(t)
	h.withSearch(frierenNames)
	ix := newIndexer(t)

	addSource(t, h, "Jackett", ix.server.URL+"/api?apikey=pasted", "key")
	addSource(t, h, "Broken", ix.server.URL+"/api", "wrong")

	result, err := h.svc.Search(context.Background(), SearchRequest{MediaRef: "anilist:154587", Episode: 13})
	if err != nil {
		t.Fatal(err)
	}

	if len(result.Queries) != 2 {
		t.Fatalf("queries = %v, want the two distinct names", result.Queries)
	}

	var titles []string
	for _, found := range result.Releases {
		titles = append(titles, found.Match+": "+found.Title)
	}
	want := []string{
		"episode: [SubsPlease] Sousou no Frieren - 13 (1080p)",
		"batch: [Erai-raws] Frieren - 01 ~ 28 [1080p][Batch]",
		"unknown: Frieren Movie Collection",
	}
	if strings.Join(titles, "\n") != strings.Join(want, "\n") {
		t.Fatalf("releases:\n%s\nwant:\n%s", strings.Join(titles, "\n"), strings.Join(want, "\n"))
	}

	if result.Sources[0].Error != "" || result.Sources[1].Error == "" || !strings.Contains(result.Sources[1].Error, "Invalid API Key") {
		t.Fatalf("sources = %+v, want the broken one reported", result.Sources)
	}

	searches := ix.searches.Load()
	if _, err := h.svc.Search(context.Background(), SearchRequest{MediaRef: "anilist:154587", Episode: 12}); err != nil {
		t.Fatal(err)
	}
	if ix.searches.Load() != searches {
		t.Fatal("the same queries within minutes come from the cache")
	}
}

func TestAReleaseFoundIsDownloadedByItsID(t *testing.T) {
	h := newHarness(t)
	h.configure(t)
	h.withSearch(frierenNames)
	ix := newIndexer(t)
	addSource(t, h, "Jackett", ix.server.URL+"/api", "key")

	result, err := h.svc.Search(context.Background(), SearchRequest{Query: "Frieren: Beyond Journey's End"})
	if err != nil {
		t.Fatal(err)
	}

	var batchID, magnetID string
	for _, found := range result.Releases {
		switch found.Title {
		case "[Erai-raws] Frieren - 01 ~ 28 [1080p][Batch]":
			batchID = found.ID
		case "[SubsPlease] Sousou no Frieren - 12 (1080p)":
			magnetID = found.ID
		}
	}

	if _, err = h.svc.Add(context.Background(), AddRequest{MediaRef: "anilist:154587", Title: "Frieren", ReleaseID: magnetID}); err != nil {
		t.Fatal(err)
	}
	if got := h.client.added[0]; got.Magnet != "magnet:?xt=urn:btih:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" {
		t.Fatalf("add = %+v, want the result's magnet", got)
	}

	added, err := h.svc.Add(context.Background(), AddRequest{MediaRef: "anilist:154587", Title: "Frieren", ReleaseID: batchID})
	if err != nil {
		t.Fatal(err)
	}
	if got := h.client.added[1]; string(got.Torrent) != batchTorrent || added.Source != "file" {
		t.Fatalf("add = %+v, download = %+v; want the .torrent fetched from the source", got, added)
	}

	_, err = h.svc.Add(context.Background(), AddRequest{MediaRef: "anilist:154587", ReleaseID: "hnope"})
	if apperr.KindOf(err) != apperr.KindNotFound {
		t.Fatalf("an unknown result: %v, want not found", err)
	}
}

func TestSourcesKeepTheirKeysApart(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	source := addSource(t, h, "Prowlarr", "http://localhost:9696/1/api?apikey=pasted", "key")
	if source.URL != "http://localhost:9696/1/api" || !source.HasAPIKey {
		t.Fatalf("source = %+v, want the pasted key dropped from the address", source)
	}

	updated, err := h.svc.UpdateSource(ctx, source.ID, SourceInput{Name: "Prowlarr 2", URL: source.URL})
	if err != nil || !updated.HasAPIKey || updated.Name != "Prowlarr 2" {
		t.Fatalf("updated = %+v, %v; want the key kept", updated, err)
	}

	if err := h.svc.DeleteSource(ctx, source.ID); err != nil {
		t.Fatal(err)
	}
	if key, _ := h.svc.secrets.Get(sourceKey(source.ID)); key != "" {
		t.Fatalf("the key outlived its source: %q", key)
	}

	if _, err := h.svc.CreateSource(ctx, SourceInput{Name: " ", URL: "http://x"}); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("a nameless source: %v, want invalid", err)
	}
}

func TestMatchOfASeason(t *testing.T) {
	season := release.Parse

	cases := []struct {
		name            string
		episode, season int
		want            string
	}{
		{"Breaking.Bad.S02E05.1080p", 5, 2, "episode"},
		{"Breaking.Bad.S03E05.1080p", 5, 2, ""},
		{"Breaking Bad S02 1080p", 5, 2, "batch"},
		{"Breaking Bad S02 1080p", 0, 2, "any"},
		{"Breaking Bad 1080p", 0, 2, "unknown"},
		{"[SubsPlease] Frieren - 13 (1080p)", 13, 0, "episode"},
	}

	for _, c := range cases {
		if got := matchOf(season(c.name), c.episode, c.season); got != c.want {
			t.Errorf("%s for S%d E%d = %q, want %q", c.name, c.season, c.episode, got, c.want)
		}
	}
}
