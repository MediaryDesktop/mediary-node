package torrent

import (
	"context"
	"database/sql"
	"path/filepath"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/alldebrid"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/debrid"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/embedded"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/handler"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/premiumize"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/realdebrid"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/service"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/store"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/torbox"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/torznab"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/events"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/secrets"
)

type Deps struct {
	DB     *sql.DB
	Logger zerolog.Logger
	Events *events.Hub

	// Library is where downloads are saved and how they join the library.
	Library Library

	// DownloadDir is where torrents go until the user chooses a library folder.
	DownloadDir string

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

	// DebridDir keeps, in a folder per service, the list of torrents fetched
	// from the user's debrid account, so a restarted node resumes their files.
	DebridDir string

	// Titles names a title for a release search.
	Titles    Titles
	UserAgent string

	// Providers are the user's search plugins; nil where plugins do not run.
	Providers Providers
}

// Titles is where a release search gets a title's names, wired by internal/app.
type Titles = service.Titles

// The search plugins as a release search asks them, wired by internal/app.
type (
	Providers       = service.Providers
	Provider        = service.Provider
	ProviderQuery   = service.ProviderQuery
	ProviderRelease = service.ProviderRelease
)

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

	services := map[string]service.DebridService{}
	var debridClients []*debrid.Client

	for _, spec := range debridSpecs(deps.UserAgent) {
		// The service saves each key in the secrets file under its kind.
		saved := func() (string, error) { return secretFile.Get(spec.kind) }

		client := debrid.New(debrid.Options{
			Name:     spec.name,
			Provider: spec.provider(saved),
			StateDir: filepath.Join(deps.DebridDir, spec.kind),
			Logger:   deps.Logger,
		})
		debridClients = append(debridClients, client)

		services[spec.kind] = service.DebridService{
			Client: client,
			Check: func(ctx context.Context, apiKey string) (string, error) {
				return spec.provider(func() (string, error) { return apiKey, nil }).Account(ctx)
			},
		}
	}

	svc := service.New(
		store.New(deps.DB),
		secretFile,
		deps.Library,
		deps.Events,
		deps.Logger,
		service.Options{
			Defaults:    deps.Client,
			Embedded:    builtin,
			DownloadDir: deps.DownloadDir,
			Debrid:      services,
			Titles:      deps.Titles,
			Torznab:     torznab.New(20*time.Second, deps.UserAgent),
			Providers:   deps.Providers,
		},
	)

	return &Module{handler: handler.New(svc), svc: svc, embedded: builtin, debrid: debridClients}
}

type debridSpec struct {
	kind     string
	name     string
	provider func(key func() (string, error)) debrid.Provider
}

func debridSpecs(userAgent string) []debridSpec {
	return []debridSpec{
		{service.DebridTorBox, "TorBox", func(key func() (string, error)) debrid.Provider {
			return torbox.NewProvider(torbox.New(torbox.Options{Key: key, UserAgent: userAgent}))
		}},
		{service.DebridRealDebrid, "Real-Debrid", func(key func() (string, error)) debrid.Provider {
			return realdebrid.New(realdebrid.Options{Key: key, UserAgent: userAgent})
		}},
		{service.DebridAllDebrid, "AllDebrid", func(key func() (string, error)) debrid.Provider {
			return alldebrid.New(alldebrid.Options{Key: key, UserAgent: userAgent})
		}},
		{service.DebridPremiumize, "Premiumize", func(key func() (string, error)) debrid.Provider {
			return premiumize.New(premiumize.Options{Key: key, UserAgent: userAgent})
		}},
	}
}

type Module struct {
	handler  *handler.Handler
	svc      *service.Service
	embedded *embedded.Client
	debrid   []*debrid.Client
}

// Close stops the node's own client and the debrid fetches, if they ever
// started; they resume on the next start.
func (m *Module) Close() {
	m.embedded.Close()
	for _, client := range m.debrid {
		client.Close()
	}
}

// StreamFile is a stream the player plays like a library file.
type StreamFile = service.StreamFile

// StreamFile resolves the negative file ID of a ready stream to a link the
// player can open.
func (m *Module) StreamFile(ctx context.Context, fileID int64) (*StreamFile, error) {
	return m.svc.StreamFile(ctx, fileID)
}

// RenewStreamLink makes the next StreamFile ask the service for a fresh link.
func (m *Module) RenewStreamLink(fileID int64) {
	m.svc.RenewStreamLink(fileID)
}

// Start follows the downloads until ctx ends.
func (m *Module) Start(ctx context.Context) {
	m.svc.Start(ctx)
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}
