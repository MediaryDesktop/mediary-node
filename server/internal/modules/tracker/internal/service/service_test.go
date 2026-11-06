package service

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/tracker/internal/store"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/db"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/events"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/sources/anilist"
)

type fakeAniList struct {
	server       *httptest.Server
	rejectTokens atomic.Bool
	collections  atomic.Int32

	mu         sync.Mutex
	animeLists []string
	mangaLists []string
	membership map[int][]string
}

func (f *fakeAniList) savedMembership() map[int][]string {
	f.mu.Lock()
	defer f.mu.Unlock()

	saved := make(map[int][]string, len(f.membership))
	for mediaID, names := range f.membership {
		saved[mediaID] = slices.Clone(names)
	}

	return saved
}

func (f *fakeAniList) customLists() (anime, manga []string) {
	f.mu.Lock()
	defer f.mu.Unlock()

	return slices.Clone(f.animeLists), slices.Clone(f.mangaLists)
}

func (f *fakeAniList) setCustomLists(anime, manga []string) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.animeLists = slices.Clone(anime)
	f.mangaLists = slices.Clone(manga)
}

func (f *fakeAniList) mediaListOptionsJSON() string {
	anime, manga := f.customLists()

	options := map[string]any{
		"scoreFormat": "POINT_10_DECIMAL",
		"animeList":   map[string]any{"customLists": anime},
		"mangaList":   map[string]any{"customLists": manga},
	}

	encoded, _ := json.Marshal(options)

	return string(encoded)
}

func newFakeAniList(t *testing.T) *fakeAniList {
	t.Helper()

	fake := &fakeAniList{}
	fake.server = httptest.NewServer(http.HandlerFunc(fake.serve))
	t.Cleanup(fake.server.Close)

	return fake
}

func (f *fakeAniList) serve(w http.ResponseWriter, r *http.Request) {
	body, _ := io.ReadAll(r.Body)
	w.Header().Set("Content-Type", "application/json")

	if f.rejectTokens.Load() {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"data":null,"errors":[{"message":"Invalid token","status":400}]}`))
		return
	}

	if strings.Contains(string(body), "UpdateUser") {
		var request struct {
			Variables struct {
				AnimeLists []string `json:"animeLists"`
				MangaLists []string `json:"mangaLists"`
			} `json:"variables"`
		}

		if err := json.Unmarshal(body, &request); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		f.setCustomLists(request.Variables.AnimeLists, request.Variables.MangaLists)

		_, _ = w.Write([]byte(`{"data":{"UpdateUser":{"id":42,"mediaListOptions":` + f.mediaListOptionsJSON() + `}}}`))

		return
	}

	if strings.Contains(string(body), "SaveEntryCustomLists") {
		var request struct {
			Variables struct {
				MediaID     int      `json:"mediaId"`
				CustomLists []string `json:"customLists"`
			} `json:"variables"`
		}

		if err := json.Unmarshal(body, &request); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		f.mu.Lock()
		if f.membership == nil {
			f.membership = make(map[int][]string)
		}
		f.membership[request.Variables.MediaID] = request.Variables.CustomLists
		f.mu.Unlock()

		_, _ = w.Write([]byte(`{"data":{"SaveMediaListEntry":{"id":1}}}`))

		return
	}

	if strings.Contains(string(body), "MediaListCollection") {
		f.collections.Add(1)
		_, _ = w.Write([]byte(collectionFixture))
		return
	}

	_, _ = w.Write([]byte(`{"data":{"Viewer":{"id":42,"name":"lukas","siteUrl":"https://anilist.co/user/lukas","mediaListOptions":` + f.mediaListOptionsJSON() + `}}}`))
}

const collectionFixture = `{"data":{"MediaListCollection":{"lists":[
  {"name":"Watching","isCustomList":false,"status":"CURRENT","entries":[
    {"id":1,"mediaId":100,"status":"CURRENT","score":85,"progress":7,"repeat":0,"private":false,"notes":null,"updatedAt":1700000000,
     "startedAt":{"year":2024,"month":1,"day":null},"completedAt":{"year":null,"month":null,"day":null},
     "media":{"id":100,"type":"ANIME","format":"TV","episodes":24,"siteUrl":"https://anilist.co/anime/100",
              "title":{"userPreferred":"Frieren","romaji":"Sousou no Frieren","english":"Frieren","native":null},
              "coverImage":{"extraLarge":null,"large":"https://img/100.jpg","medium":null,"color":"#aabbcc"}}}
  ]},
  {"name":"Favourites 2025","isCustomList":true,"status":null,"entries":[
    {"id":1,"mediaId":100,"status":"CURRENT","score":85,"progress":7,"repeat":0,"private":false,"notes":null,"updatedAt":1700000000,
     "startedAt":{},"completedAt":{},
     "media":{"id":100,"type":"ANIME","siteUrl":"https://anilist.co/anime/100","title":{},"coverImage":{}}}
  ]}
]}}}`

type harness struct {
	svc    *Service
	client *anilist.Client
	hub    *events.Hub
	now    time.Time
}

func newHarness(t *testing.T, endpoint string) *harness {
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

	client := anilist.New(anilist.Options{
		Endpoint:    endpoint,
		Timeout:     5 * time.Second,
		Tokens:      anilist.NewTokenStore(filepath.Join(dir, "anilist-token")),
		MinInterval: time.Millisecond,
	})

	h := &harness{client: client, hub: events.NewHub(16), now: time.Now()}

	h.svc = New(store.New(database), zerolog.Nop(), h.hub, Options{
		AniList:         client,
		ClientID:        "123",
		AuthorizeURL:    "https://anilist.co/api/v2/oauth/authorize",
		RefreshInterval: 5 * time.Minute,
		Now:             func() time.Time { return h.now },
	})

	return h
}

func waitForTrackerEvents(t *testing.T, stream <-chan events.Event, count int) {
	t.Helper()

	deadline := time.After(5 * time.Second)
	for received := 0; received < count; {
		select {
		case <-stream:
			received++
		case <-deadline:
			t.Fatalf("waited for %d tracker events, got %d", count, received)
		}
	}
}

func TestSignInThenEntriesSurviveGoingOffline(t *testing.T) {
	fake := newFakeAniList(t)
	h := newHarness(t, fake.server.URL)
	ctx := context.Background()

	stream, unsubscribe := h.hub.Subscribe(events.TopicTracker)
	defer unsubscribe()

	account, err := h.svc.SignIn(ctx, "token")
	if err != nil {
		t.Fatalf("sign in: %v", err)
	}
	if account.ID != 42 || account.ScoreFormat != "POINT_10_DECIMAL" {
		t.Fatalf("unexpected account: %+v", account)
	}

	waitForTrackerEvents(t, stream, 2)

	collection, err := h.svc.Entries(ctx, MediaTypeAnime)
	if err != nil {
		t.Fatalf("entries: %v", err)
	}
	if len(collection.Entries) != 1 {
		t.Fatalf("want 1 entry, got %d", len(collection.Entries))
	}

	fake.server.Close()

	offline, err := h.svc.Entries(ctx, MediaTypeAnime)
	if err != nil {
		t.Fatalf("entries must come from the mirror while AniList is unreachable: %v", err)
	}
	if len(offline.Entries) != 1 || offline.Entries[0].MediaRef != "anilist:100" {
		t.Fatalf("unexpected offline entries: %+v", offline.Entries)
	}

	session, err := h.svc.Session(ctx)
	if err != nil || !session.Connected || session.Account == nil {
		t.Fatalf("session must stay connected offline, got %+v, %v", session, err)
	}
}

func TestStaleMirrorIsServedAndRefreshedInBackground(t *testing.T) {
	fake := newFakeAniList(t)
	h := newHarness(t, fake.server.URL)
	ctx := context.Background()

	stream, unsubscribe := h.hub.Subscribe(events.TopicTracker)
	defer unsubscribe()

	if _, err := h.svc.SignIn(ctx, "token"); err != nil {
		t.Fatalf("sign in: %v", err)
	}
	waitForTrackerEvents(t, stream, 2)

	before := fake.collections.Load()
	h.now = h.now.Add(10 * time.Minute)

	collection, err := h.svc.Entries(ctx, MediaTypeAnime)
	if err != nil {
		t.Fatalf("entries: %v", err)
	}
	if !collection.Stale {
		t.Fatal("a mirror older than the refresh interval must be marked stale")
	}

	waitForTrackerEvents(t, stream, 1)

	if fake.collections.Load() != before+1 {
		t.Fatalf("expected exactly one background refresh, got %d", fake.collections.Load()-before)
	}
}

func TestRejectedTokenDisconnectsTheAccount(t *testing.T) {
	fake := newFakeAniList(t)
	h := newHarness(t, fake.server.URL)
	ctx := context.Background()

	stream, unsubscribe := h.hub.Subscribe(events.TopicTracker)
	defer unsubscribe()

	if _, err := h.svc.SignIn(ctx, "token"); err != nil {
		t.Fatalf("sign in: %v", err)
	}
	waitForTrackerEvents(t, stream, 2)

	fake.rejectTokens.Store(true)
	h.now = h.now.Add(10 * time.Minute)

	auth, unsubscribeAuth := h.hub.Subscribe(events.TopicAniListAuth)
	defer unsubscribeAuth()

	if _, err := h.svc.Entries(ctx, MediaTypeAnime); err != nil {
		t.Fatalf("the stale mirror is still served before the refresh fails: %v", err)
	}

	select {
	case event := <-auth:
		if event.Payload["reason"] != "token_rejected" {
			t.Fatalf("unexpected session event: %+v", event)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("a rejected token must announce the disconnect")
	}

	_, err := h.svc.Entries(ctx, MediaTypeAnime)
	if apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("after rejection entries must require sign-in, got %v", err)
	}

	token, _ := h.client.Tokens().Token()
	if token != "" {
		t.Fatal("the rejected token must be removed from disk")
	}
}

func TestSignInWithARejectedTokenIsAValidationError(t *testing.T) {
	fake := newFakeAniList(t)
	fake.rejectTokens.Store(true)
	h := newHarness(t, fake.server.URL)

	_, err := h.svc.SignIn(context.Background(), "bad")
	if apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("want invalid, got %v", err)
	}

	if token, _ := h.client.Tokens().Token(); token != "" {
		t.Fatal("a rejected token must never be stored")
	}
}

func TestEntriesWithoutSignInNeedPrecondition(t *testing.T) {
	h := newHarness(t, "http://127.0.0.1:1")

	_, err := h.svc.Entries(context.Background(), MediaTypeManga)
	if apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("want precondition, got %v", err)
	}

	session, err := h.svc.Session(context.Background())
	if err != nil || session.Connected {
		t.Fatalf("want a disconnected session, got %+v, %v", session, err)
	}
	if !strings.Contains(session.AuthorizeURL, "client_id=123") || !strings.Contains(session.AuthorizeURL, "response_type=token") {
		t.Fatalf("unexpected authorize url: %s", session.AuthorizeURL)
	}
}

func TestCustomListsMergeIntoOneEntry(t *testing.T) {
	var payload struct {
		Data struct {
			MediaListCollection anilist.Collection `json:"MediaListCollection"`
		} `json:"data"`
	}
	if err := json.Unmarshal([]byte(collectionFixture), &payload); err != nil {
		t.Fatalf("fixture: %v", err)
	}

	collection := collectionFromAniList(&payload.Data.MediaListCollection, MediaTypeAnime, time.Now())

	if len(collection.Entries) != 1 {
		t.Fatalf("an entry in a status list and a custom list is one entry, got %d", len(collection.Entries))
	}

	entry := collection.Entries[0]
	if len(entry.CustomLists) != 1 || entry.CustomLists[0] != "Favourites 2025" {
		t.Fatalf("custom lists = %v", entry.CustomLists)
	}
	if entry.Score != 85 || entry.Progress != 7 || entry.Status != "CURRENT" {
		t.Fatalf("unexpected entry fields: %+v", entry)
	}
	if entry.Media.CoverImage == nil || *entry.Media.CoverImage != "https://img/100.jpg" {
		t.Fatalf("cover must fall back to the largest available image, got %v", entry.Media.CoverImage)
	}
	if len(collection.Lists) != 2 || !collection.Lists[1].Custom {
		t.Fatalf("unexpected lists: %+v", collection.Lists)
	}
}
