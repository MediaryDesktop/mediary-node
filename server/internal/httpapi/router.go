package httpapi

import (
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/httpapi/middleware"
)

const Title = "Mediary Node API"

const SecuritySchemeNode = "nodeToken"

var unauthenticatedPaths = []string{"/healthz", "/docs", "/openapi.json", "/openapi.yaml"}

type Options struct {
	Version        string
	Token          string
	AllowedOrigins []string
	Logger         zerolog.Logger
}

func New(opts Options) (chi.Router, huma.API) {
	router := chi.NewMux()

	router.Use(chimw.RequestID)
	router.Use(chimw.Recoverer)
	router.Use(middleware.Logging(opts.Logger))
	router.Use(corsHandler(opts.AllowedOrigins))
	router.Use(middleware.LocalToken(opts.Token, unauthenticatedPaths...))

	router.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	return router, humachi.New(router, humaConfig(opts))
}

func corsHandler(origins []string) func(http.Handler) http.Handler {
	allowed := origins
	if len(allowed) == 0 {
		allowed = []string{"http://localhost:5173"}
	}

	return cors.Handler(cors.Options{
		AllowedOrigins: allowed,
		AllowedMethods: []string{
			http.MethodGet, http.MethodPost, http.MethodPatch,
			http.MethodPut, http.MethodDelete, http.MethodOptions,
		},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", middleware.TokenHeader},
		AllowCredentials: false,
		MaxAge:           int(time.Hour.Seconds()),
	})
}

func humaConfig(opts Options) huma.Config {
	version := opts.Version
	if version == "" {
		version = "0.0.0-dev"
	}

	cfg := huma.DefaultConfig(Title, version)

	cfg.Info.Description = "Local API of a Mediary self-hosted node: library, " +
		"downloads, playback, reader and cloud sync. Bound to loopback and gated " +
		"by a local token."

	cfg.Components.SecuritySchemes = map[string]*huma.SecurityScheme{
		SecuritySchemeNode: {
			Type:        "apiKey",
			In:          "header",
			Name:        middleware.TokenHeader,
			Description: "The node's local token, generated on first start and read by the desktop shell.",
		},
	}

	cfg.Security = []map[string][]string{{SecuritySchemeNode: {}}}

	cfg.Tags = []*huma.Tag{
		{Name: "health", Description: "Liveness and build information."},
		{Name: "library", Description: "Local file scanning and matching against catalog titles."},
		{Name: "torrent", Description: "Providers and download management."},
		{Name: "playback", Description: "mpv control, direct play and transcoding."},
		{Name: "reader", Description: "Image-based and epub/pdf reading."},
		{Name: "sync", Description: "Progress synchronisation with a paired cloud account."},
		{Name: "extension", Description: "Plugin runtime for metadata and torrent providers."},
	}

	return cfg
}
