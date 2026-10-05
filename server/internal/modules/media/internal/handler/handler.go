package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
	"github.com/mediaryorg/mediary-node/server/internal/modules/media/internal/service"
)

type Handler struct {
	svc *service.Service
}

func New(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

type DetailsInput struct {
	MediaRef string `path:"media_ref" example:"anilist:154587" doc:"The title's media reference."`
}

type DetailsOutput struct {
	Body struct {
		Media   *service.MediaDetails `json:"media" doc:"Everything a title page shows about the title itself."`
		Sources []httpapi.Source      `json:"sources" doc:"Attribution for every field that came from an external source."`
	}
}

type EpisodesOutput struct {
	Body struct {
		Episodes *service.EpisodeList `json:"episodes" doc:"The title's episodes with whatever the sources know of each."`
		Sources  []httpapi.Source     `json:"sources" doc:"Attribution for every field that came from an external source."`
	}
}

type SearchInput struct {
	Query    string   `query:"q" maxLength:"100" doc:"Free text to match against every title the source knows. Empty browses by the filters alone."`
	Type     string   `query:"type" enum:"anime,manga" default:"anime" doc:"Which catalog to search. Every source owns one kind of media, so this also picks the source."`
	Sort     string   `query:"sort" enum:"SEARCH_MATCH,POPULARITY_DESC,TRENDING_DESC,SCORE_DESC,FAVOURITES_DESC,START_DATE_DESC,TITLE_ROMAJI" doc:"Order of the results. Left out it means relevance while searching and popularity while browsing."`
	Genres   []string `query:"genres" doc:"Genres a title must all have, as listed by getMediaFilterOptions."`
	Tags     []string `query:"tags" doc:"Tags a title must all have, as listed by getMediaFilterOptions."`
	Formats  []string `query:"formats" enum:"TV,TV_SHORT,MOVIE,SPECIAL,OVA,ONA,MUSIC,MANGA,NOVEL,ONE_SHOT" doc:"Any of these formats."`
	Statuses []string `query:"statuses" enum:"FINISHED,RELEASING,NOT_YET_RELEASED,CANCELLED,HIATUS" doc:"Any of these release statuses."`
	Season   string   `query:"season" enum:"WINTER,SPRING,SUMMER,FALL" doc:"Season the title started in."`
	Year     int      `query:"year" minimum:"1940" maximum:"2100" doc:"Year the title started in."`
	MinScore int      `query:"min_score" minimum:"0" maximum:"100" doc:"Keep titles scored above this, on a 0-100 scale."`
	Adult    bool     `query:"adult" doc:"Include adult titles. They are left out unless this is set, and the source hides them entirely from a node with no account connected."`
	Page     int      `query:"page" minimum:"1" default:"1" doc:"Which page of results to return."`
	PerPage  int      `query:"per_page" minimum:"1" maximum:"50" default:"30" doc:"How many titles per page."`
}

type SearchOutput struct {
	Body struct {
		Results *service.SearchPage `json:"results" doc:"One page of titles, plus what it takes to ask for the next."`
		Sources []httpapi.Source    `json:"sources" doc:"Attribution for every field that came from an external source."`
	}
}

type FilterOptionsOutput struct {
	Body struct {
		Options *service.FilterOptions `json:"options" doc:"The vocabulary the filter panel offers."`
		Sources []httpapi.Source       `json:"sources" doc:"Attribution for every field that came from an external source."`
	}
}

func (h *Handler) Register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "searchMedia",
		Method:      http.MethodGet,
		Path:        "/v1/media/search",
		Summary:     "Search titles",
		Description: "Asks the source that owns this kind of media, on demand and never in the background. Results are not stored: only a title the user opens is cached, and only for as long as the source's terms allow.",
		Tags:        []string{"media"},
	}, func(ctx context.Context, in *SearchInput) (*SearchOutput, error) {
		results, err := h.svc.Search(ctx, service.SearchParams{
			Query:     in.Query,
			MediaType: in.Type,
			Sort:      in.Sort,
			Genres:    in.Genres,
			Tags:      in.Tags,
			Formats:   in.Formats,
			Statuses:  in.Statuses,
			Season:    in.Season,
			Year:      in.Year,
			MinScore:  in.MinScore,
			Adult:     in.Adult,
			Page:      in.Page,
			PerPage:   in.PerPage,
		})
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &SearchOutput{}
		out.Body.Results = results
		out.Body.Sources = []httpapi.Source{httpapi.AniListSource}

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getMediaFilterOptions",
		Method:      http.MethodGet,
		Path:        "/v1/media/filter-options",
		Summary:     "Genres and tags to filter by",
		Description: "The source's own vocabulary, kept for at most a day. Formats, statuses and seasons are fixed enums of searchMedia and are not repeated here.",
		Tags:        []string{"media"},
	}, func(ctx context.Context, _ *struct{}) (*FilterOptionsOutput, error) {
		options, err := h.svc.FilterOptions(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &FilterOptionsOutput{}
		out.Body.Options = options
		out.Body.Sources = []httpapi.Source{httpapi.AniListSource}

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getMediaDetails",
		Method:      http.MethodGet,
		Path:        "/v1/media/{media_ref}",
		Summary:     "Title details",
		Description: "Fetched from the source on demand and kept for at most a day, as the source's terms allow. Past that the node asks again; while the source is unreachable the request fails, and clients fall back to what the user's own list already knows about the title.",
		Tags:        []string{"media"},
	}, func(ctx context.Context, in *DetailsInput) (*DetailsOutput, error) {
		details, err := h.svc.Details(ctx, in.MediaRef)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &DetailsOutput{}
		out.Body.Media = details
		out.Body.Sources = []httpapi.Source{httpapi.AniListSource}

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getMediaEpisodes",
		Method:      http.MethodGet,
		Path:        "/v1/media/{media_ref}/episodes",
		Summary:     "Episodes of a title",
		Description: "Titles, synopses and stills per episode, gathered on demand from ani.zip and from the streaming listings AniList carries, each kept for at most a day. A source that fails or knows nothing only leaves its fields empty: the list always has one entry per episode the title is known to have.",
		Tags:        []string{"media"},
	}, func(ctx context.Context, in *DetailsInput) (*EpisodesOutput, error) {
		episodes, err := h.svc.Episodes(ctx, in.MediaRef)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &EpisodesOutput{}
		out.Body.Episodes = episodes
		out.Body.Sources = sourcesOf(episodes.Sources)

		return out, nil
	})
}

func sourcesOf(ids []string) []httpapi.Source {
	sources := make([]httpapi.Source, 0, len(ids))

	for _, id := range ids {
		switch id {
		case service.ProviderAniList:
			sources = append(sources, httpapi.AniListSource)
		case service.ProviderAniZip:
			sources = append(sources, httpapi.AniZipSource)
		}
	}

	return sources
}
