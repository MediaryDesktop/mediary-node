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
}

// TrackedTitle is the module's read-only port onto the user's own collection, for
// the parts of the node that need to recognize a title — the file matcher above
// all. It is wired by internal/app; no module imports another.
type TrackedTitle = service.TrackedTitle

func New(deps Deps) *Module {
	svc := service.New(store.New(deps.DB), deps.Logger, deps.Events, service.Options{
		AniList:         deps.AniList,
		ClientID:        deps.AniListClientID,
		AuthorizeURL:    deps.AniListAuthorizeURL,
		RefreshInterval: deps.RefreshInterval,
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

// TrackedTitles reads the mirrored collection, so it answers offline and never
// spends a request of its own.
func (m *Module) TrackedTitles(ctx context.Context, mediaType string) ([]TrackedTitle, error) {
	return m.svc.TrackedTitles(ctx, service.MediaType(mediaType))
}
