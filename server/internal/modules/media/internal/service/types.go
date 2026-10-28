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
	Season   *int      `json:"season,omitempty" doc:"Season the episode belongs to, for a show numbered by season. Absent for an anime, whose seasons are titles of their own."`
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
	Authors           []string       `json:"authors" doc:"Who wrote it; a book only."`
	Pages             *int           `json:"pages" doc:"Pages in a typical edition; a book only."`
	Source            *string        `json:"source"`
	CountryOfOrigin   *string        `json:"country_of_origin"`
	IsAdult           bool           `json:"is_adult"`
	SiteURL           string         `json:"site_url"`
	Trailer           *Trailer       `json:"trailer"`
	NextAiringEpisode *AiringEpisode `json:"next_airing_episode"`
	Relations         []RelatedMedia `json:"relations"`
	Recommendations   []RelatedMedia `json:"recommendations" doc:"Titles suggested to people who liked this one: AniList users' recommendations, or TMDB's own picks."`
	Similar           []RelatedMedia `json:"similar" doc:"Titles alike in genre and keywords. TMDB only; empty for an AniList title."`
	Editable          bool           `json:"editable" doc:"The user described this title themselves, so they may edit or delete it. Only manual:<id> titles; every other one belongs to its source."`
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
	Authors           []string       `json:"authors,omitempty" doc:"Who wrote it; a book only."`
	Pages             *int           `json:"pages,omitempty" doc:"Pages in a typical edition; a book only."`
	IsAdult           bool           `json:"is_adult"`
	SiteURL           string         `json:"site_url"`
	NextAiringEpisode *AiringEpisode `json:"next_airing_episode"`
	Description       string         `json:"description,omitempty" doc:"Plain-text synopsis, when the source's search carries one. Open Library's does not."`
	Editable          bool           `json:"editable,omitempty" doc:"A title the user described themselves; see MediaDetails.editable."`
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
	Country   string
	Page      int
	PerPage   int
}

type SearchPage struct {
	Items       []MediaSummary `json:"items"`
	Page        int            `json:"page"`
	PerPage     int            `json:"per_page"`
	Total       int            `json:"total"`
	HasNextPage bool           `json:"has_next_page"`

	// Sources names who answered when it is not the one the media type implies:
	// a book search Open Library had nothing for is answered by Google Books.
	Sources []string `json:"-"`
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
	Season *int `json:"season,omitempty" doc:"Season of a show numbered by season, from 1; the number then counts within it. Absent for an anime, whose seasons are titles of their own."`
	Number int  `json:"number" doc:"Episode number within the title, from 1, or within the season when one is given."`

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
