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

// TitleCandidate and TitleSource are the module's port for "what could this file
// be". The library owns the matching, the composition root owns who answers:
// reaching into another module's data from here is exactly what the module
// boundaries exist to prevent.
type (
	TitleCandidate = service.TitleCandidate
	TitleSource    = service.TitleSource
)

type Deps struct {
	DB     *sql.DB
	Logger zerolog.Logger
	Events *events.Hub

	FollowSymlinks bool

	Titles TitleSource
}

func New(deps Deps) *Module {
	svc := service.New(store.New(deps.DB), deps.Logger, deps.Events, service.Options{
		FollowSymlinks: deps.FollowSymlinks,
		Titles:         deps.Titles,
	})

	return &Module{handler: handler.New(svc)}
}

type Module struct {
	handler *handler.Handler
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}
