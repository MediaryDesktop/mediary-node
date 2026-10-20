// Package extension installs and runs plugins: scripts from the community
// that add places to search for torrents. Each runs in a sandbox that reaches
// only the hosts its manifest lists, and is installed and updated only with
// the user's consent to exactly that manifest.
package extension

import (
	"context"
	"database/sql"
	"path/filepath"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/extension/internal/handler"
	"github.com/mediaryorg/mediary-node/server/internal/modules/extension/internal/sandbox"
	"github.com/mediaryorg/mediary-node/server/internal/modules/extension/internal/service"
	"github.com/mediaryorg/mediary-node/server/internal/modules/extension/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
	"github.com/mediaryorg/mediary-node/server/internal/platform/secrets"
)

// How long reading a manifest or a plugin's code may take.
const fetchTimeout = 20 * time.Second

// What the torrent module asks of plugins, through internal/app.
type (
	TorrentProvider = service.TorrentProvider
	SearchRequest   = sandbox.SearchRequest
	Release         = sandbox.Release
)

type Deps struct {
	DB     *sql.DB
	Logger zerolog.Logger
	Events *events.Hub

	// DataDir gets the plugins' code and their secrets file.
	DataDir     string
	NodeVersion string
}

func New(deps Deps) *Module {
	st := store.New(deps.DB)
	sec := secrets.New(filepath.Join(deps.DataDir, "extension-secrets.json"))

	runner := sandbox.New(sandbox.Options{
		Logger:    deps.Logger,
		UserAgent: "Mediary/" + deps.NodeVersion,
	})

	svc := service.New(st, sec, deps.Logger, deps.Events, service.Options{
		Dir:         filepath.Join(deps.DataDir, "extensions"),
		NodeVersion: deps.NodeVersion,
		HTTP:        sandbox.PublicClient(fetchTimeout),
		Runner:      runner,
	})

	return &Module{svc: svc, handler: handler.New(svc)}
}

type Module struct {
	svc     *service.Service
	handler *handler.Handler
}

// TorrentProviders are the plugins on now that search for torrents.
func (m *Module) TorrentProviders(ctx context.Context) ([]TorrentProvider, error) {
	return m.svc.TorrentProviders(ctx)
}

// SearchTorrents runs one plugin's search in its sandbox.
func (m *Module) SearchTorrents(ctx context.Context, id string, req SearchRequest) ([]Release, error) {
	return m.svc.SearchTorrents(ctx, id, req)
}

// FetchTorrent downloads the .torrent a plugin's release links to, under the
// plugin's own hosts and at public addresses only.
func (m *Module) FetchTorrent(ctx context.Context, id, link string) (data []byte, magnet string, err error) {
	return m.svc.FetchTorrent(ctx, id, link)
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}
