package reader

import (
	"context"
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
	Positions    = service.Positions
	BookFile     = service.BookFile
	BookPosition = service.BookPosition

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
	// DB holds where books were left before Positions kept them; nil for none.
	DB     *sql.DB
	Logger zerolog.Logger

	Library   Library
	Progress  Progress
	Positions Positions
	Sources   map[string]ChapterSource
}

func New(deps Deps) *Module {
	opts := service.Options{
		Library:   deps.Library,
		Progress:  deps.Progress,
		Positions: deps.Positions,
		Sources:   deps.Sources,
		Logger:    deps.Logger,
	}
	if deps.DB != nil {
		opts.Store = store.New(deps.DB)
	}

	svc := service.New(opts)

	return &Module{handler: handler.New(svc), svc: svc}
}

type Module struct {
	handler *handler.Handler
	svc     *service.Service
}

// MoveLegacyPositions carries the places of books kept before Positions over
// to it. It reads each book's file once, so it runs off the startup path.
func (m *Module) MoveLegacyPositions(ctx context.Context) (int, error) {
	return m.svc.MoveLegacyPositions(ctx)
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}
