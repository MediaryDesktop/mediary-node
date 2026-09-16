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

func (h *Handler) Register(api huma.API) {
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
}
