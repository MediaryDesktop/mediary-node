package library

import (
	"database/sql"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/handler"
	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/service"
	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

type Deps struct {
	DB     *sql.DB
	Logger zerolog.Logger
	Events *events.Hub
}

func New(deps Deps) *Module {
	st := store.New(deps.DB)
	svc := service.New(st, deps.Logger, deps.Events)

	return &Module{handler: handler.New(svc)}
}

type Module struct {
	handler *handler.Handler
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}
