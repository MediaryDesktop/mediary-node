package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
	"github.com/mediaryorg/mediary-node/server/internal/modules/tracker/internal/service"
)

type Handler struct {
	svc *service.Service
}

func New(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

type SessionOutput struct {
	Body struct {
		Connected    bool             `json:"connected" doc:"Whether an AniList access token is stored in this node."`
		Account      *service.Account `json:"account,omitempty" doc:"The connected account. Absent while AniList is unreachable and the account was never mirrored."`
		AuthorizeURL string           `json:"authorize_url,omitempty" doc:"Where to send the user to grant access. Absent when the node has no AniList client id configured."`
	}
}

type SignInInput struct {
	Body struct {
		AccessToken string `json:"access_token" minLength:"1" maxLength:"4096" doc:"Token from AniList's implicit grant."`
	}
}

type AccountOutput struct {
	Body *service.Account
}

type MediaTypeQuery struct {
	Type service.MediaType `query:"type" enum:"anime,manga,movie,series,dorama" required:"true" doc:"Which collection to read. Anime and manga are the AniList account's; movies, series and doramas are this node's own list."`
}

type EntryRefInput struct {
	MediaRef string `path:"media_ref" example:"tmdb:movie:603" doc:"The entry's media reference."`
}

type EntriesOutput struct {
	Body struct {
		MediaType service.MediaType `json:"media_type" doc:"The collection this response describes."`
		Entries   []service.Entry   `json:"entries" doc:"One entry per title, in AniList's list order."`
		Lists     []service.List    `json:"lists" doc:"Status and custom lists with their sizes."`
		FetchedAt time.Time         `json:"fetched_at" doc:"When AniList last answered for this collection."`
		Stale     bool              `json:"stale" doc:"True when the data is older than the refresh interval; a refresh is already running."`
		Sources   []httpapi.Source  `json:"sources" doc:"Attribution for every field that came from an external source."`
	}
}

type UpdateEntryInput struct {
	MediaRef string `path:"media_ref" example:"anilist:154587" doc:"The entry's media reference, as returned by listTrackerEntries."`
	Body     struct {
		Status          *string       `json:"status,omitempty" enum:"CURRENT,PLANNING,COMPLETED,DROPPED,PAUSED,REPEATING" doc:"New list status."`
		Score           *int          `json:"score,omitempty" minimum:"0" maximum:"100" doc:"Score on a 0-100 scale; clients convert from the account's score format."`
		Progress        *int          `json:"progress,omitempty" minimum:"0" doc:"Episodes watched or chapters read."`
		ProgressVolumes *int          `json:"progress_volumes,omitempty" minimum:"0" doc:"Volumes read; manga only."`
		Repeat          *int          `json:"repeat,omitempty" minimum:"0" doc:"How many times the title was rewatched or reread."`
		Notes           *string       `json:"notes,omitempty" doc:"Private notes only the account owner sees."`
		StartedAt       *service.Date `json:"started_at,omitempty" doc:"When the user started the title. Send every field empty to clear it."`
		CompletedAt     *service.Date `json:"completed_at,omitempty" doc:"When the user finished the title. Send every field empty to clear it."`
		CustomLists     *[]string     `json:"custom_lists,omitempty" doc:"The custom lists this title belongs to, by name. The lists left out are the ones it leaves."`
	}
}

type EntryOutput struct {
	Body *service.Entry
}

type AcceptedOutput struct {
	Body struct {
		Accepted bool `json:"accepted" doc:"The refresh was started or is already running."`
	}
}

type ListsOutput struct {
	Body struct {
		Lists   []service.CustomList `json:"lists" doc:"Every custom list the user made, across all media types."`
		Sources []httpapi.Source     `json:"sources" doc:"Attribution for every field that came from an external source."`
	}
}

type CreateListInput struct {
	Body struct {
		MediaType service.ListMediaType `json:"media_type" enum:"anime,manga,movie,series,dorama,book" required:"true" doc:"The one media type this list holds. A list never mixes types: anime and manga lists are created in the user's AniList account, the rest in this node."`
		Name      string                `json:"name" minLength:"1" maxLength:"100" doc:"What to call the list."`
		Icon      string                `json:"icon,omitempty" maxLength:"40" doc:"Icon for the list, by name from the client's icon set. Leave it out for the default."`
	}
}

type ListIDInput struct {
	ID string `path:"id" example:"anilist:anime:Rewatch" doc:"The list's identifier, as returned by listTrackerLists."`
}

type RenameListInput struct {
	ID   string `path:"id" doc:"The list's identifier, as returned by listTrackerLists."`
	Body struct {
		Name string  `json:"name" minLength:"1" maxLength:"100" doc:"The new name."`
		Icon *string `json:"icon,omitempty" maxLength:"40" doc:"New icon, by name. Leave it out to keep the current one; an empty string goes back to the default."`
	}
}

type ListOutput struct {
	Body *service.CustomList
}

func (h *Handler) Register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "getAniListSession",
		Method:      http.MethodGet,
		Path:        "/v1/anilist/session",
		Summary:     "AniList connection",
		Tags:        []string{"tracker"},
	}, func(ctx context.Context, _ *struct{}) (*SessionOutput, error) {
		session, err := h.svc.Session(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &SessionOutput{}
		out.Body.Connected = session.Connected
		out.Body.Account = session.Account
		out.Body.AuthorizeURL = session.AuthorizeURL

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "connectAniList",
		Method:      http.MethodPut,
		Path:        "/v1/anilist/session",
		Summary:     "Connect an AniList account",
		Description: "Validates the token against AniList before storing it, then starts fetching both collections in the background.",
		Tags:        []string{"tracker"},
	}, func(ctx context.Context, in *SignInInput) (*AccountOutput, error) {
		account, err := h.svc.SignIn(ctx, in.Body.AccessToken)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &AccountOutput{Body: account}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "disconnectAniList",
		Method:        http.MethodDelete,
		Path:          "/v1/anilist/session",
		Summary:       "Disconnect the AniList account",
		Description:   "Forgets the token and deletes the mirrored collections.",
		Tags:          []string{"tracker"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, _ *struct{}) (*struct{}, error) {
		if err := h.svc.SignOut(ctx); err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return nil, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "listTrackerEntries",
		Method:      http.MethodGet,
		Path:        "/v1/tracker/entries",
		Summary:     "Tracker entries",
		Description: "Served from the node's mirror, so it works offline. A stale mirror is returned immediately while a refresh runs; a `tracker` event announces the result. Movies, series and doramas are the node's own list: always current, no AniList account needed.",
		Tags:        []string{"tracker"},
	}, func(ctx context.Context, in *MediaTypeQuery) (*EntriesOutput, error) {
		collection, err := h.svc.Entries(ctx, in.Type)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &EntriesOutput{}
		out.Body.MediaType = collection.MediaType
		out.Body.Entries = collection.Entries
		out.Body.Lists = collection.Lists
		out.Body.FetchedAt = collection.FetchedAt
		out.Body.Stale = collection.Stale
		out.Body.Sources = []httpapi.Source{httpapi.AniListSource}
		if in.Type != service.MediaTypeAnime && in.Type != service.MediaTypeManga {
			out.Body.Sources = []httpapi.Source{httpapi.TMDBSource}
		}

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "updateTrackerEntry",
		Method:      http.MethodPut,
		Path:        "/v1/tracker/entries/{media_ref}",
		Summary:     "Update a tracker entry",
		Description: "An anime or manga entry is applied locally and queued for AniList, so it works offline. The returned entry already carries the change with `sync_pending: true`; a `tracker` event with reason `synced` follows once AniList has it. A progress lower than what AniList already holds is only sent when it is lower than what the user saw — so an older offline edit never rolls back progress made on another device. A title not in the lists yet is added instead: that goes straight to AniList and needs it reachable, lands in `PLANNING` unless a status is given, and comes back already synced. A movie, series or dorama (tmdb:…) is the node's own and saved at once; adding one the node has never fetched needs TMDB reachable. Progress on those starts the title and, at the last episode, completes it, as AniList's site does.",
		Tags:        []string{"tracker"},
	}, func(ctx context.Context, in *UpdateEntryInput) (*EntryOutput, error) {
		entry, err := h.svc.UpdateEntry(ctx, in.MediaRef, service.EntryPatch{
			Status:          in.Body.Status,
			Score:           in.Body.Score,
			Progress:        in.Body.Progress,
			ProgressVolumes: in.Body.ProgressVolumes,
			Repeat:          in.Body.Repeat,
			Notes:           in.Body.Notes,
			StartedAt:       in.Body.StartedAt,
			CompletedAt:     in.Body.CompletedAt,
			CustomLists:     in.Body.CustomLists,
		})
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &EntryOutput{Body: entry}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "deleteTrackerEntry",
		Method:        http.MethodDelete,
		Path:          "/v1/tracker/entries/{media_ref}",
		Summary:       "Remove a title from the list",
		Description:   "Takes the title off the node's own list and out of its custom lists. AniList entries are edited on AniList for now and answer 428.",
		Tags:          []string{"tracker"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, in *EntryRefInput) (*struct{}, error) {
		if err := h.svc.DeleteEntry(ctx, in.MediaRef); err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return nil, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "listTrackerLists",
		Method:      http.MethodGet,
		Path:        "/v1/tracker/lists",
		Summary:     "Custom lists",
		Description: "Every list the user made, in one response. Anime and manga lists are read from the node's AniList mirror, so they work offline; the other media types are the node's own. Status lists are not included — those are an entry's status, not a list.",
		Tags:        []string{"tracker"},
	}, func(ctx context.Context, _ *struct{}) (*ListsOutput, error) {
		lists, err := h.svc.Lists(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &ListsOutput{}
		out.Body.Lists = lists
		out.Body.Sources = []httpapi.Source{httpapi.AniListSource}

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "createTrackerList",
		Method:        http.MethodPost,
		Path:          "/v1/tracker/lists",
		Summary:       "Create a custom list",
		Description:   "An anime or manga list is created in the user's AniList account and needs AniList reachable; the other media types are stored in this node and work offline.",
		Tags:          []string{"tracker"},
		DefaultStatus: http.StatusCreated,
	}, func(ctx context.Context, in *CreateListInput) (*ListOutput, error) {
		list, err := h.svc.CreateList(ctx, in.Body.MediaType, in.Body.Name, in.Body.Icon)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &ListOutput{Body: list}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "renameTrackerList",
		Method:      http.MethodPatch,
		Path:        "/v1/tracker/lists/{id}",
		Summary:     "Rename a custom list or change its icon",
		Description: "The icon is the node's own: an AniList list keeps its name in AniList and its icon here, and the icon follows the list when it is renamed.",
		Tags:        []string{"tracker"},
	}, func(ctx context.Context, in *RenameListInput) (*ListOutput, error) {
		list, err := h.svc.UpdateList(ctx, in.ID, in.Body.Name, in.Body.Icon)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &ListOutput{Body: list}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "deleteTrackerList",
		Method:        http.MethodDelete,
		Path:          "/v1/tracker/lists/{id}",
		Summary:       "Delete a custom list",
		Description:   "Removes the list. Titles in it keep their entry and their status; they only lose this list's label.",
		Tags:          []string{"tracker"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, in *ListIDInput) (*struct{}, error) {
		if err := h.svc.DeleteList(ctx, in.ID); err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return nil, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "refreshTrackerEntries",
		Method:        http.MethodPost,
		Path:          "/v1/tracker/refresh",
		Summary:       "Refresh tracker entries",
		Description:   "Starts a background refresh; the result arrives as a `tracker` event.",
		Tags:          []string{"tracker"},
		DefaultStatus: http.StatusAccepted,
	}, func(ctx context.Context, in *MediaTypeQuery) (*AcceptedOutput, error) {
		if err := h.svc.RequestRefresh(ctx, in.Type); err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &AcceptedOutput{}
		out.Body.Accepted = true

		return out, nil
	})
}
