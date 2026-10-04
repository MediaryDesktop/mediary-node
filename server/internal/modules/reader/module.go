package reader

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/handler"
	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/service"
)

// The module's ports: the reader reads files the library owns and reports read
// chapters to the tracker, without importing either. internal/app wires both.
type (
	ReadableFile = service.PlayableFile
	Library      = service.Library
	Progress     = service.Progress
)

type Deps struct {
	Logger zerolog.Logger

	Library  Library
	Progress Progress
}

func New(deps Deps) *Module {
	svc := service.New(service.Options{
		Library:  deps.Library,
		Progress: deps.Progress,
	})

	return &Module{handler: handler.New(svc)}
}

type Module struct {
	handler *handler.Handler
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}
