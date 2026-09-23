package service

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/tracker/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/db"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anilist"
)

type syncFake struct {
	server *httptest.Server

	mu             sync.Mutex
	viewerID       int
	remoteProgress *int
	saves          []map[string]any
}

func newSyncFake(t *testing.T) *syncFake {
	t.Helper()

	fake := &syncFake{viewerID: 42}
	fake.server = httptest.NewServer(http.HandlerFunc(fake.serve))
	t.Cleanup(fake.server.Close)

	return fake
}

func (f *syncFake) serve(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Query     string         `json:"query"`
		Variables map[string]any `json:"variables"`
	}
	body, _ := io.ReadAll(r.Body)
	_ = json.Unmarshal(body, &request)

	w.Header().Set("Content-Type", "application/json")

	f.mu.Lock()
	defer f.mu.Unlock()

	switch {
	case strings.Contains(request.Query, "SaveMediaListEntry"):
		f.saves = append(f.saves, request.Variables)

		entry := map[string]any{
			"id": 1, "mediaId": request.Variables["mediaId"], "status": "CURRENT", "score": 85,
			"progress": 7, "repeat": 0, "private": false, "updatedAt": 1700000100,
			"startedAt": map[string]any{}, "completedAt": map[string]any{},
			"media": map[string]any{"id": request.Variables["mediaId"], "type": "ANIME", "siteUrl": "", "title": map[string]any{}, "coverImage": map[string]any{}},
		}
		for _, field := range []string{"status", "progress"} {
			if value, ok := request.Variables[field]; ok {
				entry[field] = value
			}
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"data": map[string]any{"SaveMediaListEntry": entry}})

	case strings.Contains(request.Query, "MediaList("):
		if f.remoteProgress == nil {
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"data":{"MediaList":null},"errors":[{"message":"Not Found.","status":404}]}`))
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"data": map[string]any{"MediaList": map[string]any{"id": 1, "progress": *f.remoteProgress}}})

	case strings.Contains(request.Query, "MediaListCollection"):
		_, _ = w.Write([]byte(collectionFixture))

	default:
		_ = json.NewEncoder(w).Encode(map[string]any{"data": map[string]any{"Viewer": map[string]any{
			"id": f.viewerID, "name": "lukas", "siteUrl": "", "mediaListOptions": map[string]any{"scoreFormat": "POINT_100"},
		}}})
	}
}

func (f *syncFake) savedCalls() []map[string]any {
	f.mu.Lock()
	defer f.mu.Unlock()

	return append([]map[string]any(nil), f.saves...)
}

type syncHarness struct {
	svc    *Service
	store  *store.Store
	client *anilist.Client
	hub    *events.Hub
}

func newSyncHarness(t *testing.T, endpoint string) *syncHarness {
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

	h := &syncHarness{store: store.New(database), client: client, hub: events.NewHub(32)}
	h.svc = New(h.store, zerolog.Nop(), h.hub, Options{
		AniList:         client,
		RefreshInterval: time.Hour,
		FlushDelay:      time.Hour,
	})

	return h
}

func (h *syncHarness) signIn(t *testing.T) {
	t.Helper()

	stream, unsubscribe := h.hub.Subscribe(events.TopicTracker)
	defer unsubscribe()

	if _, err := h.svc.SignIn(context.Background(), "token"); err != nil {
		t.Fatalf("sign in: %v", err)
	}

	waitForTrackerEvents(t, stream, 2)
}

func intPtr(value int) *int { return &value }

func strPtr(value string) *string { return &value }

func entryByRef(t *testing.T, collection *Collection, ref string) Entry {
	t.Helper()

	for i := range collection.Entries {
		if collection.Entries[i].MediaRef == ref {
			return collection.Entries[i]
		}
	}

	t.Fatalf("entry %s not found", ref)
	return Entry{}
}

func TestUpdateIsVisibleImmediatelyAndSyncedLater(t *testing.T) {
	fake := newSyncFake(t)
	h := newSyncHarness(t, fake.server.URL)
	h.signIn(t)
	ctx := context.Background()

	updated, err := h.svc.UpdateEntry(ctx, "anilist:100", EntryPatch{Progress: intPtr(8)})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated.Progress != 8 || !updated.SyncPending {
		t.Fatalf("the response must carry the change as pending, got %+v", updated)
	}

	listed, err := h.svc.Entries(ctx, MediaTypeAnime)
	if err != nil {
		t.Fatalf("entries: %v", err)
	}
	if entry := entryByRef(t, listed, "anilist:100"); entry.Progress != 8 || !entry.SyncPending {
		t.Fatalf("the list must show the pending change, got %+v", entry)
	}

	h.svc.flush(ctx)

	saves := fake.savedCalls()
	if len(saves) != 1 || saves[0]["progress"] != float64(8) {
		t.Fatalf("expected one save with progress 8, got %v", saves)
	}

	synced, err := h.svc.Entries(ctx, MediaTypeAnime)
	if err != nil {
		t.Fatalf("entries after sync: %v", err)
	}
	if entry := entryByRef(t, synced, "anilist:100"); entry.Progress != 8 || entry.SyncPending {
		t.Fatalf("after sync the entry is no longer pending, got %+v", entry)
	}
}

func TestOfflineChangeStaysQueued(t *testing.T) {
	fake := newSyncFake(t)
	h := newSyncHarness(t, fake.server.URL)
	h.signIn(t)
	ctx := context.Background()

	fake.server.Close()

	if _, err := h.svc.UpdateEntry(ctx, "anilist:100", EntryPatch{Progress: intPtr(9)}); err != nil {
		t.Fatalf("an update must be accepted without a network: %v", err)
	}

	h.svc.flush(ctx)

	pending, err := h.store.Outbox(ctx, 42)
	if err != nil {
		t.Fatalf("outbox: %v", err)
	}
	if len(pending) != 1 || pending[0].Attempts != 0 {
		t.Fatalf("an unreachable AniList must leave the change queued untouched, got %+v", pending)
	}

	listed, err := h.svc.Entries(ctx, MediaTypeAnime)
	if err != nil {
		t.Fatalf("entries offline: %v", err)
	}
	if entry := entryByRef(t, listed, "anilist:100"); entry.Progress != 9 || !entry.SyncPending {
		t.Fatalf("offline list must still show the change, got %+v", entry)
	}
}

func TestEditsToOneTitleCollapseIntoOneRequest(t *testing.T) {
	fake := newSyncFake(t)
	h := newSyncHarness(t, fake.server.URL)
	h.signIn(t)
	ctx := context.Background()

	for _, patch := range []EntryPatch{
		{Progress: intPtr(8)},
		{Progress: intPtr(9)},
		{Status: strPtr("PAUSED")},
	} {
		if _, err := h.svc.UpdateEntry(ctx, "anilist:100", patch); err != nil {
			t.Fatalf("update: %v", err)
		}
	}

	pending, err := h.store.Outbox(ctx, 42)
	if err != nil || len(pending) != 1 {
		t.Fatalf("three edits of one title are one queued change, got %d, %v", len(pending), err)
	}

	h.svc.flush(ctx)

	saves := fake.savedCalls()
	if len(saves) != 1 || saves[0]["progress"] != float64(9) || saves[0]["status"] != "PAUSED" {
		t.Fatalf("expected one merged save, got %v", saves)
	}
}

func TestStaleOfflineProgressNeverRollsBackAnotherDevice(t *testing.T) {
	fake := newSyncFake(t)
	h := newSyncHarness(t, fake.server.URL)
	h.signIn(t)
	ctx := context.Background()

	if _, err := h.svc.UpdateEntry(ctx, "anilist:100", EntryPatch{Progress: intPtr(8)}); err != nil {
		t.Fatalf("update: %v", err)
	}

	fake.mu.Lock()
	fake.remoteProgress = intPtr(12)
	fake.mu.Unlock()

	h.svc.flush(ctx)

	if saves := fake.savedCalls(); len(saves) != 0 {
		t.Fatalf("progress 8 must not overwrite 12 watched elsewhere, got saves %v", saves)
	}

	if pending, _ := h.store.Outbox(ctx, 42); len(pending) != 0 {
		t.Fatalf("a change with nothing left to send is done, got %+v", pending)
	}
}

func TestExplicitDecreaseIsStillSent(t *testing.T) {
	fake := newSyncFake(t)
	h := newSyncHarness(t, fake.server.URL)
	h.signIn(t)
	ctx := context.Background()

	if _, err := h.svc.UpdateEntry(ctx, "anilist:100", EntryPatch{Progress: intPtr(3)}); err != nil {
		t.Fatalf("update: %v", err)
	}

	fake.mu.Lock()
	fake.remoteProgress = intPtr(12)
	fake.mu.Unlock()

	h.svc.flush(ctx)

	saves := fake.savedCalls()
	if len(saves) != 1 || saves[0]["progress"] != float64(3) {
		t.Fatalf("lowering progress below what the user saw is deliberate and must be sent, got %v", saves)
	}
}

func TestSigningInAsSomeoneElseDropsPendingChanges(t *testing.T) {
	fake := newSyncFake(t)
	h := newSyncHarness(t, fake.server.URL)
	h.signIn(t)
	ctx := context.Background()

	if _, err := h.svc.UpdateEntry(ctx, "anilist:100", EntryPatch{Progress: intPtr(8)}); err != nil {
		t.Fatalf("update: %v", err)
	}

	fake.mu.Lock()
	fake.viewerID = 99
	fake.mu.Unlock()

	h.signIn(t)

	if pending, _ := h.store.Outbox(ctx, 42); len(pending) != 0 {
		t.Fatalf("another account must never replay these edits, got %+v", pending)
	}
}

func TestUpdateValidation(t *testing.T) {
	fake := newSyncFake(t)
	h := newSyncHarness(t, fake.server.URL)
	h.signIn(t)
	ctx := context.Background()

	cases := map[string]struct {
		ref   string
		patch EntryPatch
		kind  apperr.Kind
	}{
		"empty patch":       {"anilist:100", EntryPatch{}, apperr.KindInvalid},
		"unknown status":    {"anilist:100", EntryPatch{Status: strPtr("WATCHING")}, apperr.KindInvalid},
		"score above 100":   {"anilist:100", EntryPatch{Score: intPtr(101)}, apperr.KindInvalid},
		"foreign provider":  {"tmdb:5", EntryPatch{Progress: intPtr(1)}, apperr.KindInvalid},
		"title not in list": {"anilist:999", EntryPatch{Progress: intPtr(1)}, apperr.KindNotFound},
		"month out of range": {
			"anilist:100",
			EntryPatch{StartedAt: &Date{Year: intPtr(2024), Month: intPtr(13)}},
			apperr.KindInvalid,
		},
		"day without a month": {
			"anilist:100",
			EntryPatch{CompletedAt: &Date{Year: intPtr(2024), Day: intPtr(4)}},
			apperr.KindInvalid,
		},
		"the same list twice": {
			"anilist:100",
			EntryPatch{CustomLists: &[]string{"Favourites 2025", "Favourites 2025"}},
			apperr.KindInvalid,
		},
		"a list the account does not have": {
			"anilist:100",
			EntryPatch{CustomLists: &[]string{"Nowhere"}},
			apperr.KindInvalid,
		},
	}

	for name, tc := range cases {
		if _, err := h.svc.UpdateEntry(ctx, tc.ref, tc.patch); apperr.KindOf(err) != tc.kind {
			t.Errorf("%s: want %s, got %v", name, tc.kind, err)
		}
	}
}

func TestUpdateCarriesNotesDatesAndListsToAniList(t *testing.T) {
	fake := newSyncFake(t)
	h := newSyncHarness(t, fake.server.URL)
	h.signIn(t)
	ctx := context.Background()

	if _, err := h.svc.Entries(ctx, MediaTypeAnime); err != nil {
		t.Fatalf("entries: %v", err)
	}

	updated, err := h.svc.UpdateEntry(ctx, "anilist:100", EntryPatch{
		Notes:       strPtr("rewatch with friends"),
		StartedAt:   &Date{Year: intPtr(2024), Month: intPtr(3), Day: intPtr(9)},
		CompletedAt: &Date{},
		CustomLists: &[]string{"Favourites 2025"},
	})
	if err != nil {
		t.Fatalf("update: %v", err)
	}

	if updated.Notes != "rewatch with friends" {
		t.Fatalf("the response must carry the notes, got %q", updated.Notes)
	}

	if updated.StartedAt.Year == nil || *updated.StartedAt.Year != 2024 {
		t.Fatalf("the response must carry the start date, got %+v", updated.StartedAt)
	}

	if len(updated.CustomLists) != 1 || updated.CustomLists[0] != "Favourites 2025" {
		t.Fatalf("the response must carry the lists, got %v", updated.CustomLists)
	}

	h.svc.flush(ctx)

	saves := fake.savedCalls()
	if len(saves) != 1 {
		t.Fatalf("expected one save, got %v", saves)
	}

	save := saves[0]

	if save["notes"] != "rewatch with friends" {
		t.Fatalf("notes must reach anilist, got %v", save["notes"])
	}

	started, ok := save["startedAt"].(map[string]any)
	if !ok || started["year"] != float64(2024) || started["day"] != float64(9) {
		t.Fatalf("the start date must reach anilist, got %v", save["startedAt"])
	}

	completed, ok := save["completedAt"].(map[string]any)
	if !ok || completed["year"] != nil {
		t.Fatalf("an empty date must reach anilist as empty, got %v", save["completedAt"])
	}

	lists, ok := save["customLists"].([]any)
	if !ok || len(lists) != 1 || lists[0] != "Favourites 2025" {
		t.Fatalf("the lists must reach anilist, got %v", save["customLists"])
	}
}
