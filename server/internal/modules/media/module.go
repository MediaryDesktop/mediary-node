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
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/openlibrary"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/tmdb"
)

type Deps struct {
	DB      *sql.DB
	Logger  zerolog.Logger
	AniList *anilist.Client
	AniZip  *anizip.Client
	TMDB    *tmdb.Client

	OpenLibrary *openlibrary.Client
}

// MediaDetails is the module's read-only port onto a title the node has already
// fetched, for the parts of the app that decorate a list with posters and names.
// Wired by internal/app; no module imports another.
type MediaDetails = service.MediaDetails

type EpisodeList = service.EpisodeList

func New(deps Deps) *Module {
	svc := service.New(store.New(deps.DB), deps.Logger, service.Options{AniList: deps.AniList, AniZip: deps.AniZip, TMDB: deps.TMDB, OpenLibrary: deps.OpenLibrary})

	return &Module{handler: handler.New(svc), svc: svc}
}

type Module struct {
	handler *handler.Handler
	svc     *service.Service
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}

// Details is the title page's answer: from the cache while it is fresh, otherwise
// from the source.
func (m *Module) Details(ctx context.Context, mediaRef string) (*MediaDetails, error) {
	return m.svc.Details(ctx, mediaRef)
}

// Episodes lists a title's episodes, for the parts of the node that number them.
func (m *Module) Episodes(ctx context.Context, mediaRef string) (*EpisodeList, error) {
	return m.svc.Episodes(ctx, mediaRef)
}

// Cached answers from the node's own details cache and never reaches the source.
// It returns nil for a title the node has never fetched, which is an ordinary
// answer and not an error.
func (m *Module) Cached(ctx context.Context, mediaRef string) (*MediaDetails, error) {
	return m.svc.CachedDetails(ctx, mediaRef)
}
