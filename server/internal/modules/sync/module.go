package sync

import (
	"database/sql"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/sync/internal/handler"
	"github.com/mediaryorg/mediary-node/server/internal/modules/sync/internal/service"
	"github.com/mediaryorg/mediary-node/server/internal/modules/sync/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/cloud"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

type Deps struct {
	DB     *sql.DB
	Logger zerolog.Logger
	Events *events.Hub
	Cloud  *cloud.Client
}

func New(deps Deps) *Module {
	st := store.New(deps.DB)
	svc := service.New(st, deps.Logger, deps.Events, deps.Cloud)

	return &Module{handler: handler.New(svc)}
}

type Module struct {
	handler *handler.Handler
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}
