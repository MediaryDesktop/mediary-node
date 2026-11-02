package app

import (
	"context"
	"database/sql"
	"path/filepath"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource"
	"github.com/mediaryorg/mediary-node/server/internal/modules/extension"
	"github.com/mediaryorg/mediary-node/server/internal/modules/library"
	"github.com/mediaryorg/mediary-node/server/internal/modules/manga"
	"github.com/mediaryorg/mediary-node/server/internal/modules/media"
	"github.com/mediaryorg/mediary-node/server/internal/modules/playback"
	"github.com/mediaryorg/mediary-node/server/internal/modules/reader"
	"github.com/mediaryorg/mediary-node/server/internal/modules/sync"
	"github.com/mediaryorg/mediary-node/server/internal/modules/tools"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent"
	"github.com/mediaryorg/mediary-node/server/internal/modules/tracker"
	"github.com/mediaryorg/mediary-node/server/internal/platform/cloud"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
	"github.com/mediaryorg/mediary-node/server/internal/platform/safehttp"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anilist"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anizip"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/googlebooks"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/gutenberg"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/imagesearch"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/openlibrary"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/tmdb"
)

type Deps struct {
	Logger zerolog.Logger
	DB     *sql.DB
	Events *events.Hub
	Cloud  *cloud.Client
	Build  httpapi.BuildInfo

	SyncInterval time.Duration

	AniList             *anilist.Client
	AniZip              *anizip.Client
	TMDB                *tmdb.Client
	OpenLibrary         *openlibrary.Client
	GoogleBooks         *googlebooks.Client
	Gutenberg           *gutenberg.Client
	AI                  media.AIProviders
	ImageSearch         *imagesearch.Client
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

	TorrentClient      torrent.Connection
	TorrentDownloadDir string
	TorrentListenPort  int
	TorrentEnableUPnP  bool

	// LocalURL is the node's own address of a file's direct endpoint, which the
	// player's tools read streams through.
	LocalURL func(fileID int64) string

	// CoverURL is the node's own address of a manual title's poster.
	CoverURL func(id string, version int64) string
}

// Register mounts every module and returns what has to run on shutdown.
func Register(ctx context.Context, api huma.API, deps Deps) (shutdown func()) {
	httpapi.RegisterHealth(api, deps.Build, func() bool {
		return deps.Cloud != nil && deps.Cloud.Linked()
	})

	forget := &forgetManual{}

	mediaModule := media.New(media.Deps{
		DB:      deps.DB,
		Logger:  moduleLogger(deps.Logger, "media"),
		AniList: deps.AniList,
		AniZip:  deps.AniZip,
		TMDB:    deps.TMDB,

		OpenLibrary: deps.OpenLibrary,
		GoogleBooks: deps.GoogleBooks,
		Forget:      forget,
		AI:          deps.AI,

		// Posters are kept beside the data; with no data dir — the OpenAPI export
		// — there is nowhere to keep them, and the routes still register.
		Images:   deps.ImageSearch,
		Fetch:    safehttp.NewClient(30 * time.Second),
		CoverDir: dataSubdir(deps.DataDir, "manual-covers"),
		CoverURL: deps.CoverURL,

		UserAgent: "mediary-node/" + deps.Build.Version,
	})
	mediaModule.Register(api)

	// The tracker keeps the user's own list of movies and shows; their names and
	// posters are the media module's, reached through a port.
	trackerModule := tracker.New(tracker.Deps{
		DB:                  deps.DB,
		Logger:              moduleLogger(deps.Logger, "tracker"),
		Events:              deps.Events,
		AniList:             deps.AniList,
		AniListClientID:     deps.AniListClientID,
		AniListAuthorizeURL: deps.AniListAuthorizeURL,
		RefreshInterval:     deps.AniListRefresh,
		Titles:              localTitles{media: mediaModule},
	})
	trackerModule.Register(api)

	forget.tracker = trackerModule

	// The library matches files against titles; the tracker knows which titles the
	// user follows. Joining them is this file's job, so that neither module has to
	// know the other exists.

	var titles library.TitleSource
	if deps.AniList != nil {
		titles = titleSource{
			tracker:     trackerModule,
			media:       mediaModule,
			aniList:     deps.AniList,
			tmdb:        deps.TMDB,
			openLibrary: deps.OpenLibrary,
			googleBooks: deps.GoogleBooks,
		}
	}

	libraryModule := library.New(library.Deps{
		DB:             deps.DB,
		Logger:         moduleLogger(deps.Logger, "library"),
		Events:         deps.Events,
		FollowSymlinks: deps.LibraryFollowSymlinks,
		Titles:         titles,
	})
	libraryModule.Register(api)

	// Plugins search for releases in a sandbox of their own; the torrent module
	// asks them through a port, as it asks its Torznab sources.
	extensionModule := extension.New(extension.Deps{
		DB:          deps.DB,
		Logger:      moduleLogger(deps.Logger, "extension"),
		Events:      deps.Events,
		DataDir:     deps.DataDir,
		NodeVersion: deps.Build.Version,
	})
	extensionModule.Register(api)

	// Torrents are saved into a library folder and their videos join the library
	// through it, like downloaded chapters.
	torrentModule := torrent.New(torrent.Deps{
		DB:          deps.DB,
		Logger:      moduleLogger(deps.Logger, "torrent"),
		Events:      deps.Events,
		Library:     downloadFolders{library: libraryModule},
		DownloadDir: deps.TorrentDownloadDir,
		SecretsPath: filepath.Join(deps.DataDir, "torrent-secrets.json"),
		Client:      deps.TorrentClient,
		EmbeddedDir: filepath.Join(deps.DataDir, "torrent-client"),
		DebridDir:   filepath.Join(deps.DataDir, "debrid"),
		ListenPort:  deps.TorrentListenPort,
		EnableUPnP:  deps.TorrentEnableUPnP,
		Titles:      releaseTitles{media: mediaModule},
		Providers:   searchPlugins{extension: extensionModule},
		UserAgent:   "mediary-node/" + deps.Build.Version,
	})
	torrentModule.Register(api)

	// mpv and FFmpeg: the paths set by hand, else the node's own copies, else PATH.
	toolsModule := tools.New(tools.Deps{
		Logger:      moduleLogger(deps.Logger, "tools"),
		Events:      deps.Events,
		DataDir:     deps.DataDir,
		MPVPath:     deps.MPVPath,
		FFmpegPath:  deps.FFmpegPath,
		FFprobePath: deps.FFprobePath,
	})
	toolsModule.Register(api)

	// The player opens files the library scanned, and streams the torrent module
	// made from a debrid service, and reports what was watched to the tracker.
	// Every edge is a port, joined here: playback knows none of these modules.
	playbackModule := playback.New(playback.Deps{
		Logger:   moduleLogger(deps.Logger, "playback"),
		Events:   deps.Events,
		Tools:    toolsModule,
		DataDir:  deps.DataDir,
		Library:  playableFiles{library: libraryModule, media: mediaModule, streams: torrentModule},
		Progress: watchedEpisodes{tracker: trackerModule},
		LocalURL: deps.LocalURL,

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
		DownloadDir: dataSubdir(deps.DataDir, "manga"),
		SecretsPath: filepath.Join(deps.DataDir, "opds-secrets.json"),
		UserAgent:   "mediary-node/" + deps.Build.Version,

		Plugins: mangaPlugins{extension: extensionModule},
	})
	mangaModule.Register(api)

	// Free copies of books are saved into a library folder of books and join the
	// library through it, as the book their search started from.
	bookSourceModule := booksource.New(booksource.Deps{
		DB:      deps.DB,
		Logger:  moduleLogger(deps.Logger, "booksource"),
		Events:  deps.Events,
		Library:     bookFolders{library: libraryModule},
		DownloadDir: dataSubdir(deps.DataDir, "books"),
		Works:       bookWorks{media: mediaModule},

		Gutenberg:   deps.Gutenberg,
		SecretsPath: filepath.Join(deps.DataDir, "book-opds-secrets.json"),
		UserAgent:   "mediary-node/" + deps.Build.Version,
	})
	bookSourceModule.Register(api)

	queueCtx, stopQueue := context.WithCancel(ctx)

	// The OpenAPI generator registers the routes without a database; there is no
	// queue to work through then.
	if deps.DB != nil {
		mangaModule.Start(queueCtx)
		bookSourceModule.Start(queueCtx)
		torrentModule.Start(queueCtx)
	}

	// The reader reads the library's files and, through the manga module, chapters
	// on the user's OPDS servers and from manga plugins. Every edge is a port
	// joined here.
	reader.New(reader.Deps{
		DB:       deps.DB,
		Logger:   moduleLogger(deps.Logger, "reader"),
		Library:  readableFiles{library: libraryModule},
		Progress: readChapters{tracker: trackerModule},
		Sources: map[string]reader.ChapterSource{
			reader.SourceOPDS:   opdsChapters{manga: mangaModule},
			reader.SourcePlugin: pluginChapters{manga: mangaModule},
		},
	}).Register(api)

	syncModule := sync.New(sync.Deps{
		DB:      deps.DB,
		Logger:  moduleLogger(deps.Logger, "sync"),
		Events:  deps.Events,
		Cloud:   deps.Cloud,
		DataDir: deps.DataDir,
	})
	syncModule.Register(api)

	if deps.DB != nil {
		if err := syncModule.Start(queueCtx, deps.SyncInterval); err != nil {
			deps.Logger.Error().Err(err).Msg("automatic backups are off")
		}
	}

	return func() {
		stopQueue()
		playbackModule.Close()
		toolsModule.Close()
		torrentModule.Close()
	}
}

func moduleLogger(logger zerolog.Logger, module string) zerolog.Logger {
	return logger.With().Str("module", module).Logger()
}
