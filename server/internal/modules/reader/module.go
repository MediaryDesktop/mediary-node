package reader

import (
	"database/sql"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/handler"
	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/service"
	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/store"
)

type Deps struct {
	DB     *sql.DB
	Logger zerolog.Logger
}

func New(deps Deps) *Module {
	st := store.New(deps.DB)
	svc := service.New(st, deps.Logger)

	return &Module{handler: handler.New(svc)}
}

type Module struct {
	handler *handler.Handler
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}
