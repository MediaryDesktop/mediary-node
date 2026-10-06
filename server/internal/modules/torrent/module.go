package torrent

import (
	"context"
	"database/sql"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/embedded"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/handler"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/service"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/torznab"
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

	// The node's own client: where it keeps its list of torrents, the port peers
	// reach it on, and whether it may open that port on the router.
	EmbeddedDir string
	ListenPort  int
	EnableUPnP  bool

	// Titles names a title for a release search.
	Titles    Titles
	UserAgent string
}

// Titles is where a release search gets a title's names, wired by internal/app.
type Titles = service.Titles

// Library is the library module as downloads need it, wired by internal/app.
type Library = service.Library

// Connection is how to reach the user's qBittorrent.
type Connection = service.Connection

func New(deps Deps) *Module {
	builtin := embedded.New(embedded.Options{
		StateDir:   deps.EmbeddedDir,
		ListenPort: deps.ListenPort,
		EnableUPnP: deps.EnableUPnP,
		Logger:     deps.Logger,
	})

	svc := service.New(
		store.New(deps.DB),
		secrets.New(deps.SecretsPath),
		deps.Library,
		deps.Events,
		deps.Logger,
		service.Options{
			Defaults: deps.Client,
			Embedded: builtin,
			Titles:   deps.Titles,
			Torznab:  torznab.New(20*time.Second, deps.UserAgent),
		},
	)

	return &Module{handler: handler.New(svc), svc: svc, embedded: builtin}
}

type Module struct {
	handler  *handler.Handler
	svc      *service.Service
	embedded *embedded.Client
}

// Close stops the node's own client, if it ever started; its torrents resume
// on the next start.
func (m *Module) Close() {
	m.embedded.Close()
}

// Start follows the downloads until ctx ends.
func (m *Module) Start(ctx context.Context) {
	m.svc.Start(ctx)
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}
