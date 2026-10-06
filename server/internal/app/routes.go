package app

import (
	"context"
	"database/sql"
	"path/filepath"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/config"
	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
	"github.com/mediaryorg/mediary-node/server/internal/modules/extension"
	"github.com/mediaryorg/mediary-node/server/internal/modules/library"
	"github.com/mediaryorg/mediary-node/server/internal/modules/manga"
	"github.com/mediaryorg/mediary-node/server/internal/modules/media"
	"github.com/mediaryorg/mediary-node/server/internal/modules/playback"
	"github.com/mediaryorg/mediary-node/server/internal/modules/reader"
	"github.com/mediaryorg/mediary-node/server/internal/modules/sync"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent"
	"github.com/mediaryorg/mediary-node/server/internal/modules/tracker"
	"github.com/mediaryorg/mediary-node/server/internal/platform/cloud"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anilist"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anizip"
)

type Deps struct {
	Logger zerolog.Logger
	DB     *sql.DB
	Events *events.Hub
	Cloud  *cloud.Client
	Build  httpapi.BuildInfo
	Linked bool

	AniList             *anilist.Client
	AniZip              *anizip.Client
	MangaDex            config.MangaDex
	AniListClientID     string
	AniListAuthorizeURL string
	AniListRefresh      time.Duration

	LibraryFollowSymlinks bool

	MPVPath     string
	FFmpegPath  string
	FFprobePath string
	DataDir     string

	Transcode        bool
	TranscodeDir     string
	TranscodeHWAccel string
}

// Register mounts every module and returns what has to run on shutdown.
func Register(ctx context.Context, api huma.API, deps Deps) (shutdown func()) {
	httpapi.RegisterHealth(api, deps.Build, deps.Linked)

	trackerModule := tracker.New(tracker.Deps{
		DB:                  deps.DB,
		Logger:              moduleLogger(deps.Logger, "tracker"),
		Events:              deps.Events,
		AniList:             deps.AniList,
		AniListClientID:     deps.AniListClientID,
		AniListAuthorizeURL: deps.AniListAuthorizeURL,
		RefreshInterval:     deps.AniListRefresh,
	})
	trackerModule.Register(api)

	// The library matches files against titles; the tracker knows which titles the
	// user follows. Joining them is this file's job, so that neither module has to
	// know the other exists.
	mediaModule := media.New(media.Deps{
		DB:      deps.DB,
		Logger:  moduleLogger(deps.Logger, "media"),
		AniList: deps.AniList,
		AniZip:  deps.AniZip,
	})
	mediaModule.Register(api)

	var titles library.TitleSource
	if deps.AniList != nil {
		titles = titleSource{tracker: trackerModule, media: mediaModule, aniList: deps.AniList}
	}

	libraryModule := library.New(library.Deps{
		DB:             deps.DB,
		Logger:         moduleLogger(deps.Logger, "library"),
		Events:         deps.Events,
		FollowSymlinks: deps.LibraryFollowSymlinks,
		Titles:         titles,
	})
	libraryModule.Register(api)

	torrent.New(torrent.Deps{
		DB:     deps.DB,
		Logger: moduleLogger(deps.Logger, "torrent"),
		Events: deps.Events,
	}).Register(api)

	// The player opens files the library scanned and reports what was watched to the
	// tracker. Both edges are ports, joined here: playback knows neither module.
	playbackModule := playback.New(playback.Deps{
		Logger:      moduleLogger(deps.Logger, "playback"),
		Events:      deps.Events,
		MPVPath:     deps.MPVPath,
		FFmpegPath:  deps.FFmpegPath,
		FFprobePath: deps.FFprobePath,
		DataDir:     deps.DataDir,
		Library:     playableFiles{library: libraryModule},
		Progress:    watchedEpisodes{tracker: trackerModule},

		Transcode:        deps.Transcode,
		TranscodeDir:     deps.TranscodeDir,
		TranscodeHWAccel: deps.TranscodeHWAccel,
	})
	playbackModule.Register(api)

	// Downloaded chapters are written into a library folder and join the library
	// through it: the manga module never touches the library's tables.
	mangaModule := manga.New(manga.Deps{
		DB:          deps.DB,
		Logger:      moduleLogger(deps.Logger, "manga"),
		Events:      deps.Events,
		Library:     downloadFolders{library: libraryModule},
		SecretsPath: filepath.Join(deps.DataDir, "opds-secrets.json"),
		UserAgent:   "mediary-node/" + deps.Build.Version,

		MangaDexEndpoint:       deps.MangaDex.Endpoint,
		MangaDexReportEndpoint: deps.MangaDex.ReportEndpoint,
		MangaDexTimeout:        deps.MangaDex.Timeout,
	})
	mangaModule.Register(api)

	queueCtx, stopQueue := context.WithCancel(ctx)

	// The OpenAPI generator registers the routes without a database; there is no
	// queue to work through then.
	if deps.DB != nil {
		mangaModule.Start(queueCtx)
	}

	// The reader reads the library's files and, through the manga module, chapters
	// on the user's OPDS servers. Every edge is a port joined here.
	reader.New(reader.Deps{
		Logger:   moduleLogger(deps.Logger, "reader"),
		Library:  readableFiles{library: libraryModule},
		Progress: readChapters{tracker: trackerModule},
		Sources: map[string]reader.ChapterSource{
			reader.SourceOPDS:     opdsChapters{manga: mangaModule},
			reader.SourceMangaDex: mangaDexChapters{manga: mangaModule},
		},
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

	return func() {
		stopQueue()
		playbackModule.Close()
	}
}

func moduleLogger(logger zerolog.Logger, module string) zerolog.Logger {
	return logger.With().Str("module", module).Logger()
}
