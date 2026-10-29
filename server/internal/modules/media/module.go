package media

import (
	"context"
	"database/sql"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/media/internal/handler"
	"github.com/mediaryorg/mediary-node/server/internal/modules/media/internal/service"
	"github.com/mediaryorg/mediary-node/server/internal/modules/media/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anilist"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anizip"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/claude"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/googlebooks"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/imagesearch"
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
	GoogleBooks *googlebooks.Client

	// Forget clears what other modules keep under a deleted manual title's
	// reference — its entry on the user's list. Wired by internal/app.
	Forget Forgetter

	// Claude fills in a title the user describes by hand; nil turns that off.
	Claude *claude.Client

	// Images finds posters for manual titles; Fetch downloads the one picked and
	// must refuse the local network. CoverDir keeps them, and CoverURL is where a
	// client loads one from. An empty CoverDir turns posters off.
	Images   *imagesearch.Client
	Fetch    *http.Client
	CoverDir string
	CoverURL func(id string, version int64) string

	// UserAgent names the node to the sites it downloads posters from.
	UserAgent string
}

// Forgetter is the port through which deleting a manual title reaches the modules
// that keep data under its reference, without the media module knowing them.
type Forgetter = service.Forgetter

// MediaDetails is the module's read-only port onto a title the node has already
// fetched, for the parts of the app that decorate a list with posters and names.
// Wired by internal/app; no module imports another.
type MediaDetails = service.MediaDetails

type EpisodeList = service.EpisodeList

// DoramaCountries are where a live-action show has to come from to be a dorama.
var DoramaCountries = service.DoramaCountries

func New(deps Deps) *Module {
	svc := service.New(store.New(deps.DB), deps.Logger, service.Options{
		AniList:     deps.AniList,
		AniZip:      deps.AniZip,
		TMDB:        deps.TMDB,
		OpenLibrary: deps.OpenLibrary,
		GoogleBooks: deps.GoogleBooks,
		Forget:      deps.Forget,
		Claude:      deps.Claude,
		Images:      deps.Images,
		Fetch:       deps.Fetch,
		CoverDir:    deps.CoverDir,
		CoverURL:    deps.CoverURL,
		UserAgent:   deps.UserAgent,
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

// ManualTitles lists the titles of one kind the user described themselves. They
// live on the node, so this never reaches a source.
func (m *Module) ManualTitles(ctx context.Context, mediaType string) ([]MediaDetails, error) {
	return m.svc.ManualTitles(ctx, mediaType)
}
