package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/media/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/db"
	"github.com/mediaryorg/mediary-node/server/internal/platform/secrets"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/tmdb"
)

const matrixFixture = `{
  "id":603,"title":"The Matrix","original_title":"The Matrix","release_date":"1999-03-31","runtime":136,
  "overview":" A hacker learns the truth. ","poster_path":"/poster.jpg","backdrop_path":"/backdrop.jpg",
  "genres":[{"id":28,"name":"Action"},{"id":878,"name":"Science Fiction"}],
  "production_companies":[{"name":"Warner Bros. Pictures"},{"name":"Village Roadshow"}],
  "origin_country":["US"],"status":"Released","vote_average":8.24,"vote_count":26000,"adult":false,
  "alternative_titles":{"titles":[{"iso_3166_1":"UA","title":"Матриця"},{"iso_3166_1":"US","title":"the matrix"},{"iso_3166_1":"JP","title":"マトリックス"}]},
  "videos":{"results":[
    {"key":"fan","site":"YouTube","type":"Trailer","official":false},
    {"key":"teaser","site":"YouTube","type":"Teaser","official":true},
    {"key":"vKQi3bBA1y8","site":"YouTube","type":"Trailer","official":true}
  ]},
  "belongs_to_collection":{"id":2344,"name":"The Matrix Collection"},
  "recommendations":{"results":[
    {"id":604,"title":"The Matrix Reloaded","original_title":"The Matrix Reloaded","release_date":"2003-05-15","genre_ids":[28],"poster_path":"/reloaded.jpg"},
    {"id":149,"title":"Akira","original_title":"AKIRA","original_language":"ja","release_date":"1988-07-16","genre_ids":[16,878]}
  ]},
  "similar":{"results":[
    {"id":100,"title":"Dark City","release_date":"1998-02-27","genre_ids":[878]}
  ]}
}`

const matrixCollectionFixture = `{"id":2344,"name":"The Matrix Collection","parts":[
  {"id":624860,"title":"The Matrix Resurrections","release_date":"2021-12-16"},
  {"id":603,"title":"The Matrix","release_date":"1999-03-31"},
  {"id":605,"title":"The Matrix Revolutions","release_date":"2003-11-05"},
  {"id":604,"title":"The Matrix Reloaded","release_date":"2003-05-15"},
  {"id":7,"title":"The Matrix Prologue","release_date":"1990-01-01"},
  {"id":8,"title":"The Matrix 5","release_date":""}
]}`

const showFixture = `{
  "id":1396,"name":"Breaking Bad","original_name":"Breaking Bad","first_air_date":"2008-01-20","last_air_date":"2013-09-29",
  "number_of_episodes":3,"episode_run_time":[],"status":"Ended","genres":[{"id":18,"name":"Drama"}],
  "networks":[{"name":"AMC"}],"production_companies":[{"name":"Sony Pictures Television"},{"name":"AMC"}],
  "origin_country":["US"],"vote_average":8.9,"vote_count":15000,
  "last_episode_to_air":{"season_number":2,"episode_number":1,"runtime":47},
  "seasons":[
    {"season_number":0,"episode_count":9,"name":"Specials"},
    {"season_number":2,"episode_count":1,"name":"Season 2"},
    {"season_number":1,"episode_count":2,"name":"Season 1"},
    {"season_number":3,"episode_count":0,"name":"Season 3"}
  ],
  "season/1":{"season_number":1,"episodes":[
    {"episode_number":2,"name":"Cat's in the Bag...","overview":"","still_path":null,"runtime":null,"air_date":"2008-01-27"},
    {"episode_number":1,"name":"Pilot","overview":"Walter is diagnosed.","still_path":"/s1e1.jpg","runtime":58,"air_date":"2008-01-20"}
  ]},
  "season/2":{"season_number":2,"episodes":[
    {"episode_number":1,"name":"Seven Thirty-Seven","still_path":"/s2e1.jpg","runtime":47,"air_date":"2009-03-08"}
  ]}
}`

const tvGenresFixture = `{"genres":[{"id":18,"name":"Drama"},{"id":16,"name":"Animation"},{"id":35,"name":"Comedy"},{"id":10767,"name":"Talk"}]}`

const tvSearchFixture = `{"page":1,"total_pages":3,"total_results":45,"results":[
  {"id":1,"name":"Crash Landing on You","original_name":"사랑의 불시착","original_language":"ko","origin_country":["KR"],"genre_ids":[18,35],"first_air_date":"2019-12-14","vote_average":8.7,"vote_count":900,"poster_path":"/cloy.jpg"},
  {"id":2,"name":"Severance","original_name":"Severance","original_language":"en","origin_country":["US"],"genre_ids":[18],"first_air_date":"2022-02-17","vote_average":8.4,"vote_count":0},
  {"id":3,"name":"Frieren","original_name":"葬送のフリーレン","original_language":"ja","origin_country":["JP"],"genre_ids":[16,18],"first_air_date":"2023-09-29"}
]}`

type tmdbHarness struct {
	svc *Service
	now time.Time

	mu       sync.Mutex
	requests []*url.URL
}

func newTMDBHarness(t *testing.T, routes map[string]string) *tmdbHarness {
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

	h := &tmdbHarness{now: time.Date(2026, 10, 8, 12, 0, 0, 0, time.UTC)}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h.mu.Lock()
		h.requests = append(h.requests, r.URL)
		h.mu.Unlock()

		body, ok := routes[r.URL.Path]
		if !ok {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(server.Close)

	client := tmdb.New(tmdb.Options{
		Endpoint:    server.URL,
		Keys:        tmdb.NewKeys(secrets.New(filepath.Join(dir, "tmdb-secrets.json")), "key"),
		MinInterval: time.Millisecond,
	})

	h.svc = New(store.New(database), zerolog.Nop(), Options{TMDB: client, Now: func() time.Time { return h.now }})

	return h
}

func (h *tmdbHarness) paths() []string {
	h.mu.Lock()
	defer h.mu.Unlock()

	paths := make([]string, 0, len(h.requests))
	for _, request := range h.requests {
		paths = append(paths, request.Path)
	}

	return paths
}

func (h *tmdbHarness) last(path string) url.Values {
	h.mu.Lock()
	defer h.mu.Unlock()

	for i := len(h.requests) - 1; i >= 0; i-- {
		if h.requests[i].Path == path {
			return h.requests[i].Query()
		}
	}

	return nil
}

func TestTMDBMovieDetailsAreMappedAndCached(t *testing.T) {
	h := newTMDBHarness(t, map[string]string{"/movie/603": matrixFixture, "/collection/2344": matrixCollectionFixture})
	ctx := context.Background()

	details, err := h.svc.Details(ctx, "tmdb:movie:603")
	if err != nil {
		t.Fatalf("details: %v", err)
	}

	if details.MediaRef != "tmdb:movie:603" || details.MediaType != "movie" || *details.Format != "MOVIE" || *details.Status != "FINISHED" {
		t.Fatalf("identity %s %s %v %v", details.MediaRef, details.MediaType, *details.Format, details.Status)
	}

	if *details.Title.UserPreferred != "The Matrix" || details.Title.Native != nil {
		t.Fatalf("an original title equal to the main one is not repeated, got %+v", details.Title)
	}

	if strings.Join(details.Synonyms, "|") != "Матриця|マトリックス" {
		t.Fatalf("synonyms %q: the main title in another case must be dropped", details.Synonyms)
	}

	if *details.CoverImage != "https://image.tmdb.org/t/p/w500/poster.jpg" || *details.BannerImage != "https://image.tmdb.org/t/p/w1280/backdrop.jpg" {
		t.Fatalf("images %s %s", *details.CoverImage, *details.BannerImage)
	}

	if *details.AverageScore != 82 || *details.Duration != 136 || *details.Episodes != 1 || *details.SeasonYear != 1999 {
		t.Fatalf("score %d duration %d episodes %d year %d", *details.AverageScore, *details.Duration, *details.Episodes, *details.SeasonYear)
	}

	if details.Description != "A hacker learns the truth." || *details.CountryOfOrigin != "US" {
		t.Fatalf("description %q country %v", details.Description, details.CountryOfOrigin)
	}

	if details.Trailer == nil || details.Trailer.ID != "vKQi3bBA1y8" || details.Trailer.Site != "youtube" {
		t.Fatalf("the official trailer must win over a fan upload and a teaser, got %+v", details.Trailer)
	}

	if details.SiteURL != "https://www.themoviedb.org/movie/603" {
		t.Fatalf("site %s", details.SiteURL)
	}

	if query := h.last("/movie/603"); query.Get("append_to_response") != "alternative_titles,videos,recommendations,similar" || query.Get("api_key") != "key" {
		t.Fatalf("query %v", query)
	}

	if _, err = h.svc.Details(ctx, "tmdb:movie:603"); err != nil {
		t.Fatalf("cached details: %v", err)
	}

	cached, err := h.svc.CachedDetails(ctx, "tmdb:movie:603")
	if err != nil || cached == nil || cached.MediaRef != "tmdb:movie:603" {
		t.Fatalf("cached %+v, %v", cached, err)
	}

	if len(h.paths()) != 2 {
		t.Fatalf("within a day TMDB is asked once for the film and once for its series, got %v", h.paths())
	}

	h.now = h.now.Add(25 * time.Hour)
	if _, err := h.svc.Details(ctx, "tmdb:movie:603"); err != nil {
		t.Fatalf("refetched details: %v", err)
	}
	if len(h.paths()) != 4 {
		t.Fatalf("past a day TMDB is asked again, got %v", h.paths())
	}
}

func TestTMDBMovieRelationsRecommendationsAndSimilar(t *testing.T) {
	h := newTMDBHarness(t, map[string]string{"/movie/603": matrixFixture, "/collection/2344": matrixCollectionFixture})

	details, err := h.svc.Details(context.Background(), "tmdb:movie:603")
	if err != nil {
		t.Fatalf("details: %v", err)
	}

	var relations []string
	for _, relation := range details.Relations {
		relations = append(relations, relation.RelationType+" "+relation.MediaRef)
	}

	want := "OTHER tmdb:movie:8, PREQUEL tmdb:movie:7, SEQUEL tmdb:movie:604, SEQUEL tmdb:movie:605, SEQUEL tmdb:movie:624860"
	if strings.Join(relations, ", ") != want {
		t.Fatalf("relations %v, want %s: the film itself left out, the rest by when they came out", relations, want)
	}

	if len(details.Recommendations) != 1 || details.Recommendations[0].MediaRef != "tmdb:movie:604" ||
		*details.Recommendations[0].CoverImage != "https://image.tmdb.org/t/p/w500/reloaded.jpg" ||
		details.Recommendations[0].RelationType != "RECOMMENDATION" || *details.Recommendations[0].SeasonYear != 2003 {
		t.Fatalf("recommendations %+v: Japanese animation is AniList's and is left out", details.Recommendations)
	}

	if len(details.Similar) != 1 || details.Similar[0].MediaRef != "tmdb:movie:100" || details.Similar[0].MediaType != "movie" {
		t.Fatalf("similar %+v", details.Similar)
	}
}

func TestTMDBMovieWithoutItsSeriesStillLoads(t *testing.T) {
	h := newTMDBHarness(t, map[string]string{"/movie/603": matrixFixture})

	details, err := h.svc.Details(context.Background(), "tmdb:movie:603")
	if err != nil {
		t.Fatalf("details: %v", err)
	}

	if len(details.Relations) != 0 || len(details.Recommendations) != 1 {
		t.Fatalf("relations %v recommendations %v", details.Relations, details.Recommendations)
	}
}

func TestTMDBShowEpisodesSpanRegularSeasons(t *testing.T) {
	h := newTMDBHarness(t, map[string]string{"/tv/1396": showFixture})
	ctx := context.Background()

	details, err := h.svc.Details(ctx, "tmdb:tv:1396")
	if err != nil {
		t.Fatalf("details: %v", err)
	}

	if details.MediaType != "series" || *details.Status != "FINISHED" || *details.EndDate.Year != 2013 {
		t.Fatalf("show %s %v end %+v", details.MediaType, *details.Status, details.EndDate)
	}

	if strings.Join(details.Studios, "|") != "AMC|Sony Pictures Television" {
		t.Fatalf("studios %q: the network first, each name once", details.Studios)
	}

	if details.Duration == nil || *details.Duration != 47 {
		t.Fatalf("without episode_run_time the last episode's runtime stands in, got %v", details.Duration)
	}

	list, err := h.svc.Episodes(ctx, "tmdb:tv:1396")
	if err != nil {
		t.Fatalf("episodes: %v", err)
	}

	if appended := h.last("/tv/1396").Get("append_to_response"); appended != "season/1,season/2" {
		t.Fatalf("specials and an empty season must not be fetched, appended %q", appended)
	}

	var got []string
	for _, episode := range list.Episodes {
		got = append(got, strings.Join([]string{strconv.Itoa(*episode.Season), strconv.Itoa(episode.Number), deref(episode.Title)}, "/"))
	}

	if strings.Join(got, ", ") != "1/1/Pilot, 1/2/Cat's in the Bag..., 2/1/Seven Thirty-Seven" {
		t.Fatalf("episodes %v", got)
	}

	pilot, second := list.Episodes[0], list.Episodes[1]
	if *pilot.Image != "https://image.tmdb.org/t/p/w300/s1e1.jpg" || *pilot.RuntimeMinutes != 58 || pilot.Titles["en"] != "Pilot" {
		t.Fatalf("pilot %+v", pilot)
	}

	if second.Overview != nil || second.Image != nil || *second.RuntimeMinutes != 47 {
		t.Fatalf("an empty overview is absent and a missing runtime falls back to the show's, got %+v", second)
	}

	if *list.Total != 3 || list.Sources[0] != ProviderTMDB {
		t.Fatalf("total %d sources %v", *list.Total, list.Sources)
	}

	if _, err := h.svc.Episodes(ctx, "tmdb:tv:1396"); err != nil {
		t.Fatalf("cached episodes: %v", err)
	}
	if len(h.paths()) != 2 {
		t.Fatalf("details and seasons are each fetched once a day, got %v", h.paths())
	}
}

func TestTMDBMovieIsOneEpisode(t *testing.T) {
	h := newTMDBHarness(t, map[string]string{"/movie/603": matrixFixture})

	list, err := h.svc.Episodes(context.Background(), "tmdb:movie:603")
	if err != nil {
		t.Fatalf("episodes: %v", err)
	}

	if len(list.Episodes) != 1 || list.Episodes[0].Number != 1 || list.Episodes[0].Season != nil ||
		*list.Episodes[0].AirDate != "1999-03-31" || *list.Episodes[0].RuntimeMinutes != 136 {
		t.Fatalf("movie episodes %+v", list.Episodes)
	}
}

func TestTMDBSearchDropsJapaneseAnimationAndNarrowsDoramas(t *testing.T) {
	h := newTMDBHarness(t, map[string]string{"/search/tv": tvSearchFixture, "/genre/tv/list": tvGenresFixture})
	ctx := context.Background()

	series, err := h.svc.Search(ctx, SearchParams{MediaType: "series", Query: " love ", Year: 2019})
	if err != nil {
		t.Fatalf("series search: %v", err)
	}

	if refs := summaryRefs(series.Items); refs != "tmdb:tv:1 dorama|tmdb:tv:2 series" {
		t.Fatalf("series results %s: anime is AniList's, a dorama is still a series", refs)
	}

	if query := h.last("/search/tv"); query.Get("query") != "love" || query.Get("first_air_date_year") != "2019" || query.Get("include_adult") != "false" {
		t.Fatalf("search query %v", query)
	}

	first := series.Items[0]
	if strings.Join(first.Genres, "|") != "Drama|Comedy" || *first.Title.Native != "사랑의 불시착" || *first.AverageScore != 87 {
		t.Fatalf("summary %+v", first)
	}

	if series.Items[1].AverageScore != nil {
		t.Fatal("a title without votes has no score, not a zero")
	}

	if series.PerPage != 20 || series.Total != 45 || !series.HasNextPage {
		t.Fatalf("paging %+v", series)
	}

	doramas, err := h.svc.Search(ctx, SearchParams{MediaType: "dorama", Query: "love"})
	if err != nil {
		t.Fatalf("dorama search: %v", err)
	}

	if refs := summaryRefs(doramas.Items); refs != "tmdb:tv:1 dorama" {
		t.Fatalf("dorama results %s", refs)
	}
}

func TestTMDBBrowsingMapsSortsAndFilters(t *testing.T) {
	h := newTMDBHarness(t, map[string]string{
		"/discover/tv":   `{"page":1,"total_pages":1,"total_results":0,"results":[]}`,
		"/genre/tv/list": tvGenresFixture,
	})
	ctx := context.Background()

	if _, err := h.svc.Search(ctx, SearchParams{MediaType: "dorama", Sort: "SCORE_DESC", Genres: []string{"comedy"}, MinScore: 75}); err != nil {
		t.Fatalf("browse: %v", err)
	}

	query := h.last("/discover/tv")
	for name, want := range map[string]string{
		"with_origin_country": "KR|CN|TW|HK|JP|TH",
		"without_genres":      "10763,10764,10767,16",
		"with_genres":         "35",
		"sort_by":             "vote_average.desc",
		"vote_count.gte":      "200",
		"vote_average.gte":    "7.5",
	} {
		if query.Get(name) != want {
			t.Errorf("%s = %q, want %q", name, query.Get(name), want)
		}
	}

	if _, err := h.svc.Search(ctx, SearchParams{MediaType: "series", Sort: "START_DATE_DESC"}); err != nil {
		t.Fatalf("browse by date: %v", err)
	}

	query = h.last("/discover/tv")
	if query.Get("sort_by") != "first_air_date.desc" || query.Get("first_air_date.lte") != "2026-10-08" || query.Get("with_origin_country") != "" {
		t.Fatalf("newest first must stop at today, got %v", query)
	}

	if _, err := h.svc.Search(ctx, SearchParams{MediaType: "series", Genres: []string{"Talk"}}); err != nil {
		t.Fatalf("browse talk shows: %v", err)
	}

	if query = h.last("/discover/tv"); query.Get("with_genres") != "10767" || query.Get("without_genres") != "10763,10764" || query.Get("vote_count.gte") != "50" {
		t.Fatalf("a genre the user asked for is not excluded, got %v", query)
	}

	before := len(h.paths())
	if _, err := h.svc.Search(ctx, SearchParams{MediaType: "series", Genres: []string{"Western"}}); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("an unknown genre must be rejected, got %v", err)
	}
	if len(h.paths()) != before {
		t.Fatal("an unknown genre must not reach discover")
	}
}

func TestTMDBFilterOptionsLeaveAnimationOutOfDoramas(t *testing.T) {
	h := newTMDBHarness(t, map[string]string{"/genre/tv/list": tvGenresFixture})

	options, err := h.svc.FilterOptions(context.Background(), "dorama")
	if err != nil {
		t.Fatalf("filter options: %v", err)
	}

	if strings.Join(options.Genres, "|") != "Drama|Comedy|Talk" || len(options.Tags) != 0 {
		t.Fatalf("options %+v", options)
	}
}

func TestTMDBTurnedOffIsAPrecondition(t *testing.T) {
	svc := New(nil, zerolog.Nop(), Options{})
	ctx := context.Background()

	if _, err := svc.Details(ctx, "tmdb:tv:1"); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("details: %v", err)
	}

	if _, err := svc.Search(ctx, SearchParams{MediaType: "movie"}); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("search: %v", err)
	}

	settings, err := svc.TMDBSettings()
	if err != nil || settings.Enabled || settings.KeySource != "none" {
		t.Fatalf("settings %+v, %v", settings, err)
	}
}

func TestClassifyTMDB(t *testing.T) {
	cases := []struct {
		kind      tmdb.Kind
		genres    []int
		countries []string
		want      string
	}{
		{tmdb.KindMovie, []int{18}, []string{"KR"}, "movie"},
		{tmdb.KindTV, []int{18}, []string{"KR"}, "dorama"},
		{tmdb.KindTV, []int{18}, []string{"US", "TW"}, "dorama"},
		{tmdb.KindTV, []int{16, 18}, []string{"KR"}, "series"},
		{tmdb.KindTV, []int{18}, []string{"GB"}, "series"},
		{tmdb.KindTV, nil, nil, "series"},
	}

	for _, c := range cases {
		if got := classifyTMDB(c.kind, c.genres, c.countries); got != c.want {
			t.Errorf("%s %v %v = %s, want %s", c.kind, c.genres, c.countries, got, c.want)
		}
	}
}

func TestParseRef(t *testing.T) {
	valid := map[string]titleRef{
		"anilist:154587": {provider: ProviderAniList, id: 154587},
		"tmdb:movie:603": {provider: ProviderTMDB, kind: tmdb.KindMovie, id: 603},
		"tmdb:tv:1396":   {provider: ProviderTMDB, kind: tmdb.KindTV, id: 1396},
	}

	for raw, want := range valid {
		got, err := parseRef(raw)
		if err != nil || got != want {
			t.Errorf("%q = %+v, %v", raw, got, err)
		}
	}

	for _, raw := range []string{"tmdb:603", "tmdb:person:1", "tmdb:tv:0", "tmdb:tv:x", "imdb:tt0133093", "603"} {
		if _, err := parseRef(raw); apperr.KindOf(err) != apperr.KindInvalid {
			t.Errorf("%q must be invalid, got %v", raw, err)
		}
	}
}

func summaryRefs(items []MediaSummary) string {
	refs := make([]string, 0, len(items))
	for i := range items {
		refs = append(refs, items[i].MediaRef+" "+items[i].MediaType)
	}

	return strings.Join(refs, "|")
}

func deref(text *string) string {
	if text == nil {
		return ""
	}

	return *text
}
