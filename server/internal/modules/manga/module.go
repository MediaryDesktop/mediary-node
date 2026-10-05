package manga

import (
	"context"
	"database/sql"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/download"
	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/handler"
	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/opds"
	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/secrets"
	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/service"
	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

type Deps struct {
	DB     *sql.DB
	Logger zerolog.Logger
	Events *events.Hub

	// Library is where downloaded chapters go and how they join the library.
	Library Library

	// SecretsPath is the file that holds the OPDS servers' passwords.
	SecretsPath string
	UserAgent   string
}

// Library is the library module as downloads need it, wired by internal/app.
type Library = download.Library

func New(deps Deps) *Module {
	st := store.New(deps.DB)

	svc := service.New(st, secrets.New(deps.SecretsPath), deps.Logger, service.Options{
		Client: opds.New(30*time.Second, deps.UserAgent),
	})

	queue := download.New(st, svc.DownloadSource(), deps.Library, deps.Events, deps.Logger)

	return &Module{handler: handler.New(svc, queue), svc: svc, queue: queue}
}

type Module struct {
	handler *handler.Handler
	svc     *service.Service
	queue   *download.Queue
}

// Start resumes the download queue and works through it until ctx ends.
func (m *Module) Start(ctx context.Context) {
	m.queue.Start(ctx)
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}

// OPDSChapter is a chapter on one of the user's OPDS servers, for the reader.
type OPDSChapter = service.ReadChapter

// OPDSChapter describes a chapter by the key the module wrote into its reference.
func (m *Module) OPDSChapter(ctx context.Context, serverID int64, key string) (*OPDSChapter, error) {
	return m.svc.Chapter(ctx, serverID, key)
}

// OPDSPage fetches one page of such a chapter from its server.
func (m *Module) OPDSPage(ctx context.Context, serverID int64, key string, index int) (data []byte, contentType string, err error) {
	return m.svc.Page(ctx, serverID, key, index)
}
