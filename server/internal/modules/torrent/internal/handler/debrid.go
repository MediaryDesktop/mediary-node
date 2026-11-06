package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/MediaryDesktop/mediary-node/server/internal/httpapi"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/service"
)

type TorrentDebridOutput struct {
	Body service.TorrentDebrid
}

type PutTorrentDebridInput struct {
	Body struct {
		Service string  `json:"service" enum:",torbox,realdebrid,alldebrid,premiumize" doc:"The service; empty turns it off."`
		APIKey  *string `json:"api_key,omitempty" maxLength:"256" doc:"The service's key. Left out keeps the saved key; empty removes it."`
	}
}

type CheckTorrentDebridInput struct {
	Body struct {
		Service string  `json:"service" enum:"torbox,realdebrid,alldebrid,premiumize"`
		APIKey  *string `json:"api_key,omitempty" maxLength:"256" doc:"A key to try; left out uses the saved one."`
	}
}

func (h *Handler) registerDebrid(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "getTorrentDebrid",
		Method:      http.MethodGet,
		Path:        "/v1/torrent/debrid",
		Summary:     "The debrid service",
		Description: "Set up apart from the torrent client. With a key it plays torrents without downloading them and marks the releases it holds in search, whatever the client; the library downloads through it only when the client is debrid. Keys are never returned.",
		Tags:        []string{"torrent"},
	}, func(ctx context.Context, _ *struct{}) (*TorrentDebridOutput, error) {
		debrid, err := h.svc.Debrid(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &TorrentDebridOutput{Body: *debrid}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "putTorrentDebrid",
		Method:      http.MethodPut,
		Path:        "/v1/torrent/debrid",
		Summary:     "Set up the debrid service",
		Description: "Each service keeps its own key in the node's secrets file, so switching back needs no key typed again. Turning the service off is refused while the torrent client downloads through it.",
		Tags:        []string{"torrent"},
	}, func(ctx context.Context, in *PutTorrentDebridInput) (*TorrentDebridOutput, error) {
		debrid, err := h.svc.UpdateDebrid(ctx, service.DebridUpdate{Service: in.Body.Service, APIKey: in.Body.APIKey})
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &TorrentDebridOutput{Body: *debrid}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "checkTorrentDebrid",
		Method:      http.MethodPost,
		Path:        "/v1/torrent/debrid/check",
		Summary:     "Try a debrid service's key",
		Description: "Signs in with the given key, or the saved one, and names the account and its plan. A free Real-Debrid, AllDebrid or Premiumize account is refused: those services play and download torrents only with premium.",
		Tags:        []string{"torrent"},
	}, func(ctx context.Context, in *CheckTorrentDebridInput) (*TorrentCheckOutput, error) {
		result, err := h.svc.CheckDebrid(ctx, in.Body.Service, in.Body.APIKey)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &TorrentCheckOutput{Body: *result}, nil
	})
}
