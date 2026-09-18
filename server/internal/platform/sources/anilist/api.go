package anilist

import (
	"context"
	_ "embed"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

var (
	//go:embed queries/viewer.graphql
	viewerQuery string

	//go:embed queries/collection.graphql
	collectionQuery string

	//go:embed queries/save_entry.graphql
	saveEntryMutation string

	//go:embed queries/media_list.graphql
	mediaListQuery string

	//go:embed queries/media_details.graphql
	mediaDetailsQuery string
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

type EntryChange struct {
	MediaID         int     `json:"mediaId"`
	Status          *string `json:"status,omitempty"`
	ScoreRaw        *int    `json:"scoreRaw,omitempty"`
	Progress        *int    `json:"progress,omitempty"`
	ProgressVolumes *int    `json:"progressVolumes,omitempty"`
	Repeat          *int    `json:"repeat,omitempty"`
}

type RemoteProgress struct {
	ID              int     `json:"id"`
	Status          *string `json:"status"`
	Progress        *int    `json:"progress"`
	ProgressVolumes *int    `json:"progressVolumes"`
}

func (c *Client) SaveEntry(ctx context.Context, change EntryChange) (*ListEntry, error) {
	token, err := c.storedToken()
	if err != nil {
		return nil, err
	}

	variables := map[string]any{"mediaId": change.MediaID}
	if change.Status != nil {
		variables["status"] = *change.Status
	}
	if change.ScoreRaw != nil {
		variables["scoreRaw"] = *change.ScoreRaw
	}
	if change.Progress != nil {
		variables["progress"] = *change.Progress
	}
	if change.ProgressVolumes != nil {
		variables["progressVolumes"] = *change.ProgressVolumes
	}
	if change.Repeat != nil {
		variables["repeat"] = *change.Repeat
	}

	var data struct {
		SaveMediaListEntry *ListEntry `json:"SaveMediaListEntry"`
	}

	if err := c.query(ctx, token, saveEntryMutation, variables, &data); err != nil {
		return nil, err
	}

	if data.SaveMediaListEntry == nil {
		return nil, apperr.New(apperr.KindUpstream, "anilist returned no entry for media %d", change.MediaID)
	}

	return data.SaveMediaListEntry, nil
}

func (c *Client) RemoteProgress(ctx context.Context, userID, mediaID int) (*RemoteProgress, error) {
	token, err := c.storedToken()
	if err != nil {
		return nil, err
	}

	var data struct {
		MediaList *RemoteProgress `json:"MediaList"`
	}

	variables := map[string]any{"userId": userID, "mediaId": mediaID}
	if err := c.query(ctx, token, mediaListQuery, variables, &data); err != nil {
		if apperr.KindOf(err) == apperr.KindNotFound {
			return nil, nil
		}
		return nil, err
	}

	return data.MediaList, nil
}

type Titles struct {
	UserPreferred *string `json:"userPreferred"`
	Romaji        *string `json:"romaji"`
	English       *string `json:"english"`
	Native        *string `json:"native"`
}

type Relation struct {
	RelationType string `json:"relationType"`
	Node         struct {
		ID         int     `json:"id"`
		Type       string  `json:"type"`
		Format     *string `json:"format"`
		Status     *string `json:"status"`
		SeasonYear *int    `json:"seasonYear"`
		Title      Titles  `json:"title"`
		CoverImage struct {
			Large  *string `json:"large"`
			Medium *string `json:"medium"`
			Color  *string `json:"color"`
		} `json:"coverImage"`
	} `json:"node"`
}

type MediaDetails struct {
	ID              int       `json:"id"`
	IDMal           *int      `json:"idMal"`
	Type            string    `json:"type"`
	Format          *string   `json:"format"`
	Status          *string   `json:"status"`
	Episodes        *int      `json:"episodes"`
	Chapters        *int      `json:"chapters"`
	Volumes         *int      `json:"volumes"`
	Duration        *int      `json:"duration"`
	Season          *string   `json:"season"`
	SeasonYear      *int      `json:"seasonYear"`
	AverageScore    *int      `json:"averageScore"`
	MeanScore       *int      `json:"meanScore"`
	Popularity      *int      `json:"popularity"`
	Favourites      *int      `json:"favourites"`
	Genres          []string  `json:"genres"`
	Synonyms        []string  `json:"synonyms"`
	CountryOfOrigin *string   `json:"countryOfOrigin"`
	IsAdult         bool      `json:"isAdult"`
	SiteURL         string    `json:"siteUrl"`
	Source          *string   `json:"source"`
	BannerImage     *string   `json:"bannerImage"`
	Description     *string   `json:"description"`
	StartDate       FuzzyDate `json:"startDate"`
	EndDate         FuzzyDate `json:"endDate"`
	Title           Titles    `json:"title"`
	CoverImage      struct {
		ExtraLarge *string `json:"extraLarge"`
		Large      *string `json:"large"`
		Medium     *string `json:"medium"`
		Color      *string `json:"color"`
	} `json:"coverImage"`
	Trailer *struct {
		ID        *string `json:"id"`
		Site      *string `json:"site"`
		Thumbnail *string `json:"thumbnail"`
	} `json:"trailer"`
	NextAiringEpisode *struct {
		Episode  int   `json:"episode"`
		AiringAt int64 `json:"airingAt"`
	} `json:"nextAiringEpisode"`
	Studios struct {
		Nodes []struct {
			ID   int    `json:"id"`
			Name string `json:"name"`
		} `json:"nodes"`
	} `json:"studios"`
	Relations struct {
		Edges []Relation `json:"edges"`
	} `json:"relations"`
}

func (c *Client) optionalToken() string {
	if c.tokens == nil {
		return ""
	}

	token, err := c.tokens.Token()
	if err != nil {
		return ""
	}

	return token
}

func (c *Client) MediaDetails(ctx context.Context, mediaID int) (*MediaDetails, error) {
	var data struct {
		Media *MediaDetails `json:"Media"`
	}

	variables := map[string]any{"id": mediaID}
	if err := c.queryOptionalAuth(ctx, mediaDetailsQuery, variables, &data); err != nil {
		return nil, err
	}

	if data.Media == nil {
		return nil, apperr.New(apperr.KindNotFound, "anilist has no media %d", mediaID)
	}

	return data.Media, nil
}
