package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/media/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/db"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/openlibrary"
)

const duneWorkFixture = `{
  "key":"/works/OL893414W","title":"Dune","subtitle":"Deluxe Edition",
  "description":{"type":"/type/text","value":"Set on the desert planet Arrakis ([source][1]).\r\n\r\n----------\r\nAlso contained in:\r\n - Dune Trilogy\r\n\r\n[1]: https://example.com/dune"},
  "subjects":["Dune (Imaginary place)","Fiction, science fiction, general","Science-fiction","Classic Literature","American literature"],
  "covers":[11481354,12375564],
  "authors":[{"author":{"key":"/authors/OL79034A"}}]
}`

const duneDocFixture = `{"numFound":1,"docs":[{"key":"/works/OL893414W","title":"Dune",
  "author_name":["Frank Herbert","Frank Herbert"],"first_publish_year":1965,"cover_i":999,
  "number_of_pages_median":608,"ratings_average":4.303571,"ratings_count":448,
  "subject":["Fiction","Space opera","Adventure stories"]}]}`

const bookSearchFixture = `{"numFound":45,"docs":[
  {"key":"/works/OL893414W","title":"Dune","author_name":["Frank Herbert"],"first_publish_year":1965,"cover_i":11481354,"number_of_pages_median":608,"ratings_average":4.3,"ratings_count":448,"subject":["Science fiction"]},
  {"key":"/works/OL1W","title":"Unrated","author_name":["Someone"],"ratings_count":0}
]}`

type bookHarness struct {
	svc *Service
	now time.Time

	mu       sync.Mutex
	requests []*url.URL
}

func newBookHarness(t *testing.T) *bookHarness {
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

	h := &bookHarness{now: time.Date(2026, 10, 10, 12, 0, 0, 0, time.UTC)}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h.mu.Lock()
		h.requests = append(h.requests, r.URL)
		h.mu.Unlock()

		switch {
		case r.URL.Path == "/works/OL893414W.json":
			_, _ = w.Write([]byte(duneWorkFixture))
		case r.URL.Path == "/search.json" && r.URL.Query().Get("q") == "key:/works/OL893414W":
			_, _ = w.Write([]byte(duneDocFixture))
		case r.URL.Path == "/search.json":
			_, _ = w.Write([]byte(bookSearchFixture))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(server.Close)

	client := openlibrary.New(openlibrary.Options{Endpoint: server.URL, MinInterval: time.Millisecond})

	h.svc = New(store.New(database), zerolog.Nop(), Options{OpenLibrary: client, Now: func() time.Time { return h.now }})

	return h
}

func (h *bookHarness) lastSearch() url.Values {
	h.mu.Lock()
	defer h.mu.Unlock()

	for i := len(h.requests) - 1; i >= 0; i-- {
		if h.requests[i].Path == "/search.json" {
			return h.requests[i].Query()
		}
	}

	return nil
}

func (h *bookHarness) count() int {
	h.mu.Lock()
	defer h.mu.Unlock()

	return len(h.requests)
}

func TestBookDetailsAreMappedAndCached(t *testing.T) {
	h := newBookHarness(t)
	ctx := context.Background()

	details, err := h.svc.Details(ctx, "openlibrary:OL893414W")
	if err != nil {
		t.Fatalf("details: %v", err)
	}

	if details.MediaRef != "openlibrary:OL893414W" || details.MediaType != "book" || *details.Format != "BOOK" {
		t.Fatalf("identity %s %s %s", details.MediaRef, details.MediaType, *details.Format)
	}

	if details.Description != "Set on the desert planet Arrakis." {
		t.Fatalf("description %q: the editions list and the link targets go", details.Description)
	}

	if strings.Join(details.Authors, "|") != "Frank Herbert" || *details.Pages != 608 || *details.AverageScore != 86 || *details.SeasonYear != 1965 {
		t.Fatalf("authors %v pages %v score %v year %v", details.Authors, details.Pages, details.AverageScore, details.SeasonYear)
	}

	if strings.Join(details.Genres, "|") != "Science fiction|Classics" {
		t.Fatalf("genres %v", details.Genres)
	}

	if *details.CoverImage != "https://covers.openlibrary.org/b/id/11481354-L.jpg" {
		t.Fatalf("the work's own cover comes first, got %s", *details.CoverImage)
	}

	if strings.Join(details.Synonyms, "|") != "Dune: Deluxe Edition" || details.SiteURL != "https://openlibrary.org/works/OL893414W" {
		t.Fatalf("synonyms %v site %s", details.Synonyms, details.SiteURL)
	}

	if _, err = h.svc.Details(ctx, "openlibrary:OL893414W"); err != nil {
		t.Fatalf("cached details: %v", err)
	}
	if h.count() != 2 {
		t.Fatalf("within a day the work and its search entry are asked for once, got %d requests", h.count())
	}

	cached, err := h.svc.CachedDetails(ctx, "openlibrary:OL893414W")
	if err != nil || cached == nil || cached.Title.UserPreferred == nil || *cached.Title.UserPreferred != "Dune" {
		t.Fatalf("cached %+v, %v", cached, err)
	}
}

func TestBookSearchPutsFiltersInTheQuery(t *testing.T) {
	h := newBookHarness(t)

	page, err := h.svc.Search(context.Background(), SearchParams{
		MediaType: "book", Query: " dune ", Genres: []string{"fantasy"}, Year: 1965, MinScore: 80, Page: 2,
	})
	if err != nil {
		t.Fatalf("search: %v", err)
	}

	query := h.lastSearch()
	if query.Get("q") != `dune subject:"fantasy" first_publish_year:1965 ratings_average:[4.0 TO *]` || query.Get("sort") != "" ||
		query.Get("page") != "2" || query.Get("limit") != "20" {
		t.Fatalf("query %v", query)
	}

	if page.Total != 45 || !page.HasNextPage || page.PerPage != 20 {
		t.Fatalf("paging %+v", page)
	}

	dune := page.Items[0]
	if dune.MediaRef != "openlibrary:OL893414W" || dune.MediaType != "book" || dune.Authors[0] != "Frank Herbert" ||
		*dune.AverageScore != 86 || *dune.Pages != 608 || strings.Join(dune.Genres, "|") != "Science fiction" {
		t.Fatalf("summary %+v", dune)
	}

	if page.Items[1].AverageScore != nil {
		t.Fatal("a book nobody rated has no score, not a zero")
	}
}

func TestBookBrowsingSortsAndFloors(t *testing.T) {
	h := newBookHarness(t)
	ctx := context.Background()

	if _, err := h.svc.Search(ctx, SearchParams{MediaType: "book"}); err != nil {
		t.Fatalf("browse: %v", err)
	}
	if query := h.lastSearch(); query.Get("q") != browseFloor || query.Get("sort") != "readinglog" {
		t.Fatalf("plain browsing is the most read, got %v", query)
	}

	if _, err := h.svc.Search(ctx, SearchParams{MediaType: "book", Sort: "SCORE_DESC"}); err != nil {
		t.Fatalf("best rated: %v", err)
	}
	if query := h.lastSearch(); query.Get("q") != ratedFloor+" "+browseFloor || query.Get("sort") != "rating" {
		t.Fatalf("best rated needs a hundred ratings, got %v", query)
	}

	before := h.count()
	if _, err := h.svc.Search(ctx, SearchParams{MediaType: "book", Genres: []string{"Westerns"}}); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("an unknown genre must be rejected, got %v", err)
	}
	if h.count() != before {
		t.Fatal("an unknown genre must not reach Open Library")
	}
}

func TestGenresFromSubjects(t *testing.T) {
	cases := map[string]string{
		"Fiction, science fiction, general": "Science fiction",
		"Science-fiction":                   "Science fiction",
		"Detective and mystery stories":     "Mystery",
		"Historical fiction":                "Historical fiction",
		"History, Modern":                   "History",
		"Natural science":                   "Science",
		"Juvenile fiction":                  "Children's",
		"Space opera":                       "",
	}

	for subject, want := range cases {
		if got := strings.Join(genresFromSubjects([]string{subject}), "|"); got != want {
			t.Errorf("%q = %q, want %q", subject, got, want)
		}
	}

	if got := genresFromSubjects([]string{"Fantasy fiction", "Fantasy"}, []string{"fantasy"}); len(got) != 1 {
		t.Fatalf("a genre is named once, got %v", got)
	}
}

func TestBooksTurnedOffAndWithoutEpisodes(t *testing.T) {
	ctx := context.Background()
	off := New(nil, zerolog.Nop(), Options{})

	if _, err := off.Details(ctx, "openlibrary:OL893414W"); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("details: %v", err)
	}
	if _, err := off.Search(ctx, SearchParams{MediaType: "book"}); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("search: %v", err)
	}

	h := newBookHarness(t)
	if _, err := h.svc.Episodes(ctx, "openlibrary:OL893414W"); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("episodes: %v", err)
	}

	for _, ref := range []string{"openlibrary:OL893414M", "openlibrary:893414", "openlibrary:"} {
		if _, err := h.svc.Details(ctx, ref); apperr.KindOf(err) != apperr.KindInvalid {
			t.Errorf("%q: %v", ref, err)
		}
	}
}

func TestFilterOptionsForBooks(t *testing.T) {
	h := newBookHarness(t)

	options, err := h.svc.FilterOptions(context.Background(), "book")
	if err != nil {
		t.Fatalf("options: %v", err)
	}

	if len(options.Genres) != len(bookGenres) || options.Genres[0] != "Fantasy" || len(options.Tags) != 0 || h.count() != 0 {
		t.Fatalf("options %+v after %d requests: the vocabulary is the node's own", options, h.count())
	}
}
