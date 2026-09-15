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

type Source struct {
	ID   string `json:"id" example:"anilist" doc:"Stable source identifier."`
	Name string `json:"name" example:"AniList" doc:"Name to show next to the data."`
	URL  string `json:"url" example:"https://anilist.co" doc:"Where the attribution links to."`
}

var aniListSource = Source{ID: "anilist", Name: "AniList", URL: "https://anilist.co"}

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
	Type service.MediaType `query:"type" enum:"anime,manga" required:"true" doc:"Which collection to read."`
}

type EntriesOutput struct {
	Body struct {
		MediaType service.MediaType `json:"media_type" doc:"The collection this response describes."`
		Entries   []service.Entry   `json:"entries" doc:"One entry per title, in AniList's list order."`
		Lists     []service.List    `json:"lists" doc:"Status and custom lists with their sizes."`
		FetchedAt time.Time         `json:"fetched_at" doc:"When AniList last answered for this collection."`
		Stale     bool              `json:"stale" doc:"True when the data is older than the refresh interval; a refresh is already running."`
		Sources   []Source          `json:"sources" doc:"Attribution for every field that came from an external source."`
	}
}

type AcceptedOutput struct {
	Body struct {
		Accepted bool `json:"accepted" doc:"The refresh was started or is already running."`
	}
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
		Description: "Served from the node's mirror, so it works offline. A stale mirror is returned immediately while a refresh runs; a `tracker` event announces the result.",
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
		out.Body.Sources = []Source{aniListSource}

		return out, nil
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
