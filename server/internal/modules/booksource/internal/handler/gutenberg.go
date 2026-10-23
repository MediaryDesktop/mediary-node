package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/gutenberg"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

type GutenbergSettingsBody struct {
	Available bool       `json:"available" doc:"False when the node is configured without Project Gutenberg."`
	Enabled   bool       `json:"enabled" doc:"Off until the user turns it on; turning it on downloads the catalogue (about 6 MB, mostly books in English)."`
	Syncing   bool       `json:"syncing" doc:"The catalogue is being downloaded or checked. Changes arrive on the books.catalog topic."`
	Books     int64      `json:"books" doc:"Books in the node's copy of the catalogue; 0 until it is downloaded."`
	UpdatedAt *time.Time `json:"updated_at,omitempty" doc:"When the node took the catalogue it has."`
	CheckedAt *time.Time `json:"checked_at,omitempty" doc:"When the node last asked for a newer one; it asks once a week."`
	Error     string     `json:"error,omitempty" doc:"Why the last download or check failed."`
}

type GutenbergSettingsOutput struct {
	Body GutenbergSettingsBody
}

type PutGutenbergSettingsInput struct {
	Body struct {
		Enabled bool `json:"enabled"`
	}
}

func (h *Handler) registerGutenberg(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "getGutenbergSettings",
		Method:      http.MethodGet,
		Path:        "/v1/books/sources/gutenberg",
		Summary:     "Project Gutenberg as a source of books",
		Tags:        []string{"books"},
	}, func(ctx context.Context, _ *struct{}) (*GutenbergSettingsOutput, error) {
		if h.gutenberg == nil {
			return &GutenbergSettingsOutput{}, nil
		}

		settings, err := h.gutenberg.Settings(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &GutenbergSettingsOutput{Body: gutenbergBody(settings)}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "putGutenbergSettings",
		Method:      http.MethodPut,
		Path:        "/v1/books/sources/gutenberg",
		Summary:     "Turn Project Gutenberg on or off",
		Description: "On, the node downloads Gutenberg's catalogue and searches it locally: the site is asked only for a book the user downloads. Off removes the catalogue.",
		Tags:        []string{"books"},
	}, func(ctx context.Context, in *PutGutenbergSettingsInput) (*GutenbergSettingsOutput, error) {
		if h.gutenberg == nil {
			return nil, httpapi.ToHTTP(apperr.New(apperr.KindPrecondition, "Project Gutenberg is turned off on this node"))
		}

		settings, err := h.gutenberg.SetEnabled(ctx, in.Body.Enabled)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &GutenbergSettingsOutput{Body: gutenbergBody(settings)}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "refreshGutenbergCatalog",
		Method:        http.MethodPost,
		Path:          "/v1/books/sources/gutenberg/refresh",
		Summary:       "Check for a newer Project Gutenberg catalogue now",
		Tags:          []string{"books"},
		DefaultStatus: http.StatusAccepted,
	}, func(ctx context.Context, _ *struct{}) (*GutenbergSettingsOutput, error) {
		if h.gutenberg == nil {
			return nil, httpapi.ToHTTP(apperr.New(apperr.KindPrecondition, "Project Gutenberg is turned off on this node"))
		}

		settings, err := h.gutenberg.Refresh(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &GutenbergSettingsOutput{Body: gutenbergBody(settings)}, nil
	})
}

func gutenbergBody(settings *gutenberg.Settings) GutenbergSettingsBody {
	return GutenbergSettingsBody{
		Available: true,
		Enabled:   settings.Enabled,
		Syncing:   settings.Syncing,
		Books:     settings.Books,
		UpdatedAt: optionalTime(settings.UpdatedAt),
		CheckedAt: optionalTime(settings.CheckedAt),
		Error:     settings.Error,
	}
}

func optionalTime(value time.Time) *time.Time {
	if value.IsZero() {
		return nil
	}

	return &value
}
