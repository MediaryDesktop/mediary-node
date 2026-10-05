package service

import "time"

type TitleNames struct {
	UserPreferred *string `json:"user_preferred"`
	Romaji        *string `json:"romaji"`
	English       *string `json:"english"`
	Native        *string `json:"native"`
}

type FuzzyDate struct {
	Year  *int `json:"year"`
	Month *int `json:"month"`
	Day   *int `json:"day"`
}

type AiringEpisode struct {
	Episode  int       `json:"episode"`
	AiringAt time.Time `json:"airing_at"`
}

type RelatedMedia struct {
	RelationType string     `json:"relation_type"`
	MediaRef     string     `json:"media_ref"`
	MediaType    string     `json:"media_type"`
	Format       *string    `json:"format"`
	Status       *string    `json:"status"`
	SeasonYear   *int       `json:"season_year"`
	Title        TitleNames `json:"title"`
	CoverImage   *string    `json:"cover_image"`
	CoverColor   *string    `json:"cover_color"`
}

type Trailer struct {
	ID        string  `json:"id" doc:"Video id on the hosting site."`
	Site      string  `json:"site" doc:"Where the video lives, e.g. youtube or dailymotion."`
	Thumbnail *string `json:"thumbnail" doc:"Preview frame for the trailer."`
}

type MediaDetails struct {
	MediaRef          string         `json:"media_ref"`
	MediaType         string         `json:"media_type"`
	Format            *string        `json:"format"`
	Status            *string        `json:"status"`
	Title             TitleNames     `json:"title"`
	Synonyms          []string       `json:"synonyms"`
	Description       string         `json:"description"`
	CoverImage        *string        `json:"cover_image"`
	CoverColor        *string        `json:"cover_color"`
	BannerImage       *string        `json:"banner_image"`
	Episodes          *int           `json:"episodes"`
	Chapters          *int           `json:"chapters"`
	Volumes           *int           `json:"volumes"`
	Duration          *int           `json:"duration"`
	Season            *string        `json:"season"`
	SeasonYear        *int           `json:"season_year"`
	StartDate         FuzzyDate      `json:"start_date"`
	EndDate           FuzzyDate      `json:"end_date"`
	AverageScore      *int           `json:"average_score"`
	MeanScore         *int           `json:"mean_score"`
	Popularity        *int           `json:"popularity"`
	Favourites        *int           `json:"favourites"`
	Genres            []string       `json:"genres"`
	Studios           []string       `json:"studios"`
	Source            *string        `json:"source"`
	CountryOfOrigin   *string        `json:"country_of_origin"`
	IsAdult           bool           `json:"is_adult"`
	SiteURL           string         `json:"site_url"`
	Trailer           *Trailer       `json:"trailer"`
	NextAiringEpisode *AiringEpisode `json:"next_airing_episode"`
	Relations         []RelatedMedia `json:"relations"`
	FetchedAt         time.Time      `json:"fetched_at"`
}

type MediaSummary struct {
	MediaRef          string         `json:"media_ref"`
	MediaType         string         `json:"media_type"`
	Format            *string        `json:"format"`
	Status            *string        `json:"status"`
	Title             TitleNames     `json:"title"`
	CoverImage        *string        `json:"cover_image"`
	CoverColor        *string        `json:"cover_color"`
	BannerImage       *string        `json:"banner_image"`
	Episodes          *int           `json:"episodes"`
	Chapters          *int           `json:"chapters"`
	Volumes           *int           `json:"volumes"`
	Season            *string        `json:"season"`
	SeasonYear        *int           `json:"season_year"`
	StartDate         FuzzyDate      `json:"start_date"`
	AverageScore      *int           `json:"average_score"`
	Popularity        *int           `json:"popularity"`
	Genres            []string       `json:"genres"`
	IsAdult           bool           `json:"is_adult"`
	SiteURL           string         `json:"site_url"`
	NextAiringEpisode *AiringEpisode `json:"next_airing_episode"`
}

type SearchParams struct {
	Query     string
	MediaType string
	Sort      string
	Genres    []string
	Tags      []string
	Formats   []string
	Statuses  []string
	Season    string
	Year      int
	MinScore  int
	Adult     bool
	Page      int
	PerPage   int
}

type SearchPage struct {
	Items       []MediaSummary `json:"items"`
	Page        int            `json:"page"`
	PerPage     int            `json:"per_page"`
	Total       int            `json:"total"`
	HasNextPage bool           `json:"has_next_page"`
}

type FilterTag struct {
	Name     string `json:"name"`
	Category string `json:"category"`
	IsAdult  bool   `json:"is_adult"`
}

type FilterOptions struct {
	Genres    []string    `json:"genres"`
	Tags      []FilterTag `json:"tags"`
	FetchedAt time.Time   `json:"fetched_at"`
}

// Episode is one episode as the title page lists it. Only the number is certain:
// every other field is whatever some source knew, and absent when none did.
type Episode struct {
	Number int `json:"number" doc:"Episode number within the title, from 1."`

	Title  *string           `json:"title" doc:"Episode title in the first language a source had it in, English first."`
	Titles map[string]string `json:"titles,omitempty" doc:"The title per language, keyed by BCP 47 tag (x-jat is romanised Japanese), for the client to pick the user's own."`

	Overview *string `json:"overview" doc:"Synopsis, in English."`
	Image    *string `json:"image" doc:"Still for the episode. Absent when no source has one; a client with the file can cut its own from it."`

	RuntimeMinutes *int    `json:"runtime_minutes" doc:"Length in minutes, from the episode or, failing that, the title's typical length."`
	AirDate        *string `json:"air_date" doc:"First broadcast, as YYYY-MM-DD."`
}

type EpisodeList struct {
	MediaRef string `json:"media_ref" doc:"The title, as provider:id."`

	Total *int `json:"total" doc:"Episodes the title has, or that have aired while the final count is unknown. Absent when no source can say."`

	Episodes []Episode `json:"episodes" doc:"One entry per episode, in order, whether or not anything is known about it beyond its number."`

	Sources []string `json:"-"`
}
