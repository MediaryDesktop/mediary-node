package anilist

import (
	"context"
	_ "embed"
)

var (
	//go:embed queries/viewer.graphql
	viewerQuery string

	//go:embed queries/collection.graphql
	collectionQuery string
)

type MediaType string

const (
	MediaTypeAnime MediaType = "ANIME"
	MediaTypeManga MediaType = "MANGA"
)

type Viewer struct {
	ID      int    `json:"id"`
	Name    string `json:"name"`
	SiteURL string `json:"siteUrl"`
	Avatar  struct {
		Large  *string `json:"large"`
		Medium *string `json:"medium"`
	} `json:"avatar"`
	Options struct {
		DisplayAdultContent bool `json:"displayAdultContent"`
	} `json:"options"`
	MediaListOptions struct {
		ScoreFormat string `json:"scoreFormat"`
	} `json:"mediaListOptions"`
}

type FuzzyDate struct {
	Year  *int `json:"year"`
	Month *int `json:"month"`
	Day   *int `json:"day"`
}

type Media struct {
	ID          int     `json:"id"`
	IDMal       *int    `json:"idMal"`
	Type        string  `json:"type"`
	Format      *string `json:"format"`
	Status      *string `json:"status"`
	Episodes    *int    `json:"episodes"`
	Chapters    *int    `json:"chapters"`
	Volumes     *int    `json:"volumes"`
	SeasonYear  *int    `json:"seasonYear"`
	IsAdult     bool    `json:"isAdult"`
	SiteURL     string  `json:"siteUrl"`
	BannerImage *string `json:"bannerImage"`
	Title       struct {
		UserPreferred *string `json:"userPreferred"`
		Romaji        *string `json:"romaji"`
		English       *string `json:"english"`
		Native        *string `json:"native"`
	} `json:"title"`
	CoverImage struct {
		ExtraLarge *string `json:"extraLarge"`
		Large      *string `json:"large"`
		Medium     *string `json:"medium"`
		Color      *string `json:"color"`
	} `json:"coverImage"`
}

type ListEntry struct {
	ID              int       `json:"id"`
	MediaID         int       `json:"mediaId"`
	Status          string    `json:"status"`
	Score           float64   `json:"score"`
	Progress        *int      `json:"progress"`
	ProgressVolumes *int      `json:"progressVolumes"`
	Repeat          *int      `json:"repeat"`
	Private         bool      `json:"private"`
	Notes           *string   `json:"notes"`
	UpdatedAt       int64     `json:"updatedAt"`
	StartedAt       FuzzyDate `json:"startedAt"`
	CompletedAt     FuzzyDate `json:"completedAt"`
	Media           Media     `json:"media"`
}

type List struct {
	Name         string      `json:"name"`
	IsCustomList bool        `json:"isCustomList"`
	Status       *string     `json:"status"`
	Entries      []ListEntry `json:"entries"`
}

type Collection struct {
	Lists []List `json:"lists"`
}

func (c *Client) Viewer(ctx context.Context) (*Viewer, error) {
	token, err := c.storedToken()
	if err != nil {
		return nil, err
	}

	return c.ViewerWithToken(ctx, token)
}

func (c *Client) ViewerWithToken(ctx context.Context, token string) (*Viewer, error) {
	var data struct {
		Viewer *Viewer `json:"Viewer"`
	}

	if err := c.query(ctx, token, viewerQuery, nil, &data); err != nil {
		return nil, err
	}

	if data.Viewer == nil {
		return nil, apperrTokenRejected()
	}

	return data.Viewer, nil
}

func (c *Client) Collection(ctx context.Context, userID int, mediaType MediaType) (*Collection, error) {
	token, err := c.storedToken()
	if err != nil {
		return nil, err
	}

	var data struct {
		MediaListCollection *Collection `json:"MediaListCollection"`
	}

	variables := map[string]any{"userId": userID, "type": mediaType}
	if err := c.query(ctx, token, collectionQuery, variables, &data); err != nil {
		return nil, err
	}

	if data.MediaListCollection == nil {
		return &Collection{}, nil
	}

	return data.MediaListCollection, nil
}
