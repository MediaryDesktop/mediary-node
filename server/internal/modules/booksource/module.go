// Package booksource finds free copies of books — public-domain ones, and ones on
// the user's own OPDS servers — and saves the one the user picks into a library
// folder of books, where it joins the library as the book it was found for.
package booksource

import (
	"context"
	"database/sql"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/download"
	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/gutenberg"
	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/handler"
	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/servers"
	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/service"
	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/source"
	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
	"github.com/mediaryorg/mediary-node/server/internal/platform/secrets"
	pg "github.com/mediaryorg/mediary-node/server/internal/platform/sources/gutenberg"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/opds"
)

type Deps struct {
	DB     *sql.DB
	Logger zerolog.Logger
	Events *events.Hub

	// Library is where saved books go and how they join the library.
	Library Library
	// DownloadDir is where books go until the user chooses a library folder of
	// books; empty when the node has none.
	DownloadDir string
	// Works names the book a search is for.
	Works Works

	// Gutenberg is Project Gutenberg's site; nil on a node configured without it.
	Gutenberg *pg.Client

	// SecretsPath is the file the OPDS servers' passwords are kept in.
	SecretsPath string
	UserAgent   string
}

// Library is the library module as downloads need it, wired by internal/app.
type Library = download.Library

// Works names a book by its media reference, wired by internal/app.
type Works = service.Works

// Work is a book's title and authors.
type Work = service.Work

type Module struct {
	handler   *handler.Handler
	queue     *download.Queue
	gutenberg *gutenberg.Gutenberg
}

func New(deps Deps) *Module {
	var catalog *gutenberg.Gutenberg
	if deps.Gutenberg != nil {
		catalog = gutenberg.New(gutenberg.Options{
			DB:     deps.DB,
			Client: deps.Gutenberg,
			Events: deps.Events,
			Logger: deps.Logger,
		})
	}

	opdsServers := servers.New(servers.Options{
		DB:        deps.DB,
		Client:    opds.New(30*time.Second, deps.UserAgent),
		Passwords: secrets.New(deps.SecretsPath),
		Logger:    deps.Logger,
	})

	sources := func(ctx context.Context) []source.Source {
		var on []source.Source
		if catalog != nil && catalog.Enabled(ctx) {
			on = append(on, catalog)
		}

		return append(on, opdsServers.Sources(ctx)...)
	}

	svc := service.New(service.Options{Sources: sources, Works: deps.Works})
	queue := download.New(store.New(deps.DB), svc, deps.Library, deps.DownloadDir, deps.Events, deps.Logger)

	return &Module{handler: handler.New(svc, queue, catalog, opdsServers), queue: queue, gutenberg: catalog}
}

// Start resumes the download queue and keeps the Gutenberg catalogue up to date,
// until ctx ends.
func (m *Module) Start(ctx context.Context) {
	m.queue.Start(ctx)

	if m.gutenberg != nil {
		m.gutenberg.Start(ctx)
	}
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}
