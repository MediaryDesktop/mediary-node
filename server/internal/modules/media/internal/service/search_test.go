package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/media/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/db"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anilist"
)

const searchFixture = `{"data":{"Page":{
  "pageInfo":{"total":2,"currentPage":1,"lastPage":1,"hasNextPage":false,"perPage":30},
  "media":[
    {"id":154587,"type":"ANIME","format":"TV","status":"FINISHED","episodes":28,"season":"FALL",
     "seasonYear":2023,"averageScore":90,"popularity":400000,"genres":["Adventure"],"isAdult":false,
     "siteUrl":"https://anilist.co/anime/154587","startDate":{"year":2023,"month":9,"day":29},
     "title":{"userPreferred":"Sousou no Frieren","english":"Frieren"},
     "coverImage":{"extraLarge":"https://img/xl.jpg","large":"https://img/l.jpg","color":"#aabbcc"},
     "nextAiringEpisode":{"episode":29,"airingAt":1730000000}},
    {"id":21,"type":"ANIME","format":"TV","status":"RELEASING","genres":null,"isAdult":false,
     "siteUrl":"https://anilist.co/anime/21","startDate":{"year":1999},
     "title":{"userPreferred":"One Piece"},"coverImage":{"medium":"https://img/m.jpg"},
     "nextAiringEpisode":null}
  ]}}}`

const filterOptionsFixture = `{"data":{
  "GenreCollection":["Action","Adventure"],
  "MediaTagCollection":[{"name":"Isekai","category":"Theme","isAdult":false}]}}`

type searchHarness struct {
	svc       *Service
	db        *sql.DB
	now       time.Time
	response  string
	mu        sync.Mutex
	variables []map[string]any
}

func newSearchHarness(t *testing.T) *searchHarness {
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

	h := &searchHarness{db: database, now: time.Now(), response: searchFixture}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)

		var request struct {
			Variables map[string]any `json:"variables"`
		}
		_ = json.Unmarshal(raw, &request)

		h.mu.Lock()
		h.variables = append(h.variables, request.Variables)
		response := h.response
		h.mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(response))
	}))
	t.Cleanup(server.Close)

	client := anilist.New(anilist.Options{
		Endpoint:    server.URL,
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

func (h *searchHarness) lastVariables(t *testing.T) map[string]any {
	t.Helper()

	h.mu.Lock()
	defer h.mu.Unlock()

	if len(h.variables) == 0 {
		t.Fatal("the source was never asked")
	}

	return h.variables[len(h.variables)-1]
}

func (h *searchHarness) asked() int {
	h.mu.Lock()
	defer h.mu.Unlock()

	return len(h.variables)
}

func (h *searchHarness) cachedRows(t *testing.T) int {
	t.Helper()

	var count int
	if err := h.db.QueryRowContext(context.Background(), "SELECT COUNT(*) FROM source_cache").Scan(&count); err != nil {
		t.Fatalf("count cache: %v", err)
	}

	return count
}

func TestSearchMapsTitlesAndKeepsNothing(t *testing.T) {
	h := newSearchHarness(t)

	page, err := h.svc.Search(context.Background(), SearchParams{MediaType: "anime", Query: "frieren"})
	if err != nil {
		t.Fatalf("search: %v", err)
	}

	if len(page.Items) != 2 || page.Total != 2 || page.HasNextPage {
		t.Fatalf("unexpected page: %+v", page)
	}

	first := page.Items[0]
	if first.MediaRef != "anilist:154587" || first.MediaType != "anime" {
		t.Fatalf("reference and type must come from the source: %+v", first)
	}
	if first.CoverImage == nil || *first.CoverImage != "https://img/xl.jpg" {
		t.Fatalf("the largest cover wins, got %v", first.CoverImage)
	}
	if first.NextAiringEpisode == nil || first.NextAiringEpisode.Episode != 29 {
		t.Fatalf("next episode = %+v", first.NextAiringEpisode)
	}
	if page.Items[1].Genres == nil {
		t.Fatal("a missing list must serialise as empty, not null")
	}

	if h.cachedRows(t) != 0 {
		t.Fatal("search results are not the user own data and must not be stored")
	}
}

func TestSearchSortsByRelevanceOnlyWhileSearching(t *testing.T) {
	h := newSearchHarness(t)
	ctx := context.Background()

	if _, err := h.svc.Search(ctx, SearchParams{MediaType: "anime"}); err != nil {
		t.Fatalf("browse: %v", err)
	}
	if sort := h.lastVariables(t)["sort"]; !sortEquals(sort, browseSort) {
		t.Fatalf("browsing must be sorted by popularity, got %v", sort)
	}

	if _, err := h.svc.Search(ctx, SearchParams{MediaType: "anime", Query: "frieren"}); err != nil {
		t.Fatalf("search: %v", err)
	}
	if sort := h.lastVariables(t)["sort"]; !sortEquals(sort, "SEARCH_MATCH") {
		t.Fatalf("a typed query must be sorted by relevance, got %v", sort)
	}

	if _, err := h.svc.Search(ctx, SearchParams{MediaType: "anime", Query: "frieren", Sort: "SCORE_DESC"}); err != nil {
		t.Fatalf("explicit sort: %v", err)
	}
	if sort := h.lastVariables(t)["sort"]; !sortEquals(sort, "SCORE_DESC") {
		t.Fatalf("an explicit sort must win over relevance, got %v", sort)
	}
}

func sortEquals(value any, want string) bool {
	list, ok := value.([]any)

	return ok && len(list) == 1 && list[0] == want
}

func TestSearchExcludesAdultTitlesUnlessAsked(t *testing.T) {
	h := newSearchHarness(t)
	ctx := context.Background()

	if _, err := h.svc.Search(ctx, SearchParams{MediaType: "anime"}); err != nil {
		t.Fatalf("search: %v", err)
	}
	if adult, ok := h.lastVariables(t)["isAdult"]; !ok || adult != false {
		t.Fatalf("adult titles must be excluded by default, got %v", adult)
	}

	if _, err := h.svc.Search(ctx, SearchParams{MediaType: "anime", Adult: true}); err != nil {
		t.Fatalf("search: %v", err)
	}
	if _, ok := h.lastVariables(t)["isAdult"]; ok {
		t.Fatal("asking for adult titles must widen the search, not narrow it to them")
	}
}

func TestSearchRejectsUnknownTypeAndUnreachablePages(t *testing.T) {
	h := newSearchHarness(t)
	ctx := context.Background()

	if _, err := h.svc.Search(ctx, SearchParams{MediaType: "podcast"}); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("a type no source owns must be rejected, got %v", err)
	}

	if _, err := h.svc.Search(ctx, SearchParams{MediaType: "anime", Page: maxPage + 1}); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("a page past the source ceiling must be rejected, got %v", err)
	}

	if asked := h.asked(); asked != 0 {
		t.Fatalf("an invalid search must not reach the source, got %d requests", asked)
	}
}

func TestSearchClampsPageSize(t *testing.T) {
	h := newSearchHarness(t)

	page, err := h.svc.Search(context.Background(), SearchParams{MediaType: "anime", PerPage: 500})
	if err != nil {
		t.Fatalf("search: %v", err)
	}

	if page.PerPage != maxPerPage {
		t.Fatalf("per_page = %d, want the source ceiling %d", page.PerPage, maxPerPage)
	}
	if perPage := h.lastVariables(t)["perPage"]; perPage != float64(maxPerPage) {
		t.Fatalf("the clamped size must be what the source is asked for, got %v", perPage)
	}
}

func TestFilterOptionsAreCachedForADay(t *testing.T) {
	h := newSearchHarness(t)
	h.response = filterOptionsFixture
	ctx := context.Background()

	options, err := h.svc.FilterOptions(ctx, "anime")
	if err != nil {
		t.Fatalf("filter options: %v", err)
	}

	if len(options.Genres) != 2 || len(options.Tags) != 1 || options.Tags[0].Category != "Theme" {
		t.Fatalf("unexpected options: %+v", options)
	}

	h.now = h.now.Add(23 * time.Hour)
	if _, err := h.svc.FilterOptions(ctx, "anime"); err != nil {
		t.Fatalf("cached options: %v", err)
	}
	if asked := h.asked(); asked != 1 {
		t.Fatalf("within a day the cache answers, got %d requests", asked)
	}

	h.now = h.now.Add(2 * time.Hour)
	if _, err := h.svc.FilterOptions(ctx, "anime"); err != nil {
		t.Fatalf("refetched options: %v", err)
	}
	if asked := h.asked(); asked != 2 {
		t.Fatalf("past a day the source is asked again, got %d requests", asked)
	}
}
