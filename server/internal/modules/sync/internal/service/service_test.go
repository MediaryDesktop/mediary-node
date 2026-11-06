package service

import (
	"bytes"
	"compress/gzip"
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/sync/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/backup"
	"github.com/mediaryorg/mediary-node/server/internal/platform/cloud"
	"github.com/mediaryorg/mediary-node/server/internal/platform/db"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
	"github.com/mediaryorg/mediary-node/server/internal/platform/secrets"
)

const pairingCode = "K7QM-4XPA"

// fakeCloud speaks just enough of the cloud API for the node: pairing,
// upload with per-device deduplication, list and download.
type fakeCloud struct {
	mu      sync.Mutex
	tokens  map[string]string // token → device id
	backups []fakeBackup
	revoked bool
	serve   []byte // when set, every download returns these bytes
}

type fakeBackup struct {
	id, device, sha string
	body            []byte
	created         time.Time
}

func (f *fakeCloud) handler(t *testing.T) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("POST /v1/devices/exchange", func(w http.ResponseWriter, r *http.Request) {
		var in struct{ Code, Label string }
		_ = json.NewDecoder(r.Body).Decode(&in)

		if in.Code != pairingCode {
			problem(w, http.StatusUnauthorized, "pairing code is invalid, expired or already used")
			return
		}

		f.mu.Lock()
		device, token := uuid.NewString(), uuid.NewString()
		f.tokens[token] = device
		f.mu.Unlock()

		reply(w, http.StatusCreated, map[string]any{
			"device_token": token,
			"device": map[string]any{
				"id": device, "label": in.Label,
				"created_at": time.Now(), "last_seen_at": time.Now(), "expires_at": time.Now().Add(time.Hour),
			},
		})
	})

	mux.HandleFunc("POST /v1/backups", func(w http.ResponseWriter, r *http.Request) {
		device, ok := f.device(r)
		if !ok {
			problem(w, http.StatusUnauthorized, "device token is invalid, expired or revoked")
			return
		}

		body, _ := io.ReadAll(r.Body)
		sha := r.Header.Get("X-Backup-Sha256")

		if backup.Hash(body) != sha {
			t.Errorf("node sent a body that does not match its declared hash")
		}

		f.mu.Lock()
		defer f.mu.Unlock()

		for i := len(f.backups) - 1; i >= 0; i-- {
			if f.backups[i].device == device {
				if f.backups[i].sha == sha {
					reply(w, http.StatusOK, backupJSON(f.backups[i]))
					return
				}

				break
			}
		}

		b := fakeBackup{id: uuid.NewString(), device: device, sha: sha, body: body, created: time.Now()}
		f.backups = append(f.backups, b)

		reply(w, http.StatusCreated, backupJSON(b))
	})

	mux.HandleFunc("GET /v1/backups", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := f.device(r); !ok {
			problem(w, http.StatusUnauthorized, "device token is invalid, expired or revoked")
			return
		}

		f.mu.Lock()
		defer f.mu.Unlock()

		list := make([]any, 0, len(f.backups))
		for i := len(f.backups) - 1; i >= 0; i-- {
			list = append(list, backupJSON(f.backups[i]))
		}

		reply(w, http.StatusOK, map[string]any{"backups": list})
	})

	mux.HandleFunc("GET /v1/backups/{id}", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := f.device(r); !ok {
			problem(w, http.StatusUnauthorized, "device token is invalid, expired or revoked")
			return
		}

		f.mu.Lock()
		defer f.mu.Unlock()

		if f.serve != nil {
			w.Header().Set("X-Backup-Sha256", backup.Hash(f.serve))
			_, _ = w.Write(f.serve)
			return
		}

		for _, b := range f.backups {
			if b.id == r.PathValue("id") {
				w.Header().Set("Content-Type", "application/octet-stream")
				w.Header().Set("X-Backup-Sha256", b.sha)
				_, _ = w.Write(b.body)
				return
			}
		}

		problem(w, http.StatusNotFound, "backup not found")
	})

	return mux
}

func (f *fakeCloud) device(r *http.Request) (string, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if f.revoked {
		return "", false
	}

	device, ok := f.tokens[r.Header.Get(cloud.DeviceTokenHeader)]

	return device, ok
}

func backupJSON(b fakeBackup) map[string]any {
	return map[string]any{
		"id": b.id, "device_id": b.device, "device_label": "test", "created_at": b.created,
		"size_bytes": len(b.body), "sha256": b.sha, "format_version": 1,
	}
}

func reply(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func problem(w http.ResponseWriter, status int, detail string) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"status": status, "detail": detail})
}

// memoryPart stands in for the modules' backup parts: the sync module's job is
// to run them and move the bytes, whatever tables they own. Like a real part
// it changes nothing until the transaction commits — its finish applies the
// restored document only then.
type memoryPart struct {
	mu  sync.Mutex
	doc backup.Document
}

func (p *memoryPart) Snapshot(_ context.Context, _ *sql.Tx, doc *backup.Document) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	doc.TrackerEntries = append([]backup.TrackerEntry{}, p.doc.TrackerEntries...)
	doc.CustomLists = append([]backup.CustomList{}, p.doc.CustomLists...)
	doc.CustomListItems = append([]backup.CustomListItem{}, p.doc.CustomListItems...)
	doc.ListIcons = append([]backup.ListIcon{}, p.doc.ListIcons...)
	doc.ManualTitles = append([]backup.ManualTitle(nil), p.doc.ManualTitles...)

	return nil
}

func (p *memoryPart) Restore(_ context.Context, _ *sql.Tx, doc *backup.Document) (func(bool), error) {
	restored := *doc

	return func(committed bool) {
		if !committed {
			return
		}

		p.mu.Lock()
		p.doc = restored
		p.mu.Unlock()
	}, nil
}

func (p *memoryPart) document() backup.Document {
	p.mu.Lock()
	defer p.mu.Unlock()

	return p.doc
}

type node struct {
	svc     *Service
	part    *memoryPart
	dataDir string
}

func newNode(t *testing.T, cloudURL string) *node {
	t.Helper()

	ctx := context.Background()
	dir := t.TempDir()

	database, err := db.Open(ctx, filepath.Join(dir, "node.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = database.Close() })

	if migrateErr := db.Migrate(ctx, database, zerolog.Nop()); migrateErr != nil {
		t.Fatal(migrateErr)
	}

	client, err := cloud.New(cloud.Options{BaseURL: cloudURL})
	if err != nil {
		t.Fatal(err)
	}

	part := &memoryPart{}

	svc := New(Deps{
		Store:     store.New(database, part),
		Logger:    zerolog.Nop(),
		Hub:       events.NewHub(64),
		Cloud:     client,
		Secrets:   secrets.New(filepath.Join(dir, "cloud-secrets.json")),
		SafetyDir: filepath.Join(dir, "pre-restore"),
		Label:     "test-node",
	})

	return &node{svc: svc, part: part, dataDir: dir}
}

// count is how many records of one kind the node holds, by the table the
// tracker keeps them in.
func (n *node) count(t *testing.T, table string) int {
	t.Helper()

	doc := n.part.document()

	switch table {
	case "tracker_entry":
		return len(doc.TrackerEntries)
	case "custom_list":
		return len(doc.CustomLists)
	case "custom_list_item":
		return len(doc.CustomListItems)
	case "list_icon":
		return len(doc.ListIcons)
	case "manual_title":
		return len(doc.ManualTitles)
	}

	t.Fatalf("no such kind of record: %s", table)

	return 0
}

func (n *node) seed(t *testing.T) {
	t.Helper()

	year := int64(2026)

	n.part.mu.Lock()
	defer n.part.mu.Unlock()

	n.part.doc = backup.Document{
		TrackerEntries: []backup.TrackerEntry{
			{
				MediaRef: "openlibrary:OL893414W", MediaType: "book", Status: "CURRENT",
				CreatedAt: 3, UpdatedAt: 4,
			},
			{
				MediaRef: "tmdb:movie:438631", MediaType: "movie", Status: "COMPLETED",
				Score: 90, Progress: 1, Notes: "rewatch", CompletedYear: &year, CreatedAt: 1, UpdatedAt: 2,
			},
		},
		CustomLists:     []backup.CustomList{{ID: 7, MediaType: "book", Name: "Sci-fi", Position: 0, CreatedAt: 5}},
		CustomListItems: []backup.CustomListItem{{ListID: 7, MediaRef: "openlibrary:OL893414W", Position: 0, AddedAt: 6}},
		ListIcons:       []backup.ListIcon{{ListID: "local:7", Icon: "rocket"}},
	}
}

func newCloud(t *testing.T) (fake *fakeCloud, url string) {
	t.Helper()

	fake = &fakeCloud{tokens: map[string]string{}}
	server := httptest.NewServer(fake.handler(t))
	t.Cleanup(server.Close)

	return fake, server.URL
}

func TestPairBackUpAndRestoreOnAnotherNode(t *testing.T) {
	ctx := context.Background()
	fake, url := newCloud(t)

	home := newNode(t, url)
	home.seed(t)

	if _, err := home.svc.Pair(ctx, "wrong-code"); apperr.KindOf(err) != apperr.KindUnauthorized {
		t.Fatalf("a wrong code should be refused as unauthorized, got %v", err)
	}

	if _, err := home.svc.BackupNow(ctx); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("backing up before pairing should ask for pairing, got %v", err)
	}

	paired, err := home.svc.Pair(ctx, pairingCode)
	if err != nil {
		t.Fatal(err)
	}

	if paired.Label != "test-node" || !home.svc.Status().Linked || home.svc.Status().DeviceID != paired.DeviceID {
		t.Fatalf("pairing did not take effect: %+v, %+v", paired, home.svc.Status())
	}

	saved, err := os.ReadFile(filepath.Join(home.dataDir, "cloud-secrets.json"))
	if err != nil || !strings.Contains(string(saved), DeviceTokenSecret) {
		t.Fatalf("the device token was not saved: %v %s", err, saved)
	}

	first, err := home.svc.BackupNow(ctx)
	if err != nil || !first.Created {
		t.Fatalf("first backup: %+v, %v", first, err)
	}

	again, err := home.svc.BackupNow(ctx)
	if err != nil || again.Created || again.Backup.Id != first.Backup.Id {
		t.Fatalf("an unchanged state should not be stored again: %+v, %v", again, err)
	}

	listed, err := home.svc.List(ctx)
	if err != nil || len(listed) != 1 {
		t.Fatalf("list: %+v, %v", listed, err)
	}

	laptop := newNode(t, url)
	laptop.part.doc = backup.Document{TrackerEntries: []backup.TrackerEntry{
		{MediaRef: "tmdb:tv:1399", MediaType: "series", Status: "PLANNING", CreatedAt: 1, UpdatedAt: 1},
	}}

	if _, pairErr := laptop.svc.Pair(ctx, pairingCode); pairErr != nil {
		t.Fatal(pairErr)
	}

	if restoreErr := laptop.svc.Restore(ctx, first.Backup.Id); restoreErr != nil {
		t.Fatal(restoreErr)
	}

	for table, want := range map[string]int{
		"tracker_entry": 2, "custom_list": 1, "custom_list_item": 1, "list_icon": 1,
	} {
		if got := laptop.count(t, table); got != want {
			t.Errorf("%s after restore: %d rows, want %d", table, got, want)
		}
	}

	restored := laptop.part.document()
	original := home.part.document()

	a, _ := backup.Encode(original)
	b, _ := backup.Encode(restored)

	if !bytes.Equal(a.Body, b.Body) {
		t.Fatal("the restored state differs from the backed-up one")
	}

	copies, _ := filepath.Glob(filepath.Join(laptop.dataDir, "pre-restore", "pre-restore-*.json.gz"))
	if len(copies) != 1 {
		t.Fatalf("restore should keep one copy of the replaced state, found %d", len(copies))
	}

	body, _ := os.ReadFile(copies[0])

	replaced, err := backup.Decode(body)
	if err != nil || len(replaced.TrackerEntries) != 1 || replaced.TrackerEntries[0].MediaRef != "tmdb:tv:1399" {
		t.Fatalf("the safety copy does not hold the replaced state: %+v, %v", replaced, err)
	}

	fake.mu.Lock()
	fake.revoked = true
	fake.mu.Unlock()

	if _, err := home.svc.BackupNow(ctx); apperr.KindOf(err) != apperr.KindUnauthorized {
		t.Fatalf("a revoked token should be refused, got %v", err)
	}

	if home.svc.Status().Linked {
		t.Fatal("a node whose token was revoked should report itself unpaired")
	}
}

func TestPairingAnEmptyNodeRestoresTheNewestBackup(t *testing.T) {
	ctx := context.Background()
	_, url := newCloud(t)

	home := newNode(t, url)
	home.seed(t)

	if _, err := home.svc.Pair(ctx, pairingCode); err != nil {
		t.Fatal(err)
	}

	if _, err := home.svc.BackupNow(ctx); err != nil {
		t.Fatal(err)
	}

	fresh := newNode(t, url)

	if _, err := fresh.svc.Pair(ctx, pairingCode); err != nil {
		t.Fatal(err)
	}

	for table, want := range map[string]int{
		"tracker_entry": 2, "custom_list": 1, "custom_list_item": 1, "list_icon": 1,
	} {
		if got := fresh.count(t, table); got != want {
			t.Errorf("%s after pairing an empty node: %d rows, want %d", table, got, want)
		}
	}
}

func TestRestoreRefusesANewerFormatAndKeepsTheState(t *testing.T) {
	ctx := context.Background()
	fake, url := newCloud(t)

	n := newNode(t, url)
	n.seed(t)

	if _, err := n.svc.Pair(ctx, pairingCode); err != nil {
		t.Fatal(err)
	}

	var buf bytes.Buffer
	writer := gzip.NewWriter(&buf)
	_, _ = writer.Write([]byte(`{"format_version": 99, "tracker_entries": []}`))
	_ = writer.Close()

	fake.serve = buf.Bytes()

	err := n.svc.Restore(ctx, uuid.New())
	if apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("a newer snapshot should be refused with a precondition, got %v", err)
	}

	if n.count(t, "tracker_entry") != 2 {
		t.Fatal("a refused restore changed the local state")
	}
}

func TestDue(t *testing.T) {
	_, url := newCloud(t)
	n := newNode(t, url)
	now := time.Now()

	if n.svc.due(now) {
		t.Fatal("an unpaired node is never due")
	}

	n.svc.cloud.SetDeviceToken("token")

	n.svc.lastAttempt = now
	n.svc.lastChange = now.Add(-time.Minute)

	if n.svc.due(now) {
		t.Fatal("a change older than the last attempt is not due")
	}

	n.svc.lastChange = now.Add(time.Second)

	if n.svc.due(now.Add(time.Minute)) {
		t.Fatal("a change is not due before the quiet period")
	}

	if !n.svc.due(now.Add(quietPeriod + 2*time.Second)) {
		t.Fatal("a change is due once it has settled")
	}

	n.svc.lastChange = time.Time{}

	if !n.svc.due(now.Add(dailyFloor + time.Second)) {
		t.Fatal("the state is offered at least once a day")
	}
}

// A node holding only manual titles is not empty: pairing it must not replace
// them with the account's backup.
func TestPairingANodeWithOnlyManualTitlesKeepsThem(t *testing.T) {
	ctx := context.Background()
	_, url := newCloud(t)

	home := newNode(t, url)
	home.seed(t)

	if _, err := home.svc.Pair(ctx, pairingCode); err != nil {
		t.Fatal(err)
	}

	if _, err := home.svc.BackupNow(ctx); err != nil {
		t.Fatal(err)
	}

	own := newNode(t, url)
	own.part.doc = backup.Document{ManualTitles: []backup.ManualTitle{
		{ID: "0123456789abcdef0123", MediaType: "anime", Details: `{}`, CreatedAt: 1, UpdatedAt: 1},
	}}

	if _, err := own.svc.Pair(ctx, pairingCode); err != nil {
		t.Fatal(err)
	}

	if own.count(t, "manual_title") != 1 || own.count(t, "tracker_entry") != 0 {
		t.Fatalf("pairing replaced a node that held manual titles: %+v", own.part.document())
	}
}
