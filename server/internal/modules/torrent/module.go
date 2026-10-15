package torrent

import (
	"context"
	"database/sql"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/debrid"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/embedded"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/handler"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/service"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/torbox"
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

	// TorBoxDir keeps the list of torrents fetched from the user's TorBox
	// account, so a restarted node resumes their files.
	TorBoxDir string

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

	secretFile := secrets.New(deps.SecretsPath)

	torboxAPI := torbox.New(torbox.Options{
		Key:       func() (string, error) { return secretFile.Get(torboxSecret) },
		UserAgent: deps.UserAgent,
	})
	torboxClient := debrid.New(debrid.Options{
		Name:     "TorBox",
		Provider: torbox.NewProvider(torboxAPI),
		StateDir: deps.TorBoxDir,
		Logger:   deps.Logger,
	})

	svc := service.New(
		store.New(deps.DB),
		secretFile,
		deps.Library,
		deps.Events,
		deps.Logger,
		service.Options{
			Defaults: deps.Client,
			Embedded: builtin,
			TorBox:   torboxClient,
			CheckTorBox: func(ctx context.Context, apiKey string) (string, error) {
				api := torbox.New(torbox.Options{Key: torbox.StaticKey(apiKey), UserAgent: deps.UserAgent})
				return torbox.NewProvider(api).Account(ctx)
			},
			Titles:  deps.Titles,
			Torznab: torznab.New(20*time.Second, deps.UserAgent),
		},
	)

	return &Module{handler: handler.New(svc), svc: svc, embedded: builtin, torbox: torboxClient}
}

// torboxSecret is the TorBox key's entry in the secrets file; the service saves
// it under the same name.
const torboxSecret = "torbox"

type Module struct {
	handler  *handler.Handler
	svc      *service.Service
	embedded *embedded.Client
	torbox   *debrid.Client
}

// Close stops the node's own client and the TorBox fetches, if they ever
// started; both resume on the next start.
func (m *Module) Close() {
	m.embedded.Close()
	m.torbox.Close()
}

// Start follows the downloads until ctx ends.
func (m *Module) Start(ctx context.Context) {
	m.svc.Start(ctx)
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}
