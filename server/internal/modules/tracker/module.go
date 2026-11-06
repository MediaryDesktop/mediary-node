package tracker

import (
	"context"
	"database/sql"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/tracker/internal/handler"
	"github.com/mediaryorg/mediary-node/server/internal/modules/tracker/internal/service"
	"github.com/mediaryorg/mediary-node/server/internal/modules/tracker/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/backup"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anilist"
)

type Deps struct {
	DB     *sql.DB
	Logger zerolog.Logger
	Events *events.Hub

	AniList             *anilist.Client
	AniListClientID     string
	AniListAuthorizeURL string
	RefreshInterval     time.Duration

	// Titles names what is on the node's own lists; wired by internal/app.
	Titles TitleInfo
}

// TrackedTitle is the module's read-only port onto the user's own collection, for
// the parts of the node that need to recognize a title — the file matcher above
// all. It is wired by internal/app; no module imports another.
type TrackedTitle = service.TrackedTitle

// TitleInfo, LocalTitle, Media and Title are the port through which the tracker
// shows titles on the node's own lists without describing them itself.
type (
	TitleInfo  = service.TitleInfo
	LocalTitle = service.LocalTitle
	Media      = service.Media
	Title      = service.Title
	MediaType  = service.MediaType
)

func New(deps Deps) *Module {
	svc := service.New(store.New(deps.DB), deps.Logger, deps.Events, service.Options{
		AniList:         deps.AniList,
		ClientID:        deps.AniListClientID,
		AuthorizeURL:    deps.AniListAuthorizeURL,
		RefreshInterval: deps.RefreshInterval,
		Titles:          deps.Titles,
	})

	return &Module{handler: handler.New(svc), svc: svc}
}

type Module struct {
	handler *handler.Handler
	svc     *service.Service
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}

// BackupPart is the tracker's share of a backup: its own tables, read and
// written back by the tracker, so the backup follows every change to them.
func (m *Module) BackupPart() backup.Part {
	return store.BackupPart{}
}

// TrackedTitles reads the mirrored collection, so it answers offline and never
// spends a request of its own.
func (m *Module) TrackedTitles(ctx context.Context, mediaType string) ([]TrackedTitle, error) {
	return m.svc.TrackedTitles(ctx, service.MediaType(mediaType))
}

// DeleteEntry takes a title off the node's own list.
func (m *Module) DeleteEntry(ctx context.Context, mediaRef string) error {
	return m.svc.DeleteEntry(ctx, mediaRef)
}

// MarkReadFraction records how far through a book the reader is, for the reader.
func (m *Module) MarkReadFraction(ctx context.Context, mediaRef string, fraction float64) error {
	return m.svc.MarkReadFraction(ctx, mediaRef, fraction)
}

// MarkRead records a chapter as read, for the reader. Same path as MarkWatched.
func (m *Module) MarkRead(ctx context.Context, mediaRef string, chapter int) error {
	return m.svc.MarkRead(ctx, mediaRef, chapter)
}

// MarkWatched records an episode as watched, for the player. It takes the same path
// as a user's own edit, including the offline queue and the rule against lowering
// progress the user already has elsewhere.
func (m *Module) MarkWatched(ctx context.Context, mediaRef string, episode int) error {
	return m.svc.MarkWatched(ctx, mediaRef, episode)
}
