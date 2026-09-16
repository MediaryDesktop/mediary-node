package media

import (
	"database/sql"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/media/internal/handler"
	"github.com/mediaryorg/mediary-node/server/internal/modules/media/internal/service"
	"github.com/mediaryorg/mediary-node/server/internal/modules/media/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anilist"
)

type Deps struct {
	DB      *sql.DB
	Logger  zerolog.Logger
	AniList *anilist.Client
}

func New(deps Deps) *Module {
	svc := service.New(store.New(deps.DB), deps.Logger, service.Options{AniList: deps.AniList})

	return &Module{handler: handler.New(svc)}
}

type Module struct {
	handler *handler.Handler
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}
