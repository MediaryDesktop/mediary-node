package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
	"github.com/mediaryorg/mediary-node/server/internal/modules/tools/internal/service"
)

type Handler struct {
	svc *service.Service
}

func New(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

type ToolsOutput struct {
	Body struct {
		Tools []service.Tool `json:"tools"`
	}
}

type ToolInput struct {
	ID string `path:"id" enum:"mpv,ffmpeg"`
}

type ToolOutput struct {
	Body service.Tool
}

func (h *Handler) Register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "listTools",
		Method:      http.MethodGet,
		Path:        "/v1/tools",
		Summary:     "The programs the node runs",
		Description: "mpv plays files in its own window; FFmpeg transcodes, cuts stills and pulls out tracks. Each is found at the path set by hand, else the node's own copy, else on PATH. Changes arrive on the tools topic.",
		Tags:        []string{"tools"},
	}, func(context.Context, *struct{}) (*ToolsOutput, error) {
		out := &ToolsOutput{}
		out.Body.Tools = h.svc.List()

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "installTool",
		Method:      http.MethodPost,
		Path:        "/v1/tools/{id}/install",
		Summary:     "Install or update a program",
		Description: "Downloads the official build the node names, at the version it pins, and refuses it unless its SHA-256 matches. It returns at once; the install goes on in the background. Refused where a path is set by hand.",
		Tags:        []string{"tools"},
	}, func(_ context.Context, in *ToolInput) (*ToolOutput, error) {
		tool, err := h.svc.Install(in.ID) //nolint:contextcheck // the install outlives the request that started it
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &ToolOutput{Body: *tool}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "cancelToolInstall",
		Method:      http.MethodDelete,
		Path:        "/v1/tools/{id}/install",
		Summary:     "Stop installing a program",
		Description: "Nothing of the install stays on disk; the version in use, if any, stays as it was.",
		Tags:        []string{"tools"},
	}, func(_ context.Context, in *ToolInput) (*ToolOutput, error) {
		tool, err := h.svc.Cancel(in.ID)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &ToolOutput{Body: *tool}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "removeTool",
		Method:      http.MethodDelete,
		Path:        "/v1/tools/{id}",
		Summary:     "Remove the node's copy of a program",
		Description: "The program comes from PATH again, if it is there.",
		Tags:        []string{"tools"},
	}, func(_ context.Context, in *ToolInput) (*ToolOutput, error) {
		tool, err := h.svc.Remove(in.ID)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &ToolOutput{Body: *tool}, nil
	})
}
