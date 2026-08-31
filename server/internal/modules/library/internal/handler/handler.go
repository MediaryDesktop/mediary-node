package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/service"
)

type Handler struct {
	svc *service.Service
}

func New(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

type StatusOutput struct {
	Body struct {
		Module string `json:"module" example:"library" doc:"Module name."`
		Ready  bool   `json:"ready" doc:"True when the module's dependencies are wired."`
	}
}

func (h *Handler) Register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "getLibraryStatus",
		Method:      http.MethodGet,
		Path:        "/v1/library/status",
		Summary:     "Library module status",
		Description: "Reports whether the library module is wired. Placeholder for phase 0.",
		Tags:        []string{"library"},
	}, func(ctx context.Context, _ *struct{}) (*StatusOutput, error) {
		ready, err := h.svc.Status(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &StatusOutput{}
		out.Body.Module = "library"
		out.Body.Ready = ready

		return out, nil
	})
}
