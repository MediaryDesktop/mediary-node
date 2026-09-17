package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/media/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/db"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anilist"
)

const detailsFixture = `{"data":{"Media":{
  "id":154587,"type":"ANIME","format":"TV","status":"FINISHED","episodes":28,"duration":24,
  "season":"FALL","seasonYear":2023,"averageScore":90,"genres":["Adventure","Drama"],"synonyms":null,
  "siteUrl":"https://anilist.co/anime/154587","isAdult":false,
  "description":"An elf <i>mage</i> outlives her party.<br><br><br>Adapted from the manga &amp; more.",
  "startDate":{"year":2023,"month":9,"day":29},"endDate":{"year":2024,"month":3,"day":22},
  "title":{"userPreferred":"Sousou no Frieren","romaji":"Sousou no Frieren","english":"Frieren","native":null},
  "coverImage":{"extraLarge":null,"large":"https://img/l.jpg","medium":"https://img/m.jpg","color":"#aabbcc"},
  "trailer":{"id":"ZEkwCGJ3o7M","site":"youtube","thumbnail":"https://img/trailer.jpg"},
  "nextAiringEpisode":null,
  "studios":{"nodes":[{"id":1,"name":"Madhouse"}]},
  "relations":{"edges":[{"relationType":"SOURCE","node":{"id":118586,"type":"MANGA","format":"MANGA","title":{"userPreferred":"Frieren"},"coverImage":{"large":"https://img/manga.jpg"}}}]}
}}}`

type detailsHarness struct {
	svc      *Service
	requests *atomic.Int32
	server   *httptest.Server
	now      time.Time
}

func newDetailsHarness(t *testing.T) *detailsHarness {
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

	h := &detailsHarness{requests: &atomic.Int32{}, now: time.Now()}

	h.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h.requests.Add(1)
		if r.Header.Get("Authorization") != "" {
			t.Errorf("no token is stored, so the request must be anonymous")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(detailsFixture))
	}))
	t.Cleanup(h.server.Close)

	client := anilist.New(anilist.Options{
		Endpoint:    h.server.URL,
		Timeout:     5 * time.Second,
		Tokens:      anilist.NewTokenStore(filepath.Join(dir, "anilist-token")),
		MinInterval: time.Millisecond,
	})

	h.svc = New(store.New(database), zerolog.Nop(), Options{
		AniList: client,
		Now:     func() time.Time { return h.now },
	})

	return h
}

func TestDetailsAreMappedAndCachedForADay(t *testing.T) {
	h := newDetailsHarness(t)
	ctx := context.Background()

	details, err := h.svc.Details(ctx, "anilist:154587")
	if err != nil {
		t.Fatalf("details: %v", err)
	}

	if details.MediaType != "anime" || details.Episodes == nil || *details.Episodes != 28 {
		t.Fatalf("unexpected mapping: %+v", details)
	}
	if details.Description != "An elf mage outlives her party.\n\nAdapted from the manga & more." {
		t.Fatalf("description must be plain text, got %q", details.Description)
	}
	if len(details.Studios) != 1 || details.Studios[0] != "Madhouse" {
		t.Fatalf("studios = %v", details.Studios)
	}
	if details.Synonyms == nil {
		t.Fatal("a missing list must serialise as empty, not null")
	}
	if len(details.Relations) != 1 || details.Relations[0].MediaRef != "anilist:118586" || details.Relations[0].MediaType != "manga" {
		t.Fatalf("relations = %+v", details.Relations)
	}
	if details.Trailer == nil || details.Trailer.ID != "ZEkwCGJ3o7M" || details.Trailer.Site != "youtube" {
		t.Fatalf("trailer = %+v", details.Trailer)
	}

	h.now = h.now.Add(23 * time.Hour)
	if _, err := h.svc.Details(ctx, "anilist:154587"); err != nil {
		t.Fatalf("cached details: %v", err)
	}
	if h.requests.Load() != 1 {
		t.Fatalf("within a day the cache answers, got %d requests", h.requests.Load())
	}

	h.now = h.now.Add(2 * time.Hour)
	if _, err := h.svc.Details(ctx, "anilist:154587"); err != nil {
		t.Fatalf("refetched details: %v", err)
	}
	if h.requests.Load() != 2 {
		t.Fatalf("past a day the source is asked again, got %d requests", h.requests.Load())
	}
}

func TestDetailsCachedByAnOlderBuildAreFetchedAgain(t *testing.T) {
	h := newDetailsHarness(t)
	ctx := context.Background()

	legacy := []byte(`{"media_ref":"anilist:154587","media_type":"anime","title":{"user_preferred":"Frieren"}}`)
	if err := h.svc.store.Put(ctx, ProviderAniList, "154587", legacy, h.now); err != nil {
		t.Fatalf("seed legacy cache: %v", err)
	}

	details, err := h.svc.Details(ctx, "anilist:154587")
	if err != nil {
		t.Fatalf("details: %v", err)
	}

	if h.requests.Load() != 1 {
		t.Fatalf("a payload without the current version must be refetched, got %d requests", h.requests.Load())
	}
	if details.Trailer == nil {
		t.Fatal("the refetched details must carry the fields the legacy payload lacked")
	}
}

func TestATrailerWithoutAnIDIsDropped(t *testing.T) {
	source := &anilist.MediaDetails{}
	source.Trailer = &struct {
		ID        *string `json:"id"`
		Site      *string `json:"site"`
		Thumbnail *string `json:"thumbnail"`
	}{}

	if details := detailsFromAniList(source, time.Now()); details.Trailer != nil {
		t.Fatalf("an empty trailer must not reach clients, got %+v", details.Trailer)
	}
}

func TestDetailsPastTheCeilingAreNotServedOffline(t *testing.T) {
	h := newDetailsHarness(t)
	ctx := context.Background()

	if _, err := h.svc.Details(ctx, "anilist:154587"); err != nil {
		t.Fatalf("details: %v", err)
	}

	h.server.Close()
	h.now = h.now.Add(25 * time.Hour)

	_, err := h.svc.Details(ctx, "anilist:154587")
	if apperr.KindOf(err) != apperr.KindUnavailable {
		t.Fatalf("expired metadata must not be served as a fallback, got %v", err)
	}
}

func TestDetailsRejectForeignReferences(t *testing.T) {
	h := newDetailsHarness(t)

	for _, ref := range []string{"tmdb:1", "anilist:abc", "anilist:-3", "154587"} {
		if _, err := h.svc.Details(context.Background(), ref); apperr.KindOf(err) != apperr.KindInvalid {
			t.Errorf("%q: want invalid, got %v", ref, err)
		}
	}

	if h.requests.Load() != 0 {
		t.Fatalf("an invalid reference must not reach the source, got %d requests", h.requests.Load())
	}
}
