package reader

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/archive"
	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/handler"
	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/ref"
	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/service"
)

// The module's ports: the reader reads files the library owns and reports read
// chapters to the tracker, without importing either. internal/app wires both.
type (
	ReadableFile = service.PlayableFile
	Library      = service.Library
	Progress     = service.Progress

	// A source of chapters other than the library, and what it hands back.
	ChapterSource = service.Source
	ChapterRef    = ref.ChapterRef
	Chapter       = service.Chapter
	Page          = archive.Page
	Image         = archive.Image
)

// SourceOPDS is the reference prefix of chapters on the user's OPDS servers.
const (
	SourceOPDS     = ref.SourceOPDS
	SourceMangaDex = ref.SourceMangaDex
)

type Deps struct {
	Logger zerolog.Logger

	Library  Library
	Progress Progress
	Sources  map[string]ChapterSource
}

func New(deps Deps) *Module {
	svc := service.New(service.Options{
		Library:  deps.Library,
		Progress: deps.Progress,
		Sources:  deps.Sources,
	})

	return &Module{handler: handler.New(svc)}
}

type Module struct {
	handler *handler.Handler
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}
