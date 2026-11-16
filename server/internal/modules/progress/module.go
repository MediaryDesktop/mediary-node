// Package progress is where the user is in what they watch and read: each
// episode's position and whether it was watched through, each chapter's page,
// each book's place. The player and the reader report here through ports
// joined in internal/app; the number on the user's list stays the tracker's.
//
// Every state is named so that it means the same on any computer — a title
// and a unit within it, or what a file holds — which is what lets it travel in
// a backup.
package progress

import (
	"context"
	"database/sql"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/progress/internal/handler"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/progress/internal/service"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/progress/internal/store"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/backup"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/events"
)

type (
	// WatchKey names an episode by its title and number, or a file by its
	// content key: exactly one of the two.
	WatchKey = service.WatchKey
	// ChapterKey names a chapter by its title and number, or by a source
	// reference that means the same on any computer.
	ChapterKey = service.ChapterKey
	Book       = service.Book
)

type Deps struct {
	DB     *sql.DB
	Logger zerolog.Logger
	Events *events.Hub
	Now    func() time.Time
}

type Module struct {
	handler *handler.Handler
	svc     *service.Service
}

func New(deps Deps) *Module {
	svc := service.New(store.New(deps.DB), deps.Events, deps.Logger, deps.Now)

	return &Module{handler: handler.New(svc), svc: svc}
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}

// BackupPart is the module's share of a backup.
func (m *Module) BackupPart() backup.Part {
	return store.BackupPart{}
}

// SaveWatch records where a player is; reached is the player's own rule for
// having watched it.
func (m *Module) SaveWatch(ctx context.Context, key WatchKey, position, duration float64, reached bool) error {
	return m.svc.SaveWatch(ctx, key, position, duration, reached)
}

// ResumeAt is where the next play of an episode starts, in seconds.
func (m *Module) ResumeAt(ctx context.Context, key WatchKey) (float64, error) {
	return m.svc.ResumeAt(ctx, key)
}

// SaveChapter records the page a reader shows; read is the reader's own rule.
func (m *Module) SaveChapter(ctx context.Context, key ChapterKey, page, pages int, read bool) error {
	return m.svc.SaveChapter(ctx, key, page, pages, read)
}

// ResumePage is the page a chapter opens at.
func (m *Module) ResumePage(ctx context.Context, key ChapterKey) (int, error) {
	return m.svc.ResumePage(ctx, key)
}

// Book is where the reader left a book file; nil for one never opened.
func (m *Module) Book(ctx context.Context, contentKey string) (*Book, error) {
	return m.svc.Book(ctx, contentKey)
}

func (m *Module) SaveBook(ctx context.Context, book Book) error {
	return m.svc.SaveBook(ctx, book)
}
