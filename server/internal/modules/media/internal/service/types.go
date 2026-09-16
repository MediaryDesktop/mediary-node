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
	NextAiringEpisode *AiringEpisode `json:"next_airing_episode"`
	Relations         []RelatedMedia `json:"relations"`
	FetchedAt         time.Time      `json:"fetched_at"`
}
