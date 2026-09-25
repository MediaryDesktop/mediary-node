package service

import (
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anilist"
)

type MediaType string

const (
	MediaTypeAnime MediaType = "anime"
	MediaTypeManga MediaType = "manga"
)

const ProviderAniList = "anilist"

type Account struct {
	ID                  int     `json:"id"`
	Name                string  `json:"name"`
	SiteURL             string  `json:"site_url"`
	AvatarURL           *string `json:"avatar_url"`
	ScoreFormat         string  `json:"score_format"`
	DisplayAdultContent bool    `json:"display_adult_content"`
}

type Session struct {
	Connected    bool
	Account      *Account
	AuthorizeURL string
}

type Date struct {
	Year  *int `json:"year"`
	Month *int `json:"month"`
	Day   *int `json:"day"`
}

// validate rejects a date AniList would not store. A date with every field
// empty is how a client clears one, so it passes.
func (d Date) validate(field string) error {
	if d.Month != nil && (*d.Month < 1 || *d.Month > 12) {
		return apperr.Invalid(field, "month must be between 1 and 12")
	}

	if d.Day != nil && (*d.Day < 1 || *d.Day > 31) {
		return apperr.Invalid(field, "day must be between 1 and 31")
	}

	if d.Year != nil && (*d.Year < 1900 || *d.Year > 2200) {
		return apperr.Invalid(field, "year must be between 1900 and 2200")
	}

	if d.Year == nil && (d.Month != nil || d.Day != nil) {
		return apperr.Invalid(field, "a date needs a year")
	}

	if d.Month == nil && d.Day != nil {
		return apperr.Invalid(field, "a day needs a month")
	}

	return nil
}

func (d Date) aniList() *anilist.FuzzyDate {
	return &anilist.FuzzyDate{Year: d.Year, Month: d.Month, Day: d.Day}
}

type Title struct {
	UserPreferred *string `json:"user_preferred"`
	Romaji        *string `json:"romaji"`
	English       *string `json:"english"`
	Native        *string `json:"native"`
}

type Media struct {
	Title        Title    `json:"title"`
	Format       *string  `json:"format"`
	Status       *string  `json:"status"`
	Episodes     *int     `json:"episodes"`
	Chapters     *int     `json:"chapters"`
	Volumes      *int     `json:"volumes"`
	SeasonYear   *int     `json:"season_year"`
	IsAdult      bool     `json:"is_adult"`
	CoverImage   *string  `json:"cover_image"`
	CoverColor   *string  `json:"cover_color"`
	BannerImage  *string  `json:"banner_image"`
	SiteURL      string   `json:"site_url"`
	Genres       []string `json:"genres"`
	AverageScore *int     `json:"average_score"`
}

type Entry struct {
	MediaRef        string    `json:"media_ref"`
	Provider        string    `json:"provider"`
	MediaType       MediaType `json:"media_type"`
	Status          string    `json:"status"`
	Score           int       `json:"score"`
	Progress        int       `json:"progress"`
	ProgressVolumes *int      `json:"progress_volumes"`
	Repeat          int       `json:"repeat"`
	Private         bool      `json:"private"`
	Notes           string    `json:"notes"`
	StartedAt       Date      `json:"started_at"`
	CompletedAt     Date      `json:"completed_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	CustomLists     []string  `json:"custom_lists"`
	SyncPending     bool      `json:"sync_pending"`
	Media           Media     `json:"media"`
}

type List struct {
	Name   string  `json:"name"`
	Custom bool    `json:"custom"`
	Status *string `json:"status"`
	Count  int     `json:"count"`
}

type Collection struct {
	MediaType MediaType `json:"media_type"`
	Entries   []Entry   `json:"entries"`
	Lists     []List    `json:"lists"`
	FetchedAt time.Time `json:"fetched_at"`
	Stale     bool      `json:"-"`
}
