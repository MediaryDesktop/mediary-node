package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/service"
)

type Handler struct {
	svc *service.Service
}

func New(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

type StatusOutput struct {
	Body struct {
		Module string `json:"module" example:"torrent" doc:"Module name."`
		Ready  bool   `json:"ready" doc:"True when the module's dependencies are wired."`
	}
}

func (h *Handler) Register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "getTorrentStatus",
		Method:      http.MethodGet,
		Path:        "/v1/torrent/status",
		Summary:     "Torrent module status",
		Description: "Reports whether the torrent module is wired. Placeholder for phase 0.",
		Tags:        []string{"torrent"},
	}, func(ctx context.Context, _ *struct{}) (*StatusOutput, error) {
		ready, err := h.svc.Status(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &StatusOutput{}
		out.Body.Module = "torrent"
		out.Body.Ready = ready

		return out, nil
	})
}
