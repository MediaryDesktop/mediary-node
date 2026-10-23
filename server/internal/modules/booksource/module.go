// Package booksource finds free copies of books — public-domain ones, and ones on
// the user's own OPDS servers — and saves the one the user picks into a library
// folder of books, where it joins the library as the book it was found for.
package booksource

import (
	"context"
	"database/sql"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/download"
	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/handler"
	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/service"
	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/source"
	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

type Deps struct {
	DB     *sql.DB
	Logger zerolog.Logger
	Events *events.Hub

	// Library is where saved books go and how they join the library.
	Library Library
	// Works names the book a search is for.
	Works Works
}

// Library is the library module as downloads need it, wired by internal/app.
type Library = download.Library

// Works names a book by its media reference, wired by internal/app.
type Works = service.Works

// Work is a book's title and authors.
type Work = service.Work

type Module struct {
	handler *handler.Handler
	queue   *download.Queue
}

func New(deps Deps) *Module {
	// The sources arrive with the steps that add them: Project Gutenberg, then
	// the user's OPDS servers.
	var sources []source.Source

	svc := service.New(service.Options{Sources: sources, Works: deps.Works})
	queue := download.New(store.New(deps.DB), svc, deps.Library, deps.Events, deps.Logger)

	return &Module{handler: handler.New(svc, queue), queue: queue}
}

// Start resumes the download queue and works through it until ctx ends.
func (m *Module) Start(ctx context.Context) {
	m.queue.Start(ctx)
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}
