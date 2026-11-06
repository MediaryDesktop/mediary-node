// Package sync backs the node's own data up to the user's Mediary account and
// restores it, as whole snapshots: a way to move to another device, not live
// sync between two.
package sync

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/sync/internal/handler"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/sync/internal/service"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/sync/internal/store"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/backup"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/cloud"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/events"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/secrets"
)

type Deps struct {
	DB      *sql.DB
	Logger  zerolog.Logger
	Events  *events.Hub
	Cloud   *cloud.Client
	DataDir string

	// Parts are the modules' shares of a backup, wired by internal/app. The sync
	// module knows none of their tables: it runs the parts in one transaction
	// and moves the encoded result.
	Parts []backup.Part
}

type Module struct {
	svc     *service.Service
	handler *handler.Handler
	events  *events.Hub
}

func New(deps Deps) *Module {
	svc := service.New(service.Deps{
		Store:     store.New(deps.DB, deps.Parts...),
		Logger:    deps.Logger,
		Hub:       deps.Events,
		Cloud:     deps.Cloud,
		Secrets:   secrets.New(filepath.Join(deps.DataDir, "cloud-secrets.json")),
		SafetyDir: filepath.Join(deps.DataDir, "pre-restore"),
		Label:     label(),
	})

	return &Module{svc: svc, handler: handler.New(svc), events: deps.Events}
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}

// Start loads a token saved by an earlier pairing and runs automatic backups
// until ctx ends.
func (m *Module) Start(ctx context.Context, tick time.Duration) error {
	if err := m.svc.LoadToken(); err != nil {
		return fmt.Errorf("sync: %w", err)
	}

	// No interval means manual backups only: a zero ticker would panic.
	if tick > 0 && m.events != nil {
		go m.svc.Run(ctx, tick)
	}

	return nil
}

func label() string {
	name, err := os.Hostname()
	if err != nil || name == "" {
		return "Mediary node"
	}

	if len(name) > 64 {
		return name[:64]
	}

	return name
}
