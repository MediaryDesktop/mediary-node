package anilist

import (
	"context"
	_ "embed"
)

var (
	//go:embed queries/search.graphql
	searchQuery string

	//go:embed queries/filter_options.graphql
	filterOptionsQuery string
)

// SearchParams mirrors AniList's own filter arguments. A zero value means the
// filter is not applied: the node never narrows a search the user did not
// narrow.
type SearchParams struct {
	Page       int
	PerPage    int
	Search     string
	Type       MediaType
	Sort       []string
	Genres     []string
	Tags       []string
	Formats    []string
	Statuses   []string
	Season     string
	SeasonYear int
	MinScore   int
	Adult      *bool
}

type PageInfo struct {
	Total       int  `json:"total"`
	CurrentPage int  `json:"currentPage"`
	LastPage    int  `json:"lastPage"`
	HasNextPage bool `json:"hasNextPage"`
	PerPage     int  `json:"perPage"`
}

type MediaSummary struct {
	ID           int       `json:"id"`
	IDMal        *int      `json:"idMal"`
	Type         string    `json:"type"`
	Format       *string   `json:"format"`
	Status       *string   `json:"status"`
	Episodes     *int      `json:"episodes"`
	Chapters     *int      `json:"chapters"`
	Volumes      *int      `json:"volumes"`
	Season       *string   `json:"season"`
	SeasonYear   *int      `json:"seasonYear"`
	AverageScore *int      `json:"averageScore"`
	Popularity   *int      `json:"popularity"`
	Genres       []string  `json:"genres"`
	IsAdult      bool      `json:"isAdult"`
	SiteURL      string    `json:"siteUrl"`
	BannerImage  *string   `json:"bannerImage"`
	StartDate    FuzzyDate `json:"startDate"`
	Title        Titles    `json:"title"`
	CoverImage   struct {
		ExtraLarge *string `json:"extraLarge"`
		Large      *string `json:"large"`
		Medium     *string `json:"medium"`
		Color      *string `json:"color"`
	} `json:"coverImage"`
	NextAiringEpisode *struct {
		Episode  int   `json:"episode"`
		AiringAt int64 `json:"airingAt"`
	} `json:"nextAiringEpisode"`
}

type SearchResult struct {
	PageInfo PageInfo       `json:"pageInfo"`
	Media    []MediaSummary `json:"media"`
}

type Tag struct {
	Name     string `json:"name"`
	Category string `json:"category"`
	IsAdult  bool   `json:"isAdult"`
}

type FilterOptions struct {
	Genres []string
	Tags   []Tag
}

// queryOptionalAuth signs the request with the stored token when there is one,
// because AniList hides adult titles from anonymous callers. A token AniList no
// longer accepts must not break browsing, so the call is retried anonymously.
func (c *Client) queryOptionalAuth(ctx context.Context, query string, variables map[string]any, out any) error {
	err := c.query(ctx, c.optionalToken(), query, variables, out)
	if err != nil && IsTokenRejected(err) {
		return c.query(ctx, "", query, variables, out)
	}

	return err
}

func (c *Client) Search(ctx context.Context, params SearchParams) (*SearchResult, error) {
	variables := map[string]any{"page": params.Page, "perPage": params.PerPage}

	if params.Search != "" {
		variables["search"] = params.Search
	}
	if params.Type != "" {
		variables["type"] = params.Type
	}
	if len(params.Sort) > 0 {
		variables["sort"] = params.Sort
	}
	if len(params.Genres) > 0 {
		variables["genres"] = params.Genres
	}
	if len(params.Tags) > 0 {
		variables["tags"] = params.Tags
	}
	if len(params.Formats) > 0 {
		variables["formats"] = params.Formats
	}
	if len(params.Statuses) > 0 {
		variables["statuses"] = params.Statuses
	}
	if params.Season != "" {
		variables["season"] = params.Season
	}
	if params.SeasonYear > 0 {
		variables["seasonYear"] = params.SeasonYear
	}
	if params.MinScore > 0 {
		variables["minimumScore"] = params.MinScore
	}
	if params.Adult != nil {
		variables["isAdult"] = *params.Adult
	}

	var data struct {
		Page *SearchResult `json:"Page"`
	}

	if err := c.queryOptionalAuth(ctx, searchQuery, variables, &data); err != nil {
		return nil, err
	}

	if data.Page == nil {
		return &SearchResult{}, nil
	}

	return data.Page, nil
}

func (c *Client) FilterOptions(ctx context.Context) (*FilterOptions, error) {
	var data struct {
		GenreCollection    []string `json:"GenreCollection"`
		MediaTagCollection []Tag    `json:"MediaTagCollection"`
	}

	if err := c.queryOptionalAuth(ctx, filterOptionsQuery, nil, &data); err != nil {
		return nil, err
	}

	return &FilterOptions{Genres: data.GenreCollection, Tags: data.MediaTagCollection}, nil
}
