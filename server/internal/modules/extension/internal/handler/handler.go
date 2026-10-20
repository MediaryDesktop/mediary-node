package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
	"github.com/mediaryorg/mediary-node/server/internal/modules/extension/internal/service"
)

type Handler struct {
	svc *service.Service
}

func New(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

type StatusOutput struct {
	Body struct {
		Module string `json:"module" example:"extension" doc:"Module name."`
		Ready  bool   `json:"ready" doc:"True when the module's dependencies are wired."`
	}
}

type ExtensionsOutput struct {
	Body struct {
		Extensions []service.Extension `json:"extensions"`
	}
}

type ExtensionOutput struct {
	Body service.Extension
}

type PreviewInput struct {
	Body struct {
		URL string `json:"url" format:"uri" maxLength:"2048" doc:"The plugin's manifest.json, at an https:// address."`
	}
}

type PreviewOutput struct {
	Body service.Preview
}

type InstallInput struct {
	Body struct {
		URL     string `json:"url" format:"uri" maxLength:"2048"`
		Consent string `json:"consent" pattern:"^[0-9a-f]{64}$" doc:"From the preview the user agreed to."`
	}
}

type IDInput struct {
	ID string `path:"id" pattern:"^[a-z][a-z0-9-]{1,47}$"`
}

type SettingsInput struct {
	ID   string `path:"id" pattern:"^[a-z][a-z0-9-]{1,47}$"`
	Body struct {
		Enabled *bool             `json:"enabled,omitempty"`
		Config  map[string]string `json:"config,omitempty" doc:"Only the settings to change. Empty goes back to the default; for a secret, removes it."`
	}
}

type UpdateInput struct {
	ID   string `path:"id" pattern:"^[a-z][a-z0-9-]{1,47}$"`
	Body struct {
		Consent string `json:"consent" pattern:"^[0-9a-f]{64}$" doc:"From the update check the user saw."`
	}
}

type CatalogInput struct {
	Refresh bool `query:"refresh" doc:"Read every repository again instead of reusing reads under an hour old."`
}

type CatalogOutput struct {
	Body service.Catalog
}

type AddRepositoryInput struct {
	Body struct {
		URL string `json:"url" format:"uri" maxLength:"2048" doc:"The repository's JSON, at an https:// address."`
	}
}

type RepositoryOutput struct {
	Body service.RepositoryInfo
}

type RepositoryIDInput struct {
	ID int64 `path:"id"`
}

func (h *Handler) Register(api huma.API) {
	h.registerCatalog(api)

	huma.Register(api, huma.Operation{
		OperationID: "getExtensionStatus",
		Method:      http.MethodGet,
		Path:        "/v1/extension/status",
		Summary:     "Extension module status",
		Tags:        []string{"extension"},
	}, func(ctx context.Context, _ *struct{}) (*StatusOutput, error) {
		ready, err := h.svc.Status(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &StatusOutput{}
		out.Body.Module = "extension"
		out.Body.Ready = ready

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "listExtensions",
		Method:      http.MethodGet,
		Path:        "/v1/extensions",
		Summary:     "Installed plugins",
		Description: "Each with the hosts it may reach, its settings — secrets only as set or not — and what the last update check found. Changes arrive on the extension topic.",
		Tags:        []string{"extension"},
	}, func(ctx context.Context, _ *struct{}) (*ExtensionsOutput, error) {
		exts, err := h.svc.List(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &ExtensionsOutput{}
		out.Body.Extensions = exts

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "previewExtension",
		Method:      http.MethodPost,
		Path:        "/v1/extensions/preview",
		Summary:     "Read a plugin before installing it",
		Description: "Reads the manifest and says what installing it means: the hosts the plugin will reach and the settings it asks for. Nothing is downloaded but the manifest, nothing is saved. Install with the consent it returns.",
		Tags:        []string{"extension"},
	}, func(ctx context.Context, in *PreviewInput) (*PreviewOutput, error) {
		preview, err := h.svc.Preview(ctx, in.Body.URL)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &PreviewOutput{Body: *preview}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "installExtension",
		Method:        http.MethodPost,
		Path:          "/v1/extensions",
		DefaultStatus: http.StatusCreated,
		Summary:       "Install a plugin",
		Description:   "Reads the manifest again and installs it only if it is the one the consent was given for. The code is downloaded once, refused unless it matches the manifest's sum, and run only from the saved copy.",
		Tags:          []string{"extension"},
	}, func(ctx context.Context, in *InstallInput) (*ExtensionOutput, error) {
		ext, err := h.svc.Install(ctx, in.Body.URL, in.Body.Consent)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &ExtensionOutput{Body: *ext}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "configureExtension",
		Method:      http.MethodPatch,
		Path:        "/v1/extensions/{id}",
		Summary:     "Turn a plugin on or off, or change its settings",
		Tags:        []string{"extension"},
	}, func(ctx context.Context, in *SettingsInput) (*ExtensionOutput, error) {
		ext, err := h.svc.Configure(ctx, in.ID, service.Settings{Enabled: in.Body.Enabled, Config: in.Body.Config})
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &ExtensionOutput{Body: *ext}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "removeExtension",
		Method:        http.MethodDelete,
		Path:          "/v1/extensions/{id}",
		DefaultStatus: http.StatusNoContent,
		Summary:       "Remove a plugin",
		Description:   "Its code, settings and secrets go with it.",
		Tags:          []string{"extension"},
	}, func(ctx context.Context, in *IDInput) (*struct{}, error) {
		if err := h.svc.Remove(ctx, in.ID); err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return nil, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "checkExtensionUpdates",
		Method:      http.MethodPost,
		Path:        "/v1/extensions/updates",
		Summary:     "Look for newer versions of the plugins",
		Description: "Reads each plugin's manifest at the address it was installed from. Nothing is installed. A newer version that reaches new hosts or plays another role needs the user's consent again.",
		Tags:        []string{"extension"},
	}, func(ctx context.Context, _ *struct{}) (*ExtensionsOutput, error) {
		exts, err := h.svc.CheckUpdates(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &ExtensionsOutput{}
		out.Body.Extensions = exts

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "updateExtension",
		Method:      http.MethodPost,
		Path:        "/v1/extensions/{id}/update",
		Summary:     "Install a plugin's newer version",
		Description: "Only from the address it was installed from, only newer, only the manifest the consent was given for. Settings that still fit carry over.",
		Tags:        []string{"extension"},
	}, func(ctx context.Context, in *UpdateInput) (*ExtensionOutput, error) {
		ext, err := h.svc.Update(ctx, in.ID, in.Body.Consent)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &ExtensionOutput{Body: *ext}, nil
	})
}

func (h *Handler) registerCatalog(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "getExtensionCatalog",
		Method:      http.MethodGet,
		Path:        "/v1/extensions/catalog",
		Summary:     "Plugins the user's repositories offer",
		Description: "What a repository says about a plugin is shown as it says it; installing previews the plugin's own manifest and asks for consent to that. Reads are reused for an hour. A repository that fails keeps the plugins of its last good read, with the error beside it. There is no repository until the user adds one.",
		Tags:        []string{"extension"},
	}, func(ctx context.Context, in *CatalogInput) (*CatalogOutput, error) {
		catalog, err := h.svc.Catalog(ctx, in.Refresh)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &CatalogOutput{Body: *catalog}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "addExtensionRepository",
		Method:        http.MethodPost,
		Path:          "/v1/extensions/repositories",
		DefaultStatus: http.StatusCreated,
		Summary:       "Add a plugin repository",
		Description:   "Read first: an address that is not a repository is refused rather than saved.",
		Tags:          []string{"extension"},
	}, func(ctx context.Context, in *AddRepositoryInput) (*RepositoryOutput, error) {
		repo, err := h.svc.AddRepository(ctx, in.Body.URL)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &RepositoryOutput{Body: *repo}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "removeExtensionRepository",
		Method:        http.MethodDelete,
		Path:          "/v1/extensions/repositories/{id}",
		DefaultStatus: http.StatusNoContent,
		Summary:       "Remove a plugin repository",
		Description:   "Plugins installed from it stay installed and keep updating from their own addresses.",
		Tags:          []string{"extension"},
	}, func(ctx context.Context, in *RepositoryIDInput) (*struct{}, error) {
		if err := h.svc.RemoveRepository(ctx, in.ID); err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return nil, nil
	})
}
