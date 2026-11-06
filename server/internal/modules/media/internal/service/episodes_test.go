package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/media/internal/store"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/db"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/sources/anilist"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/sources/anizip"
)

const episodesDetailsFixture = `{"data":{"Media":{
  "id":1535,"type":"ANIME","format":"TV","status":"FINISHED","episodes":4,"duration":23,
  "title":{"romaji":"Death Note"},"coverImage":{},"studios":{"nodes":[]},"relations":{"edges":[]},
  "streamingEpisodes":[
    {"title":"Episode 2 - Confrontation (stream)","thumbnail":"https://stream/2.jpg"},
    {"title":"Episode 3 - Dealings","thumbnail":"https://stream/3.jpg"},
    {"title":"Recap special","thumbnail":"https://stream/x.jpg"}
  ]
}}}`

const airingDetailsFixture = `{"data":{"Media":{
  "id":1535,"type":"ANIME","format":"TV","status":"RELEASING","episodes":null,"duration":null,
  "title":{"romaji":"Ongoing"},"coverImage":{},"studios":{"nodes":[]},"relations":{"edges":[]},
  "nextAiringEpisode":{"episode":4,"airingAt":1790000000}
}}}`

const aniZipFixture = `{"episodeCount":4,"episodes":{
  "1":{"episode":"1","title":{"en":"Rebirth","uk":"Переродження","de":"Wiedergeburt"},"overview":"Light finds a notebook.","image":"https://tvdb/1.jpg","runtime":24,"airDate":"2006-10-04"},
  "2":{"episode":"2","title":{"en":"Confrontation"},"overview":null,"image":null,"length":25},
  "S1":{"episode":"S1","title":{"en":"Relight"},"image":"https://tvdb/s1.jpg"}
}}`

type episodesHarness struct {
	svc            *Service
	aniZipRequests *atomic.Int32
	now            time.Time
}

func newEpisodesHarness(t *testing.T, details string, aniZip http.HandlerFunc) *episodesHarness {
	t.Helper()

	ctx := context.Background()
	dir := t.TempDir()

	database, err := db.Open(ctx, filepath.Join(dir, "node.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	if err := db.Migrate(ctx, database, zerolog.Nop()); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	aniListServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(details))
	}))
	t.Cleanup(aniListServer.Close)

	h := &episodesHarness{aniZipRequests: &atomic.Int32{}, now: time.Now()}

	aniZipServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h.aniZipRequests.Add(1)
		if r.URL.Path != "/mappings" || r.URL.Query().Get("anilist_id") != "1535" {
			t.Errorf("unexpected ani.zip request %s", r.URL)
		}
		aniZip(w, r)
	}))
	t.Cleanup(aniZipServer.Close)

	h.svc = New(store.New(database), zerolog.Nop(), Options{
		AniList: anilist.New(anilist.Options{
			Endpoint:    aniListServer.URL,
			Tokens:      anilist.NewTokenStore(filepath.Join(dir, "anilist-token")),
			MinInterval: time.Millisecond,
		}),
		AniZip: anizip.New(anizip.Options{Endpoint: aniZipServer.URL}),
		Now:    func() time.Time { return h.now },
	})

	return h
}

func answer(status int, body string) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}
}

func text(value *string) string {
	if value == nil {
		return "<nil>"
	}

	return *value
}

func TestEpisodesMergeSourcesFieldByField(t *testing.T) {
	h := newEpisodesHarness(t, episodesDetailsFixture, answer(http.StatusOK, aniZipFixture))

	list, err := h.svc.Episodes(context.Background(), "anilist:1535")
	if err != nil {
		t.Fatalf("episodes: %v", err)
	}

	if len(list.Episodes) != 4 {
		t.Fatalf("one entry per episode of the title, specials left out; got %d", len(list.Episodes))
	}
	if strings.Join(list.Sources, ",") != "anilist,anizip" {
		t.Fatalf("sources = %v", list.Sources)
	}

	first := list.Episodes[0]
	if text(first.Title) != "Rebirth" || first.Titles["uk"] != "Переродження" || first.Titles["de"] != "" {
		t.Fatalf("episode 1 titles: %q %v", text(first.Title), first.Titles)
	}
	if text(first.Image) != "https://tvdb/1.jpg" || text(first.AirDate) != "2006-10-04" || *first.RuntimeMinutes != 24 {
		t.Fatalf("episode 1 = %+v", first)
	}

	// ani.zip has a title but no still: the title stays ani.zip's, the still comes
	// from the streaming listing.
	second := list.Episodes[1]
	if text(second.Title) != "Confrontation" || text(second.Image) != "https://stream/2.jpg" || *second.RuntimeMinutes != 25 {
		t.Fatalf("episode 2 = %+v", second)
	}

	third := list.Episodes[2]
	if text(third.Title) != "Dealings" || text(third.Image) != "https://stream/3.jpg" {
		t.Fatalf("episode 3 must come from the streaming listing alone: %+v", third)
	}

	// Nobody knows episode 4 beyond its number and the title's typical length.
	fourth := list.Episodes[3]
	if fourth.Number != 4 || fourth.Title != nil || fourth.Image != nil || *fourth.RuntimeMinutes != 23 {
		t.Fatalf("episode 4 = %+v", fourth)
	}
}

func TestEpisodesWithoutAListingAreStillListedAndTheAnswerIsCached(t *testing.T) {
	h := newEpisodesHarness(t, episodesDetailsFixture, answer(http.StatusNotFound, `"Not Found"`))
	ctx := context.Background()

	list, err := h.svc.Episodes(ctx, "anilist:1535")
	if err != nil {
		t.Fatalf("episodes: %v", err)
	}

	if len(list.Episodes) != 4 || strings.Join(list.Sources, ",") != "anilist" {
		t.Fatalf("got %d episodes from %v", len(list.Episodes), list.Sources)
	}

	h.now = h.now.Add(time.Hour)
	if _, err := h.svc.Episodes(ctx, "anilist:1535"); err != nil {
		t.Fatalf("episodes again: %v", err)
	}
	if h.aniZipRequests.Load() != 1 {
		t.Fatalf("ani.zip having no listing is an answer worth a day too, got %d requests", h.aniZipRequests.Load())
	}
}

func TestEpisodesSurviveAFailingListing(t *testing.T) {
	h := newEpisodesHarness(t, episodesDetailsFixture, answer(http.StatusBadGateway, ``))

	list, err := h.svc.Episodes(context.Background(), "anilist:1535")
	if err != nil {
		t.Fatalf("a failing ani.zip must not fail the list: %v", err)
	}

	if len(list.Episodes) != 4 || text(list.Episodes[2].Title) != "Dealings" {
		t.Fatalf("the list must stand on what AniList carries: %+v", list.Episodes)
	}
}

func TestEpisodesOfAnAiringTitleStopAtTheLastAired(t *testing.T) {
	h := newEpisodesHarness(t, airingDetailsFixture, answer(http.StatusNotFound, `"Not Found"`))

	list, err := h.svc.Episodes(context.Background(), "anilist:1535")
	if err != nil {
		t.Fatalf("episodes: %v", err)
	}

	if list.Total == nil || *list.Total != 3 || len(list.Episodes) != 3 {
		t.Fatalf("total = %v, episodes = %d", list.Total, len(list.Episodes))
	}
	if list.Episodes[0].RuntimeMinutes != nil {
		t.Fatal("no source knows the length, so none must be made up")
	}
}
