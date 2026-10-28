package handler

import (
	"context"
	"net/http"
	"strings"

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
	Type     string   `query:"type" enum:"anime,manga,movie,series,dorama,book" default:"anime" doc:"Which catalog to search. Every source owns one kind of media, so this also picks the source: AniList for anime and manga, TMDB for movies and shows, Open Library for books — and Google Books for a text search Open Library finds nothing for. A dorama is a live-action show from East Asia, and every dorama is a series too."`
	Sort     string   `query:"sort" enum:"SEARCH_MATCH,POPULARITY_DESC,TRENDING_DESC,SCORE_DESC,FAVOURITES_DESC,START_DATE_DESC,TITLE_ROMAJI" doc:"Order of the results. Left out it means relevance while searching and popularity while browsing. TMDB orders a text search by relevance only."`
	Genres   []string `query:"genres" doc:"Genres a title must all have, as listed by getMediaFilterOptions. TMDB applies them while browsing only."`
	Tags     []string `query:"tags" doc:"Tags a title must all have, as listed by getMediaFilterOptions. AniList only."`
	Formats  []string `query:"formats" enum:"TV,TV_SHORT,MOVIE,SPECIAL,OVA,ONA,MUSIC,MANGA,NOVEL,ONE_SHOT" doc:"Any of these formats. AniList only."`
	Statuses []string `query:"statuses" enum:"FINISHED,RELEASING,NOT_YET_RELEASED,CANCELLED,HIATUS" doc:"Any of these release statuses. AniList only."`
	Season   string   `query:"season" enum:"WINTER,SPRING,SUMMER,FALL" doc:"Season the title started in. AniList only."`
	Year     int      `query:"year" minimum:"1940" maximum:"2100" doc:"Year the title started in."`
	MinScore int      `query:"min_score" minimum:"0" maximum:"100" doc:"Keep titles scored above this, on a 0-100 scale."`
	Country  string   `query:"country" enum:"JP,KR,CN,TW" doc:"Where the title comes from: JP for manga, KR for manhwa, CN and TW for manhua. AniList only."`
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

type FilterOptionsInput struct {
	Type string `query:"type" enum:"anime,manga,movie,series,dorama,book" default:"anime" doc:"Which catalog's vocabulary to list."`
}

type TMDBSettingsOutput struct {
	Body *service.TMDBSettings
}

type TMDBKeyInput struct {
	Body struct {
		APIKey string `json:"api_key" maxLength:"1024" doc:"The user's own TMDB API key (v3) or read access token (v4). TMDB is asked to accept it before it is stored. Empty forgets it and goes back to the key this build ships with."`
	}
}

type GoogleBooksSettingsOutput struct {
	Body *service.GoogleBooksSettings
}

type GoogleBooksKeyInput struct {
	Body struct {
		APIKey string `json:"api_key" maxLength:"1024" doc:"The user's own Google API key with the Books API enabled. Google is asked to accept it before it is stored. Empty forgets it and goes back to the key this build ships with."`
	}
}

type FilterOptionsOutput struct {
	Body struct {
		Options *service.FilterOptions `json:"options" doc:"The vocabulary the filter panel offers."`
		Sources []httpapi.Source       `json:"sources" doc:"Attribution for every field that came from an external source."`
	}
}

type ManualInput struct {
	Body service.ManualDraft
}

type ManualUpdateInput struct {
	ID   string `path:"id" pattern:"^[0-9a-f]{20}$" doc:"The manual title's id: its media reference without the manual: prefix."`
	Body service.ManualDraft
}

type ManualIDInput struct {
	ID string `path:"id" pattern:"^[0-9a-f]{20}$" doc:"The manual title's id: its media reference without the manual: prefix."`
}

type ManualOutput struct {
	Body struct {
		Media *service.MediaDetails `json:"media" doc:"The title as its page shows it, under its manual:<id> reference."`
	}
}

type SuggestInput struct {
	Body service.ManualHint
}

type SuggestOutput struct {
	Body *service.ManualSuggestion
}

type AISettingsOutput struct {
	Body *service.AISettings
}

type AISettingsInput struct {
	Body struct {
		APIKey *string `json:"api_key,omitempty" maxLength:"1024" doc:"The user's own Anthropic API key. Anthropic is asked to accept it before it is stored. Empty forgets it; left out keeps the one stored."`
		Model  *string `json:"model,omitempty" doc:"The model to answer with, one of the settings' models. Left out keeps the one chosen."`
	}
}

func (h *Handler) registerManual(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID:   "createManualMedia",
		Method:        http.MethodPost,
		Path:          "/v1/media/manual",
		Summary:       "Describe a title no source knows",
		Description:   "Keeps a title the user describes themselves, for anything AniList, TMDB and the book sources do not have. It is the user's own data and never ages out. It gets a manual:<id> reference that every other endpoint takes — the tracker's, the library's — like a source's.",
		Tags:          []string{"media"},
		DefaultStatus: http.StatusCreated,
	}, func(ctx context.Context, in *ManualInput) (*ManualOutput, error) {
		details, err := h.svc.CreateManual(ctx, in.Body)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &ManualOutput{}
		out.Body.Media = details

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "updateManualMedia",
		Method:      http.MethodPut,
		Path:        "/v1/media/manual/{id}",
		Summary:     "Edit a title the user described",
		Description: "Replaces everything about the title with the body. Its kind cannot change: the title stays on the list of its kind.",
		Tags:        []string{"media"},
	}, func(ctx context.Context, in *ManualUpdateInput) (*ManualOutput, error) {
		details, err := h.svc.UpdateManual(ctx, in.ID, in.Body)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &ManualOutput{}
		out.Body.Media = details

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "suggestManualMedia",
		Method:      http.MethodPost,
		Path:        "/v1/media/manual/suggest",
		Summary:     "Ask Claude to fill in a title",
		Description: "Asks Claude, with the user's own Anthropic key, what it knows about a title from its kind and name. The answer is a draft and nothing is stored: the client shows it for the user to check, then creates or updates the title as usual. A title Claude does not know comes back with recognized false and little else. Without a key the node answers 428.",
		Tags:        []string{"media"},
	}, func(ctx context.Context, in *SuggestInput) (*SuggestOutput, error) {
		suggestion, err := h.svc.SuggestManual(ctx, in.Body)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &SuggestOutput{Body: suggestion}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getAISettings",
		Method:      http.MethodGet,
		Path:        "/v1/ai/settings",
		Summary:     "Claude connection",
		Description: "Whether titles can be filled in by Claude, with which model, and whether the user saved a key. The key itself is never returned.",
		Tags:        []string{"media"},
	}, func(_ context.Context, _ *struct{}) (*AISettingsOutput, error) {
		settings, err := h.svc.AISettings()
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &AISettingsOutput{Body: settings}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "setAISettings",
		Method:      http.MethodPut,
		Path:        "/v1/ai/settings",
		Summary:     "Set up Claude",
		Description: "Stores the user's own Anthropic key after Anthropic has accepted it, in a file only the user can read, never in the database or a backup, and the model to answer with. A key Anthropic refuses is not stored and answers 428.",
		Tags:        []string{"media"},
	}, func(ctx context.Context, in *AISettingsInput) (*AISettingsOutput, error) {
		settings, err := h.svc.SetAISettings(ctx, in.Body.APIKey, in.Body.Model)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &AISettingsOutput{Body: settings}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "deleteManualMedia",
		Method:        http.MethodDelete,
		Path:          "/v1/media/manual/{id}",
		Summary:       "Delete a title the user described",
		Description:   "Removes the title and takes it off the user's list. Library files matched to it stay where they are and can be matched again.",
		Tags:          []string{"media"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, in *ManualIDInput) (*struct{}, error) {
		if err := h.svc.DeleteManual(ctx, in.ID); err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return nil, nil
	})
}

func (h *Handler) Register(api huma.API) {
	h.registerManual(api)

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
			Country:   in.Country,
			Page:      in.Page,
			PerPage:   in.PerPage,
		})
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &SearchOutput{}
		out.Body.Results = results
		out.Body.Sources = []httpapi.Source{sourceOfType(in.Type)}
		if len(results.Sources) > 0 {
			out.Body.Sources = sourcesOf(results.Sources)
		}

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getMediaFilterOptions",
		Method:      http.MethodGet,
		Path:        "/v1/media/filter-options",
		Summary:     "Genres and tags to filter by",
		Description: "The source's own vocabulary, kept for at most a day. Formats, statuses and seasons are fixed enums of searchMedia and are not repeated here. TMDB has genres and no tags.",
		Tags:        []string{"media"},
	}, func(ctx context.Context, in *FilterOptionsInput) (*FilterOptionsOutput, error) {
		options, err := h.svc.FilterOptions(ctx, in.Type)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &FilterOptionsOutput{}
		out.Body.Options = options
		out.Body.Sources = []httpapi.Source{sourceOfType(in.Type)}

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getTMDBSettings",
		Method:      http.MethodGet,
		Path:        "/v1/tmdb/settings",
		Summary:     "TMDB connection",
		Description: "Whether movies and shows can be looked up, and with whose key. The key itself is never returned.",
		Tags:        []string{"media"},
	}, func(_ context.Context, _ *struct{}) (*TMDBSettingsOutput, error) {
		settings, err := h.svc.TMDBSettings()
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &TMDBSettingsOutput{Body: settings}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getGoogleBooksSettings",
		Method:      http.MethodGet,
		Path:        "/v1/google-books/settings",
		Summary:     "Google Books connection",
		Description: "Whether books Open Library does not know can be looked up on Google Books, and with whose key. The key itself is never returned.",
		Tags:        []string{"media"},
	}, func(_ context.Context, _ *struct{}) (*GoogleBooksSettingsOutput, error) {
		settings, err := h.svc.GoogleBooksSettings()
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &GoogleBooksSettingsOutput{Body: settings}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "setGoogleBooksKey",
		Method:      http.MethodPut,
		Path:        "/v1/google-books/settings",
		Summary:     "Use your own Google Books key",
		Description: "Checks the key with Google, then keeps it in a file only the user can read, never in the database or a backup. A key Google refuses is not stored and answers 428.",
		Tags:        []string{"media"},
	}, func(ctx context.Context, in *GoogleBooksKeyInput) (*GoogleBooksSettingsOutput, error) {
		settings, err := h.svc.SetGoogleBooksKey(ctx, in.Body.APIKey)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &GoogleBooksSettingsOutput{Body: settings}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "setTMDBKey",
		Method:      http.MethodPut,
		Path:        "/v1/tmdb/settings",
		Summary:     "Use your own TMDB key",
		Description: "Checks the key with TMDB, then keeps it in a file only the user can read, never in the database or a backup. A key TMDB refuses is not stored and answers 428.",
		Tags:        []string{"media"},
	}, func(ctx context.Context, in *TMDBKeyInput) (*TMDBSettingsOutput, error) {
		settings, err := h.svc.SetTMDBKey(ctx, in.Body.APIKey)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &TMDBSettingsOutput{Body: settings}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getMediaDetails",
		Method:      http.MethodGet,
		Path:        "/v1/media/{media_ref}",
		Summary:     "Title details",
		Description: "Fetched from the source on demand and kept for at most a day, as the source's terms allow. Past that the node asks again; while the source is unreachable the request fails, and clients fall back to what the user's own list already knows about the title. A reference is anilist:<id>, tmdb:movie:<id>, tmdb:tv:<id>, openlibrary:<work id>, googlebooks:<volume id> or manual:<id> — a title the user described, read from the node itself and never out of date.",
		Tags:        []string{"media"},
	}, func(ctx context.Context, in *DetailsInput) (*DetailsOutput, error) {
		details, err := h.svc.Details(ctx, in.MediaRef)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &DetailsOutput{}
		out.Body.Media = details
		out.Body.Sources = []httpapi.Source{}

		// A title the user described has no source to credit.
		if !strings.HasPrefix(in.MediaRef, service.ProviderManual+":") {
			out.Body.Sources = append(out.Body.Sources, sourceOfRef(in.MediaRef))
		}

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getMediaEpisodes",
		Method:      http.MethodGet,
		Path:        "/v1/media/{media_ref}/episodes",
		Summary:     "Episodes of a title",
		Description: "Titles, synopses and stills per episode, gathered on demand from ani.zip and from the streaming listings AniList carries, each kept for at most a day. A source that fails or knows nothing only leaves its fields empty: the list always has one entry per episode the title is known to have. A TMDB show lists its regular seasons, numbered within each and specials left out; a movie is one episode.",
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
		case service.ProviderTMDB:
			sources = append(sources, httpapi.TMDBSource)
		case service.ProviderOpenLibrary:
			sources = append(sources, httpapi.OpenLibrarySource)
		case service.ProviderGoogleBooks:
			sources = append(sources, httpapi.GoogleBooksSource)
		}
	}

	return sources
}

func sourceOfType(mediaType string) httpapi.Source {
	switch mediaType {
	case service.MediaTypeMovie, service.MediaTypeSeries, service.MediaTypeDorama:
		return httpapi.TMDBSource
	case service.MediaTypeBook:
		return httpapi.OpenLibrarySource
	default:
		return httpapi.AniListSource
	}
}

func sourceOfRef(mediaRef string) httpapi.Source {
	if strings.HasPrefix(mediaRef, service.ProviderTMDB+":") {
		return httpapi.TMDBSource
	}

	if strings.HasPrefix(mediaRef, service.ProviderOpenLibrary+":") {
		return httpapi.OpenLibrarySource
	}

	if strings.HasPrefix(mediaRef, service.ProviderGoogleBooks+":") {
		return httpapi.GoogleBooksSource
	}

	return httpapi.AniListSource
}
