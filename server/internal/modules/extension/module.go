// Package extension installs and runs plugins: scripts from the community
// that add places to search for torrents. Each runs in a sandbox that reaches
// only the hosts its manifest lists, and is installed and updated only with
// the user's consent to exactly that manifest.
package extension

import (
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

	svc := service.New(st, sec, deps.Logger, deps.Events, service.Options{
		Dir:         filepath.Join(deps.DataDir, "extensions"),
		NodeVersion: deps.NodeVersion,
		HTTP:        sandbox.PublicClient(fetchTimeout),
	})

	return &Module{handler: handler.New(svc)}
}

type Module struct {
	handler *handler.Handler
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}
