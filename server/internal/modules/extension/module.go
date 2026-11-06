// Package extension installs and runs plugins: scripts from the community
// that add places to search for torrents or to read manga from. Each runs in a
// sandbox that reaches only the hosts its manifest lists, and is installed and
// updated only with the user's consent to exactly that manifest.
package extension

import (
	"context"
	"database/sql"
	"path/filepath"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/extension/internal/handler"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/extension/internal/sandbox"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/extension/internal/service"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/extension/internal/store"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/events"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/secrets"
)

// How long reading a manifest or a plugin's code may take.
const fetchTimeout = 20 * time.Second

// What the torrent and manga modules ask of plugins, through internal/app.
type (
	Provider           = service.Provider
	SearchRequest      = sandbox.SearchRequest
	Release            = sandbox.Release
	MangaSearchRequest = sandbox.MangaSearchRequest
	Series             = sandbox.Series
	Chapter            = sandbox.Chapter
	Page               = sandbox.Page
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
func (m *Module) TorrentProviders(ctx context.Context) ([]Provider, error) {
	return m.svc.TorrentProviders(ctx)
}

// MangaProviders are the plugins on now that read manga.
func (m *Module) MangaProviders(ctx context.Context) ([]Provider, error) {
	return m.svc.MangaProviders(ctx)
}

// MangaSearch finds series in one manga provider.
func (m *Module) MangaSearch(ctx context.Context, id string, req MangaSearchRequest) ([]Series, error) {
	return m.svc.MangaSearch(ctx, id, req)
}

// MangaChapters lists a series' chapters in one manga provider.
func (m *Module) MangaChapters(ctx context.Context, id, seriesID string) ([]Chapter, error) {
	return m.svc.MangaChapters(ctx, id, seriesID)
}

// MangaPages says where a chapter's pages are in one manga provider.
func (m *Module) MangaPages(ctx context.Context, id, chapterID string) ([]Page, error) {
	return m.svc.MangaPages(ctx, id, chapterID)
}

// FetchImage downloads a page's image under the manga provider's own hosts and
// at public addresses only.
func (m *Module) FetchImage(ctx context.Context, id string, page Page) (data []byte, contentType string, err error) {
	return m.svc.FetchImage(ctx, id, page)
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
