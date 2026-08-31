package app

import (
	"database/sql"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
	"github.com/mediaryorg/mediary-node/server/internal/modules/extension"
	"github.com/mediaryorg/mediary-node/server/internal/modules/library"
	"github.com/mediaryorg/mediary-node/server/internal/modules/playback"
	"github.com/mediaryorg/mediary-node/server/internal/modules/reader"
	"github.com/mediaryorg/mediary-node/server/internal/modules/sync"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent"
	"github.com/mediaryorg/mediary-node/server/internal/platform/cloud"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

type Deps struct {
	Logger zerolog.Logger
	DB     *sql.DB
	Events *events.Hub
	Cloud  *cloud.Client
	Build  httpapi.BuildInfo
	Linked bool
}

func Register(api huma.API, deps Deps) {
	httpapi.RegisterHealth(api, deps.Build, deps.Linked)

	library.New(library.Deps{
		DB:     deps.DB,
		Logger: moduleLogger(deps.Logger, "library"),
		Events: deps.Events,
	}).Register(api)

	torrent.New(torrent.Deps{
		DB:     deps.DB,
		Logger: moduleLogger(deps.Logger, "torrent"),
		Events: deps.Events,
	}).Register(api)

	playback.New(playback.Deps{
		DB:     deps.DB,
		Logger: moduleLogger(deps.Logger, "playback"),
		Events: deps.Events,
	}).Register(api)

	reader.New(reader.Deps{
		DB:     deps.DB,
		Logger: moduleLogger(deps.Logger, "reader"),
	}).Register(api)

	sync.New(sync.Deps{
		DB:     deps.DB,
		Logger: moduleLogger(deps.Logger, "sync"),
		Events: deps.Events,
		Cloud:  deps.Cloud,
	}).Register(api)

	extension.New(extension.Deps{
		DB:     deps.DB,
		Logger: moduleLogger(deps.Logger, "extension"),
	}).Register(api)
}

func moduleLogger(logger zerolog.Logger, module string) zerolog.Logger {
	return logger.With().Str("module", module).Logger()
}
