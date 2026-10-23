package gutenberg

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/source"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/db"
	pg "github.com/mediaryorg/mediary-node/server/internal/platform/sources/gutenberg"
)

const catalogModified = "Sun, 18 Oct 2026 21:30:58 GMT"

// fakeSite is Gutenberg's site: the catalogue and one book.
type fakeSite struct {
	*httptest.Server

	mu       sync.Mutex
	paths    []string
	catalog  []byte
	status   int
	modified string
	// hold, while open, keeps the catalogue from being sent.
	hold chan struct{}
}

func newFakeSite(t *testing.T) *fakeSite {
	t.Helper()

	site := &fakeSite{catalog: catalogFile(t, catalogHeader, catalogRows, minCatalogBooks), modified: catalogModified}
	site.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if site.hold != nil {
			<-site.hold
		}

		site.mu.Lock()
		defer site.mu.Unlock()

		site.paths = append(site.paths, r.URL.Path)

		switch {
		case site.status != 0:
			w.WriteHeader(site.status)
		case r.URL.Path == "/cache/epub/feeds/pg_catalog.csv.gz":
			if r.Header.Get("If-Modified-Since") == site.modified {
				w.WriteHeader(http.StatusNotModified)
				return
			}
			w.Header().Set("Last-Modified", site.modified)
			_, _ = w.Write(site.catalog)
		case r.URL.Path == "/cache/epub/84/pg84-images-3.epub":
			_, _ = io.WriteString(w, "PK\x03\x04frankenstein")
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(site.Close)

	return site
}

func (s *fakeSite) requests() []string {
	s.mu.Lock()
	defer s.mu.Unlock()

	return append([]string(nil), s.paths...)
}

func (s *fakeSite) fail(status int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.status = status
}

type clock struct {
	mu  sync.Mutex
	now time.Time
}

// tick moves time on a minute at every reading, so each stamp is later than the
// one before.
func (c *clock) tick() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.now = c.now.Add(time.Minute)

	return c.now
}

func newGutenberg(t *testing.T, site *fakeSite) *Gutenberg {
	t.Helper()

	ctx := context.Background()

	database, err := db.Open(ctx, filepath.Join(t.TempDir(), "node.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = database.Close() })

	if err = db.Migrate(ctx, database, zerolog.Nop()); err != nil {
		t.Fatal(err)
	}

	client, err := pg.New(pg.Options{Endpoint: site.URL, MinInterval: time.Millisecond})
	if err != nil {
		t.Fatal(err)
	}

	clock := &clock{now: time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)}
	g := New(Options{DB: database, Client: client, Logger: zerolog.Nop(), Now: clock.tick})

	runCtx, cancel := context.WithCancel(ctx)
	t.Cleanup(cancel)
	g.Start(runCtx)

	return g
}

// settle returns the settings once no download or check is under way.
func settle(t *testing.T, g *Gutenberg, done func(*Settings) bool) *Settings {
	t.Helper()

	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		settings, err := g.Settings(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		if !settings.Syncing && done(settings) {
			return settings
		}

		time.Sleep(10 * time.Millisecond)
	}

	settings, _ := g.Settings(context.Background())
	t.Fatalf("settings did not settle: %+v", settings)

	return nil
}

func frankenstein() source.Query {
	return source.Query{Title: "Frankenstein", Authors: []string{"Mary Shelley"}}
}

func TestOffUntilTheUserTurnsItOn(t *testing.T) {
	site := newFakeSite(t)
	g := newGutenberg(t, site)
	ctx := context.Background()

	time.Sleep(50 * time.Millisecond)

	if requests := site.requests(); len(requests) != 0 {
		t.Errorf("asked the site %v while off", requests)
	}
	if g.Enabled(ctx) {
		t.Error("on by default")
	}
	if _, err := g.Refresh(ctx); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Errorf("refresh while off: %v", err)
	}
}

func TestTurnedOnItDownloadsTheCatalogueAndSearchesItAtHome(t *testing.T) {
	site := newFakeSite(t)
	site.hold = make(chan struct{})
	g := newGutenberg(t, site)
	ctx := context.Background()

	settings, err := g.SetEnabled(ctx, true)
	if err != nil {
		t.Fatal(err)
	}
	if !settings.Enabled || !settings.Syncing {
		t.Errorf("just turned on: %+v", settings)
	}
	close(site.hold)

	settings = settle(t, g, func(s *Settings) bool { return s.Books > 0 })
	if settings.Books != 3+minCatalogBooks || settings.UpdatedAt.IsZero() || settings.CheckedAt.IsZero() || settings.Error != "" {
		t.Fatalf("settings = %+v", settings)
	}

	before := len(site.requests())

	editions, err := g.Search(ctx, frankenstein())
	if err != nil {
		t.Fatal(err)
	}
	if len(editions) != 1 || editions[0].Ref != "gutenberg:84" ||
		editions[0].Authors[0] != "Mary Wollstonecraft Shelley" || editions[0].Language != "en" ||
		len(editions[0].Formats) != 1 || editions[0].Formats[0].Ext != ".epub" {
		t.Fatalf("editions = %+v", editions)
	}

	// Another author's book of the same name is not this one.
	if editions, _ = g.Search(ctx, source.Query{Title: "Frankenstein", Authors: []string{"Mary Robinette Kowal"}}); len(editions) != 0 {
		t.Errorf("by another author: %+v", editions)
	}

	if after := site.requests(); len(after) != before {
		t.Errorf("searching asked the site %v", after[before:])
	}

	body, err := g.Open(ctx, "gutenberg:84", "anywhere/else")
	if err != nil {
		t.Fatal(err)
	}
	data, _ := io.ReadAll(body)
	_ = body.Close()

	// The address is the book's number on the site, not the location given.
	if requests := site.requests(); string(data) != "PK\x03\x04frankenstein" ||
		requests[len(requests)-1] != "/cache/epub/84/pg84-images-3.epub" {
		t.Errorf("read %q via %v", data, requests)
	}

	if _, err = g.Open(ctx, "gutenberg:../84", ""); apperr.KindOf(err) != apperr.KindInvalid {
		t.Errorf("a reference that is not a number: %v", err)
	}
}

func TestAnUnchangedCatalogueIsNotDownloadedAgain(t *testing.T) {
	site := newFakeSite(t)
	g := newGutenberg(t, site)
	ctx := context.Background()

	if _, err := g.SetEnabled(ctx, true); err != nil {
		t.Fatal(err)
	}
	first := settle(t, g, func(s *Settings) bool { return s.Books > 0 })

	if _, err := g.Refresh(ctx); err != nil {
		t.Fatal(err)
	}
	second := settle(t, g, func(s *Settings) bool { return s.CheckedAt.After(first.CheckedAt) })

	if !second.UpdatedAt.Equal(first.UpdatedAt) || second.Books != first.Books {
		t.Errorf("before %+v, after %+v", first, second)
	}

	// A new week's catalogue replaces the old one.
	site.mu.Lock()
	site.modified = "Sun, 25 Oct 2026 21:30:00 GMT"
	site.catalog = catalogFile(t, catalogHeader, catalogRows, minCatalogBooks+5)
	site.mu.Unlock()

	if _, err := g.Refresh(ctx); err != nil {
		t.Fatal(err)
	}
	third := settle(t, g, func(s *Settings) bool { return s.UpdatedAt.After(first.UpdatedAt) })

	if third.Books != first.Books+5 {
		t.Errorf("after a new catalogue: %+v", third)
	}
}

func TestTurnedOffTheCatalogueIsRemoved(t *testing.T) {
	site := newFakeSite(t)
	g := newGutenberg(t, site)
	ctx := context.Background()

	if _, err := g.SetEnabled(ctx, true); err != nil {
		t.Fatal(err)
	}
	settle(t, g, func(s *Settings) bool { return s.Books > 0 })

	settings, err := g.SetEnabled(ctx, false)
	if err != nil {
		t.Fatal(err)
	}
	if settings.Enabled || settings.Books != 0 || !settings.UpdatedAt.IsZero() || !settings.CheckedAt.IsZero() {
		t.Errorf("settings = %+v", settings)
	}

	if _, err = g.Search(ctx, frankenstein()); apperr.KindOf(err) != apperr.KindUnavailable {
		t.Errorf("searching a removed catalogue: %v", err)
	}

	// On again, it comes back whole.
	if _, err = g.SetEnabled(ctx, true); err != nil {
		t.Fatal(err)
	}
	settle(t, g, func(s *Settings) bool { return s.Books > 0 })

	if editions, _ := g.Search(ctx, frankenstein()); len(editions) != 1 {
		t.Errorf("editions = %+v", editions)
	}
}

func TestABusySiteIsReported(t *testing.T) {
	site := newFakeSite(t)
	site.fail(http.StatusTooManyRequests)
	g := newGutenberg(t, site)
	ctx := context.Background()

	if _, err := g.SetEnabled(ctx, true); err != nil {
		t.Fatal(err)
	}

	settings := settle(t, g, func(s *Settings) bool { return s.Error != "" })
	if settings.Books != 0 || !strings.Contains(settings.Error, "asked to wait") {
		t.Errorf("settings = %+v", settings)
	}

	_, err := g.Search(ctx, frankenstein())
	if apperr.KindOf(err) != apperr.KindUnavailable || !strings.Contains(err.Error(), "asked to wait") {
		t.Errorf("searching without a catalogue: %v", err)
	}

	// Asked once, not again and again.
	time.Sleep(50 * time.Millisecond)
	if requests := site.requests(); len(requests) != 1 {
		t.Errorf("requests = %v", requests)
	}

	// The user can ask again; it works once the site does.
	site.fail(0)
	if _, err = g.Refresh(ctx); err != nil {
		t.Fatal(err)
	}
	if settings = settle(t, g, func(s *Settings) bool { return s.Books > 0 }); settings.Error != "" {
		t.Errorf("settings = %+v", settings)
	}
}

func TestDue(t *testing.T) {
	now := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)

	for _, tc := range []struct {
		name  string
		state syncState
		count int64
		want  bool
	}{
		{"never downloaded", syncState{}, 0, true},
		{"checked this week", syncState{CheckedAt: now.Add(-6 * 24 * time.Hour)}, 10, false},
		{"checked a week ago", syncState{CheckedAt: now.Add(-7 * 24 * time.Hour)}, 10, true},
		{"first download failed just now", syncState{Error: "busy", AttemptedAt: now.Add(-time.Minute)}, 0, false},
		{"first download failed an hour ago", syncState{Error: "busy", AttemptedAt: now.Add(-time.Hour)}, 0, true},
		{"weekly check failed an hour ago", syncState{Error: "busy", AttemptedAt: now.Add(-time.Hour)}, 10, false},
		{"weekly check failed six hours ago", syncState{Error: "busy", AttemptedAt: now.Add(-6 * time.Hour)}, 10, true},
	} {
		if got := due(tc.state, tc.count, now); got != tc.want {
			t.Errorf("%s: due = %v", tc.name, got)
		}
	}
}
