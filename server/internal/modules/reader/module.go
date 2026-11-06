package reader

import (
	"database/sql"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/reader/internal/archive"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/reader/internal/handler"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/reader/internal/ref"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/reader/internal/service"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/reader/internal/store"
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

// The reference prefixes of chapters on the user's OPDS servers and from manga plugins.
const (
	SourceOPDS   = ref.SourceOPDS
	SourcePlugin = ref.SourcePlugin
)

type Deps struct {
	// DB keeps where each book was left; nil leaves books without a place.
	DB     *sql.DB
	Logger zerolog.Logger

	Library  Library
	Progress Progress
	Sources  map[string]ChapterSource
}

func New(deps Deps) *Module {
	opts := service.Options{
		Library:  deps.Library,
		Progress: deps.Progress,
		Sources:  deps.Sources,
		Logger:   deps.Logger,
	}
	if deps.DB != nil {
		opts.Store = store.New(deps.DB)
	}

	svc := service.New(opts)

	return &Module{handler: handler.New(svc)}
}

type Module struct {
	handler *handler.Handler
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}
