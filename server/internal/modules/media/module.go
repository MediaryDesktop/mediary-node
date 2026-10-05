package media

import (
	"context"
	"database/sql"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/media/internal/handler"
	"github.com/mediaryorg/mediary-node/server/internal/modules/media/internal/service"
	"github.com/mediaryorg/mediary-node/server/internal/modules/media/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anilist"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anizip"
)

type Deps struct {
	DB      *sql.DB
	Logger  zerolog.Logger
	AniList *anilist.Client
	AniZip  *anizip.Client
}

// MediaDetails is the module's read-only port onto a title the node has already
// fetched, for the parts of the app that decorate a list with posters and names.
// Wired by internal/app; no module imports another.
type MediaDetails = service.MediaDetails

func New(deps Deps) *Module {
	svc := service.New(store.New(deps.DB), deps.Logger, service.Options{AniList: deps.AniList, AniZip: deps.AniZip})

	return &Module{handler: handler.New(svc), svc: svc}
}

type Module struct {
	handler *handler.Handler
	svc     *service.Service
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}

// Cached answers from the node's own details cache and never reaches the source.
// It returns nil for a title the node has never fetched, which is an ordinary
// answer and not an error.
func (m *Module) Cached(ctx context.Context, mediaRef string) (*MediaDetails, error) {
	return m.svc.CachedDetails(ctx, mediaRef)
}
