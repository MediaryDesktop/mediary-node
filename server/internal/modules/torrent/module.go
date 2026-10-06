package torrent

import (
	"context"
	"database/sql"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/handler"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/service"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
	"github.com/mediaryorg/mediary-node/server/internal/platform/secrets"
)

type Deps struct {
	DB     *sql.DB
	Logger zerolog.Logger
	Events *events.Hub

	// Library is where downloads are saved and how they join the library.
	Library Library

	// SecretsPath is the file that holds the torrent client's password.
	SecretsPath string

	// Client is the connection from the environment, used until the user saves
	// one in the settings.
	Client Connection
}

// Library is the library module as downloads need it, wired by internal/app.
type Library = service.Library

// Connection is how to reach the user's qBittorrent.
type Connection = service.Connection

func New(deps Deps) *Module {
	svc := service.New(
		store.New(deps.DB),
		secrets.New(deps.SecretsPath),
		deps.Library,
		deps.Events,
		deps.Logger,
		service.Options{Defaults: deps.Client},
	)

	return &Module{handler: handler.New(svc), svc: svc}
}

type Module struct {
	handler *handler.Handler
	svc     *service.Service
}

// Start follows the downloads until ctx ends.
func (m *Module) Start(ctx context.Context) {
	m.svc.Start(ctx)
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}
