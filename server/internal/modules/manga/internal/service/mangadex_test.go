package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/mangadex"
	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/secrets"
	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/db"
)

const (
	berserkDex = "801513ba-a712-498c-8f57-cae55b38cc92"
	prologue   = "6310f6a1-17ee-4890-b837-2ec1b372905b"
)

type dexHarness struct {
	svc       *Service
	requests  atomic.Int32
	atHomes   atomic.Int32
	failPages atomic.Int32
}

// newDexHarness runs the service against a fake MangaDex that answers with the
// responses recorded from the real API.
func newDexHarness(t *testing.T) *dexHarness {
	t.Helper()

	h := &dexHarness{}
	read := func(name string) []byte {
		data, err := os.ReadFile(filepath.Join("..", "mangadex", "testdata", name))
		if err != nil {
			t.Fatal(err)
		}

		return data
	}

	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/node/") && r.URL.Path != "/report" {
			h.requests.Add(1)
		}

		switch {
		case r.URL.Path == "/manga":
			_, _ = w.Write(read("search.json"))
		case strings.HasSuffix(r.URL.Path, "/feed"):
			var feed map[string]any
			_ = json.Unmarshal(read("feed.json"), &feed)
			feed["total"] = 6
			_ = json.NewEncoder(w).Encode(feed)
		case strings.HasPrefix(r.URL.Path, "/chapter/"):
			_, _ = w.Write(read("chapter.json"))
		case strings.HasPrefix(r.URL.Path, "/at-home/server/"):
			h.atHomes.Add(1)
			var home map[string]any
			_ = json.Unmarshal(read("at-home.json"), &home)
			home["baseUrl"] = srv.URL + "/node"
			_ = json.NewEncoder(w).Encode(home)
		case strings.HasPrefix(r.URL.Path, "/node/"):
			if h.failPages.Load() > 0 {
				h.failPages.Add(-1)
				w.WriteHeader(http.StatusBadGateway)
				return
			}
			w.Header().Set("Content-Type", "image/jpeg")
			_, _ = w.Write([]byte{0xff, 0xd8, 0xff})
		}
	}))
	t.Cleanup(srv.Close)

	ctx := context.Background()
	dir := t.TempDir()

	database, err := db.Open(ctx, filepath.Join(dir, "node.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = database.Close() })
	if err := db.Migrate(ctx, database, zerolog.Nop()); err != nil {
		t.Fatal(err)
	}

	client := mangadex.New(mangadex.Options{Endpoint: srv.URL, ReportEndpoint: srv.URL + "/report", Timeout: 5 * time.Second, UserAgent: "test"})
	h.svc = New(store.New(database), secrets.New(filepath.Join(dir, "s.json")), zerolog.Nop(), Options{MangaDex: client})

	return h
}

func TestMangaDexIsOffUntilTheUserTurnsItOn(t *testing.T) {
	h := newDexHarness(t)
	ctx := context.Background()

	if _, err := h.svc.Search(ctx, SourceMangaDex, "berserk", ""); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Errorf("search while off: %v", err)
	}
	if _, _, err := h.svc.MangaDexPage(ctx, prologue, 0); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Errorf("page while off: %v", err)
	}
	if h.requests.Load() != 0 {
		t.Errorf("%d requests went to MangaDex while it was off", h.requests.Load())
	}

	sources, err := h.svc.Sources(ctx)
	if err != nil || len(sources) != 0 {
		t.Errorf("sources while off = %+v, %v", sources, err)
	}
}

func TestMangaDexSettingsCheckTheirLanguages(t *testing.T) {
	h := newDexHarness(t)

	for _, languages := range [][]string{{}, {"english"}, {"en", "../x"}} {
		if _, err := h.svc.SetMangaDexSettings(context.Background(), true, languages); apperr.KindOf(err) != apperr.KindInvalid {
			t.Errorf("languages %v: %v", languages, err)
		}
	}

	settings, err := h.svc.SetMangaDexSettings(context.Background(), true, []string{" UK ", "en", "uk"})
	if err != nil || !settings.Enabled || strings.Join(settings.Languages, ",") != "uk,en" {
		t.Errorf("settings = %+v, %v", settings, err)
	}
}

func TestAMangaDexTitleIsFoundLinkedAndRead(t *testing.T) {
	h := newDexHarness(t)
	ctx := context.Background()

	if _, err := h.svc.SetMangaDexSettings(ctx, true, []string{"en"}); err != nil {
		t.Fatal(err)
	}

	hits, err := h.svc.Search(ctx, SourceMangaDex, "berserk", "anilist:30002")
	if err != nil || len(hits) == 0 || hits[0].ID != berserkDex || !hits[0].Matched {
		t.Fatalf("hits = %+v, %v", hits, err)
	}

	if err = h.svc.SetLink(ctx, "anilist:30002", SourceMangaDex, "not-an-id", "Berserk"); apperr.KindOf(err) != apperr.KindInvalid {
		t.Errorf("link to a non-id: %v", err)
	}
	if err = h.svc.SetLink(ctx, "anilist:30002", SourceMangaDex, berserkDex, "Berserk"); err != nil {
		t.Fatal(err)
	}

	chapters, problems, err := h.svc.Chapters(ctx, "anilist:30002")
	if err != nil || len(problems) != 0 || len(chapters) != 6 {
		t.Fatalf("chapters = %d, problems = %+v, err = %v", len(chapters), problems, err)
	}

	first := chapters[0]
	if first.Ref != "mangadex:"+prologue || first.Number != "0.01" || first.Language != "en" ||
		first.SourceName != "MangaDex" || len(first.Groups) != 1 {
		t.Errorf("first = %+v", first)
	}

	chapter, err := h.svc.MangaDexChapter(ctx, prologue)
	if err != nil || chapter.MediaRef != "anilist:30002" || chapter.Title != "Berserk" || chapter.Pages != 94 {
		t.Fatalf("chapter = %+v, %v", chapter, err)
	}

	// Turning pages reuses the page server MangaDex named for the chapter.
	for page := range 3 {
		if _, _, err := h.svc.MangaDexPage(ctx, prologue, page); err != nil {
			t.Fatalf("page %d: %v", page, err)
		}
	}
	if h.atHomes.Load() != 1 {
		t.Errorf("asked for the page server %d times, want once", h.atHomes.Load())
	}

	// A page server that fails is replaced once.
	h.failPages.Store(1)
	if _, _, err := h.svc.MangaDexPage(ctx, prologue, 3); err != nil {
		t.Errorf("page after a failing node: %v", err)
	}
	if h.atHomes.Load() != 2 {
		t.Errorf("asked for the page server %d times, want a second after the failure", h.atHomes.Load())
	}
}
