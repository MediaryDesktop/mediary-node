package tracker

import (
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

func New(deps Deps) *Module {
	svc := service.New(store.New(deps.DB), deps.Logger, deps.Events, service.Options{
		AniList:         deps.AniList,
		ClientID:        deps.AniListClientID,
		AuthorizeURL:    deps.AniListAuthorizeURL,
		RefreshInterval: deps.RefreshInterval,
	})

	return &Module{handler: handler.New(svc)}
}

type Module struct {
	handler *handler.Handler
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}
