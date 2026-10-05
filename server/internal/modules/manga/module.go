package manga

import (
	"context"
	"database/sql"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/handler"
	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/opds"
	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/secrets"
	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/service"
	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/store"
)

type Deps struct {
	DB     *sql.DB
	Logger zerolog.Logger

	// SecretsPath is the file that holds the OPDS servers' passwords.
	SecretsPath string
	UserAgent   string
}

func New(deps Deps) *Module {
	svc := service.New(store.New(deps.DB), secrets.New(deps.SecretsPath), deps.Logger, service.Options{
		Client: opds.New(30*time.Second, deps.UserAgent),
	})

	return &Module{handler: handler.New(svc), svc: svc}
}

type Module struct {
	handler *handler.Handler
	svc     *service.Service
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
