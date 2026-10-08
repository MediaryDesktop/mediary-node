package tmdb

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// Kind is TMDB's own split: a movie id and a TV id are separate number spaces.
type Kind string

const (
	KindMovie Kind = "movie"
	KindTV    Kind = "tv"
)

// GenreAnimation is read by id because Japanese animation is AniList's to
// describe, not TMDB's.
const GenreAnimation = 16

// Television genres that are not shows to follow: browsing by popularity would
// otherwise open on late-night talk shows and the news.
const (
	GenreNews    = 10763
	GenreReality = 10764
	GenreTalk    = 10767
)

const imageBase = "https://image.tmdb.org/t/p/"

// MaxPage is the deepest page TMDB serves for a search or a discover query.
const MaxPage = 500

// seasonsPerRequest is TMDB's cap on append_to_response.
const seasonsPerRequest = 20

// ImageURL turns a path TMDB returned into a link at the given width ("w500",
// "w1280", "original").
func ImageURL(path *string, size string) *string {
	if path == nil || *path == "" {
		return nil
	}

	link := imageBase + size + *path

	return &link
}

type Result struct {
	ID               int      `json:"id"`
	Title            string   `json:"title"`
	OriginalTitle    string   `json:"original_title"`
	Name             string   `json:"name"`
	OriginalName     string   `json:"original_name"`
	OriginalLanguage string   `json:"original_language"`
	Overview         string   `json:"overview"`
	PosterPath       *string  `json:"poster_path"`
	BackdropPath     *string  `json:"backdrop_path"`
	ReleaseDate      string   `json:"release_date"`
	FirstAirDate     string   `json:"first_air_date"`
	GenreIDs         []int    `json:"genre_ids"`
	OriginCountry    []string `json:"origin_country"`
	VoteAverage      float64  `json:"vote_average"`
	VoteCount        int      `json:"vote_count"`
	Adult            bool     `json:"adult"`
}

type Page struct {
	Page         int      `json:"page"`
	TotalPages   int      `json:"total_pages"`
	TotalResults int      `json:"total_results"`
	Results      []Result `json:"results"`
}

type SearchParams struct {
	Query    string
	Page     int
	Year     int
	Adult    bool
	Language string
}

func (c *Client) Search(ctx context.Context, kind Kind, params SearchParams) (*Page, error) {
	query := url.Values{
		"query":         {params.Query},
		"page":          {strconv.Itoa(max(params.Page, 1))},
		"include_adult": {strconv.FormatBool(params.Adult)},
	}
	setLanguage(query, params.Language)

	if params.Year > 0 {
		if kind == KindMovie {
			query.Set("primary_release_year", strconv.Itoa(params.Year))
		} else {
			query.Set("first_air_date_year", strconv.Itoa(params.Year))
		}
	}

	var page Page
	if err := c.call(ctx, "/search/"+string(kind), query, &page); err != nil {
		return nil, err
	}

	return &page, nil
}

type DiscoverParams struct {
	Page            int
	SortBy          string
	Genres          []int
	WithoutGenres   []int
	OriginCountries []string
	Year            int
	MinVoteAverage  float64
	MinVoteCount    int
	ReleasedBefore  string
	Adult           bool
	Language        string
}

// Discover browses without a query. Genres must all match; origin countries are
// alternatives.
func (c *Client) Discover(ctx context.Context, kind Kind, params DiscoverParams) (*Page, error) {
	query := url.Values{
		"page":          {strconv.Itoa(max(params.Page, 1))},
		"include_adult": {strconv.FormatBool(params.Adult)},
	}
	setLanguage(query, params.Language)

	if params.SortBy != "" {
		query.Set("sort_by", params.SortBy)
	}
	if len(params.Genres) > 0 {
		query.Set("with_genres", joinInts(params.Genres, ","))
	}
	if len(params.WithoutGenres) > 0 {
		query.Set("without_genres", joinInts(params.WithoutGenres, ","))
	}
	if len(params.OriginCountries) > 0 {
		query.Set("with_origin_country", strings.Join(params.OriginCountries, "|"))
	}
	if params.MinVoteAverage > 0 {
		query.Set("vote_average.gte", strconv.FormatFloat(params.MinVoteAverage, 'f', 1, 64))
	}
	if params.MinVoteCount > 0 {
		query.Set("vote_count.gte", strconv.Itoa(params.MinVoteCount))
	}

	dateField := "first_air_date"
	if kind == KindMovie {
		dateField = "primary_release_date"
	}
	if params.Year > 0 {
		if kind == KindMovie {
			query.Set("primary_release_year", strconv.Itoa(params.Year))
		} else {
			query.Set("first_air_date_year", strconv.Itoa(params.Year))
		}
	}
	if params.ReleasedBefore != "" {
		query.Set(dateField+".lte", params.ReleasedBefore)
	}

	var page Page
	if err := c.call(ctx, "/discover/"+string(kind), query, &page); err != nil {
		return nil, err
	}

	return &page, nil
}

type Genre struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

func (c *Client) Genres(ctx context.Context, kind Kind, language string) ([]Genre, error) {
	query := url.Values{}
	setLanguage(query, language)

	var out struct {
		Genres []Genre `json:"genres"`
	}
	if err := c.call(ctx, "/genre/"+string(kind)+"/list", query, &out); err != nil {
		return nil, err
	}

	return out.Genres, nil
}

type Company struct {
	Name string `json:"name"`
}

type Country struct {
	Code string `json:"iso_3166_1"`
}

type AlternativeTitle struct {
	Country string `json:"iso_3166_1"`
	Title   string `json:"title"`
}

// AlternativeTitles is "titles" for a movie and "results" for a show.
type AlternativeTitles struct {
	Titles  []AlternativeTitle `json:"titles"`
	Results []AlternativeTitle `json:"results"`
}

func (a AlternativeTitles) All() []AlternativeTitle {
	return append(append([]AlternativeTitle{}, a.Titles...), a.Results...)
}

type Video struct {
	Key      string `json:"key"`
	Site     string `json:"site"`
	Type     string `json:"type"`
	Official bool   `json:"official"`
}

type SeasonSummary struct {
	SeasonNumber int    `json:"season_number"`
	EpisodeCount int    `json:"episode_count"`
	Name         string `json:"name"`
	AirDate      string `json:"air_date"`
}

type EpisodeAir struct {
	SeasonNumber  int    `json:"season_number"`
	EpisodeNumber int    `json:"episode_number"`
	AirDate       string `json:"air_date"`
	Runtime       *int   `json:"runtime"`
}

// Details is a movie or a show. The fields of the other kind stay empty.
type Details struct {
	ID int `json:"id"`

	Title         string    `json:"title"`
	OriginalTitle string    `json:"original_title"`
	ReleaseDate   string    `json:"release_date"`
	Runtime       *int      `json:"runtime"`
	Production    []Country `json:"production_countries"`

	Name             string          `json:"name"`
	OriginalName     string          `json:"original_name"`
	FirstAirDate     string          `json:"first_air_date"`
	LastAirDate      string          `json:"last_air_date"`
	NumberOfEpisodes *int            `json:"number_of_episodes"`
	NumberOfSeasons  *int            `json:"number_of_seasons"`
	EpisodeRunTime   []int           `json:"episode_run_time"`
	Networks         []Company       `json:"networks"`
	Seasons          []SeasonSummary `json:"seasons"`
	NextEpisode      *EpisodeAir     `json:"next_episode_to_air"`
	LastEpisode      *EpisodeAir     `json:"last_episode_to_air"`

	Overview            string    `json:"overview"`
	PosterPath          *string   `json:"poster_path"`
	BackdropPath        *string   `json:"backdrop_path"`
	Genres              []Genre   `json:"genres"`
	ProductionCompanies []Company `json:"production_companies"`
	OriginCountry       []string  `json:"origin_country"`
	OriginalLanguage    string    `json:"original_language"`
	Status              string    `json:"status"`
	VoteAverage         float64   `json:"vote_average"`
	VoteCount           int       `json:"vote_count"`
	Adult               bool      `json:"adult"`

	AlternativeTitles AlternativeTitles `json:"alternative_titles"`
	Videos            struct {
		Results []Video `json:"results"`
	} `json:"videos"`
}

// Title fetches a movie or a show with its other names and trailers in the same
// request.
func (c *Client) Title(ctx context.Context, kind Kind, id int, language string) (*Details, error) {
	query := url.Values{"append_to_response": {"alternative_titles,videos"}}
	setLanguage(query, language)

	var details Details
	if err := c.call(ctx, fmt.Sprintf("/%s/%d", kind, id), query, &details); err != nil {
		return nil, err
	}

	return &details, nil
}

type Episode struct {
	SeasonNumber  int     `json:"season_number"`
	EpisodeNumber int     `json:"episode_number"`
	Name          string  `json:"name"`
	Overview      string  `json:"overview"`
	StillPath     *string `json:"still_path"`
	Runtime       *int    `json:"runtime"`
	AirDate       string  `json:"air_date"`
}

type Season struct {
	SeasonNumber int       `json:"season_number"`
	Episodes     []Episode `json:"episodes"`
}

// Seasons fetches a show's seasons with their episodes, twenty seasons to a
// request: a long show costs a handful of requests rather than one per season.
// A season TMDB does not return is left out.
func (c *Client) Seasons(ctx context.Context, id int, numbers []int, language string) ([]Season, error) {
	seasons := make([]Season, 0, len(numbers))

	for start := 0; start < len(numbers); start += seasonsPerRequest {
		batch := numbers[start:min(start+seasonsPerRequest, len(numbers))]

		appended := make([]string, 0, len(batch))
		for _, number := range batch {
			appended = append(appended, "season/"+strconv.Itoa(number))
		}

		query := url.Values{"append_to_response": {strings.Join(appended, ",")}}
		setLanguage(query, language)

		var raw map[string]json.RawMessage
		if err := c.call(ctx, fmt.Sprintf("/tv/%d", id), query, &raw); err != nil {
			return nil, err
		}

		for _, key := range appended {
			body, ok := raw[key]
			if !ok || string(body) == "null" {
				continue
			}

			var season Season
			if err := json.Unmarshal(body, &season); err != nil {
				return nil, apperr.Wrap(err, apperr.KindUpstream, "decode tmdb %s", key)
			}

			seasons = append(seasons, season)
		}
	}

	return seasons, nil
}

func setLanguage(query url.Values, language string) {
	if language != "" {
		query.Set("language", language)
	}
}

func joinInts(values []int, separator string) string {
	parts := make([]string, 0, len(values))
	for _, value := range values {
		parts = append(parts, strconv.Itoa(value))
	}

	return strings.Join(parts, separator)
}
