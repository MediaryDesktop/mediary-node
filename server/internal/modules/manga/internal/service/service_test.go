package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/opds"
	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/secrets"
	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/db"
)

type harness struct {
	svc       *Service
	passwords *secrets.Store
	catalogue string
}

func newHarness(t *testing.T) *harness {
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

	passwords := secrets.New(filepath.Join(dir, "opds-secrets.json"))
	svc := New(store.New(database), passwords, zerolog.Nop(), Options{Client: opds.New(5*time.Second, "test")})

	return &harness{svc: svc, passwords: passwords, catalogue: komga(t) + "/opds/v1.2/catalog"}
}

// komga serves the feeds recorded from a real Komga to the user reader/secret.
func komga(t *testing.T) string {
	t.Helper()

	read := func(name string) string {
		data, err := os.ReadFile(filepath.Join("..", "opds", "testdata", "komga", name))
		if err != nil {
			t.Fatal(err)
		}

		return string(data)
	}

	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if user, pass, ok := r.BasicAuth(); !ok || user != "reader" || pass != "secret" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		feeds := map[string]string{
			"/opds/v1.2/catalog":              "catalog.xml",
			"/opds/v1.2/search":               "opensearch.xml",
			"/opds/v1.2/series":               "search.xml",
			"/opds/v1.2/series/0RTZ92JHQ80P8": "series.xml",
		}

		if name, ok := feeds[r.URL.Path]; ok {
			_, _ = w.Write([]byte(strings.ReplaceAll(read(name), "http://komga.test", srv.URL)))
			return
		}
		if strings.Contains(r.URL.Path, "/pages/") {
			w.Header().Set("Content-Type", "image/png")
			_, _ = w.Write([]byte("page " + r.URL.Path))
			return
		}

		http.NotFound(w, r)
	}))
	t.Cleanup(srv.Close)

	return srv.URL
}

func ptr(s string) *string { return &s }

func TestTheServerPasswordIsKeptButNeverShown(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	server, err := h.svc.CreateServer(ctx, ServerInput{Name: " Komga ", URL: h.catalogue, Username: "reader", Password: ptr("secret")})
	if err != nil {
		t.Fatal(err)
	}
	if server.Name != "Komga" || !server.HasPassword {
		t.Errorf("server = %+v", server)
	}

	if stored, _ := h.passwords.Password(server.ID); stored != "secret" {
		t.Errorf("stored password = %q", stored)
	}

	// A change that does not mention the password keeps it.
	if _, err = h.svc.UpdateServer(ctx, server.ID, ServerInput{Name: "NAS", URL: h.catalogue, Username: "reader"}); err != nil {
		t.Fatal(err)
	}
	if stored, _ := h.passwords.Password(server.ID); stored != "secret" {
		t.Errorf("password after rename = %q", stored)
	}
}

func TestAnAddressMustBeAWebAddressWithoutCredentials(t *testing.T) {
	h := newHarness(t)

	for _, address := range []string{"", "nas:25600", "ftp://nas/opds", "http://reader:secret@nas/opds"} {
		_, err := h.svc.CreateServer(context.Background(), ServerInput{Name: "x", URL: address})
		if apperr.KindOf(err) != apperr.KindInvalid {
			t.Errorf("CreateServer(%q) error = %v, want invalid", address, err)
		}
	}
}

func TestCheckNamesTheProblemAndUsesTheStoredPassword(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	wrong, err := h.svc.CheckServer(ctx, CheckInput{URL: h.catalogue, Username: "reader", Password: ptr("nope")})
	if err != nil || wrong.OK || wrong.Problem != "unauthorized" {
		t.Errorf("wrong password = %+v, %v", wrong, err)
	}

	server, err := h.svc.CreateServer(ctx, ServerInput{Name: "Komga", URL: h.catalogue, Username: "reader", Password: ptr("secret")})
	if err != nil {
		t.Fatal(err)
	}

	stored, err := h.svc.CheckServer(ctx, CheckInput{ServerID: &server.ID, URL: h.catalogue, Username: "reader"})
	if err != nil || !stored.OK {
		t.Errorf("stored password = %+v, %v", stored, err)
	}
}

func TestALinkedSeriesListsChaptersTheReaderCanOpen(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	server, err := h.svc.CreateServer(ctx, ServerInput{Name: "Komga", URL: h.catalogue, Username: "reader", Password: ptr("secret")})
	if err != nil {
		t.Fatal(err)
	}
	source := sourceID(server.ID)

	hits, err := h.svc.Search(ctx, source, "berserk")
	if err != nil || len(hits) != 1 {
		t.Fatalf("search = %+v, %v", hits, err)
	}

	if err = h.svc.SetLink(ctx, "anilist:30002", source, hits[0].ID, hits[0].Title); err != nil {
		t.Fatal(err)
	}

	chapters, problems, err := h.svc.Chapters(ctx, "anilist:30002")
	if err != nil || len(problems) != 0 {
		t.Fatalf("chapters: %v, problems %+v", err, problems)
	}

	var numbers []string
	for _, chapter := range chapters {
		numbers = append(numbers, chapter.Number)
	}
	if strings.Join(numbers, ",") != "12,13,13.5" {
		t.Fatalf("chapter order = %v", numbers)
	}

	prefix := "opds:" + strings.TrimPrefix(source, SourcePrefixOPDS) + ":"
	key := strings.TrimPrefix(chapters[0].Ref, prefix)

	chapter, err := h.svc.Chapter(ctx, server.ID, key)
	if err != nil || chapter.MediaRef != "anilist:30002" || chapter.Number != "12" || chapter.Pages != 5 {
		t.Errorf("chapter = %+v, %v", chapter, err)
	}

	data, contentType, err := h.svc.Page(ctx, server.ID, key, 4)
	if err != nil || contentType != "image/png" || !strings.HasSuffix(string(data), "/pages/4") {
		t.Errorf("page = %q %q %v", data, contentType, err)
	}

	if _, _, err := h.svc.Page(ctx, server.ID, key, 5); apperr.KindOf(err) != apperr.KindNotFound {
		t.Errorf("page past the end: %v", err)
	}
}

func TestAKeyTheNodeDidNotWriteIsRefused(t *testing.T) {
	h := newHarness(t)

	for _, key := range []string{
		"not base64!",
		mustKey(t, chapterKey{Series: "/s", Template: "https://elsewhere.test/{pageNumber}", Pages: 3}),
		mustKey(t, chapterKey{Series: "/s", Template: "/books/1/pages/1", Pages: 3}),
		mustKey(t, chapterKey{Series: "/s", Template: "/books/1/pages/{pageNumber}", Pages: 0}),
	} {
		if _, err := h.svc.Chapter(context.Background(), 1, key); apperr.KindOf(err) != apperr.KindInvalid {
			t.Errorf("key %q: %v, want invalid", key, err)
		}
	}
}

func TestRemovingAServerForgetsItsLinksAndPassword(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	server, err := h.svc.CreateServer(ctx, ServerInput{Name: "Komga", URL: h.catalogue, Password: ptr("secret")})
	if err != nil {
		t.Fatal(err)
	}
	if err = h.svc.SetLink(ctx, "anilist:1", sourceID(server.ID), "/opds/v1.2/series/1", ""); err != nil {
		t.Fatal(err)
	}

	if err = h.svc.DeleteServer(ctx, server.ID); err != nil {
		t.Fatal(err)
	}

	links, err := h.svc.Links(ctx, "anilist:1")
	if err != nil || len(links) != 0 {
		t.Errorf("links after delete = %+v, %v", links, err)
	}
	if stored, _ := h.passwords.Password(server.ID); stored != "" {
		t.Errorf("password after delete = %q", stored)
	}
}

func mustKey(t *testing.T, key chapterKey) string {
	t.Helper()

	encoded, err := encodeKey(key)
	if err != nil {
		t.Fatal(err)
	}

	return encoded
}
