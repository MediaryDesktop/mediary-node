package app

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/go-chi/chi/v5"
	"golang.org/x/sync/errgroup"

	"github.com/mediaryorg/mediary-node/server/internal/config"
	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent"
	"github.com/mediaryorg/mediary-node/server/internal/platform/cloud"
	"github.com/mediaryorg/mediary-node/server/internal/platform/db"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
	"github.com/mediaryorg/mediary-node/server/internal/platform/logging"
	"github.com/mediaryorg/mediary-node/server/internal/platform/secrets"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anilist"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anizip"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/googlebooks"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/openlibrary"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/tmdb"
	"github.com/mediaryorg/mediary-node/server/internal/wsapi"
)

const eventBuffer = 128

func Run(ctx context.Context, build httpapi.BuildInfo) error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	logger, closeLog, err := logging.New(cfg.Log.Level, cfg.Log.Pretty, cfg.Log.File)
	if err != nil {
		return fmt.Errorf("build logger: %w", err)
	}
	defer closeLog()

	token, err := cfg.EnsureToken()
	if err != nil {
		return fmt.Errorf("ensure local token: %w", err)
	}

	logger.Info().
		Str("version", build.Version).
		Str("data_dir", cfg.DataDir).
		Bool("linked", cfg.Cloud.Linked()).
		Msg("starting mediary node")

	ctx, stop := signal.NotifyContext(ctx, syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	database, err := db.Open(ctx, cfg.DatabasePath())
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer func() {
		if closeErr := database.Close(); closeErr != nil {
			logger.Error().Err(closeErr).Msg("close database")
		}
	}()

	if migrateErr := db.Migrate(ctx, database, logger); migrateErr != nil {
		return fmt.Errorf("migrate database: %w", migrateErr)
	}

	hub := events.NewHub(eventBuffer)

	cloudClient, err := cloud.New(cloud.Options{
		BaseURL:     cfg.Cloud.BaseURL,
		DeviceToken: cfg.Cloud.DeviceToken,
		Timeout:     cfg.Cloud.Timeout,
		UserAgent:   "mediary-node/" + build.Version,
	})
	if err != nil {
		return fmt.Errorf("build cloud client: %w", err)
	}

	aniList := anilist.New(anilist.Options{
		Endpoint:  cfg.AniList.Endpoint,
		Timeout:   cfg.AniList.Timeout,
		UserAgent: "mediary-node/" + build.Version,
		Tokens:    anilist.NewTokenStore(cfg.AniListTokenPath()),
	})

	var aniZip *anizip.Client
	if cfg.AniZip.Endpoint != "" {
		aniZip = anizip.New(anizip.Options{
			Endpoint:  cfg.AniZip.Endpoint,
			Timeout:   cfg.AniZip.Timeout,
			UserAgent: "mediary-node/" + build.Version,
		})
	}

	var tmdbClient *tmdb.Client
	if cfg.TMDB.Endpoint != "" {
		tmdbClient = tmdb.New(tmdb.Options{
			Endpoint:  cfg.TMDB.Endpoint,
			Timeout:   cfg.TMDB.Timeout,
			UserAgent: "mediary-node/" + build.Version,
			Keys:      tmdb.NewKeys(secrets.New(filepath.Join(cfg.DataDir, "tmdb-secrets.json")), cfg.TMDB.APIKey),
		})
	}

	var openLibrary *openlibrary.Client
	if cfg.OpenLibrary.Endpoint != "" {
		openLibrary = openlibrary.New(openlibrary.Options{
			Endpoint:  cfg.OpenLibrary.Endpoint,
			Timeout:   cfg.OpenLibrary.Timeout,
			UserAgent: "mediary-node/" + build.Version,
			Contact:   cfg.OpenLibrary.Contact,
		})
	}

	var googleBooks *googlebooks.Client
	if cfg.GoogleBooks.Endpoint != "" {
		googleBooks = googlebooks.New(googlebooks.Options{
			Endpoint:  cfg.GoogleBooks.Endpoint,
			Timeout:   cfg.GoogleBooks.Timeout,
			UserAgent: "mediary-node/" + build.Version,
			Keys: googlebooks.NewKeys(
				secrets.New(filepath.Join(cfg.DataDir, "googlebooks-secrets.json")), cfg.GoogleBooks.APIKey),
		})
	}

	router, api := httpapi.New(httpapi.Options{
		Version:        build.Version,
		Token:          token,
		AllowedOrigins: cfg.HTTP.AllowedOrigins,
		Logger:         logger,
	})

	shutdownModules := Register(ctx, api, Deps{
		Logger: logger,
		DB:     database,
		Events: hub,
		Cloud:  cloudClient,
		Build:  build,

		SyncInterval: cfg.Cloud.SyncInterval,

		AniList:             aniList,
		AniZip:              aniZip,
		TMDB:                tmdbClient,
		OpenLibrary:         openLibrary,
		GoogleBooks:         googleBooks,
		MangaDex:            cfg.MangaDex,
		AniListClientID:     cfg.AniList.ClientID,
		AniListAuthorizeURL: cfg.AniList.AuthorizeURL,
		AniListRefresh:      cfg.AniList.RefreshInterval,

		LibraryFollowSymlinks: cfg.Library.FollowSymlinks,

		MPVPath:     cfg.Playback.MPVPath,
		FFmpegPath:  cfg.Playback.FFmpegPath,
		FFprobePath: cfg.Playback.FFprobePath,
		DataDir:     cfg.DataDir,

		Transcode:        cfg.Playback.EnableTranscoding,
		TranscodeDir:     cfg.Playback.TranscodeDir,
		TranscodeHWAccel: cfg.Playback.TranscodeHWAccel,

		TorrentClient:     torrentClient(cfg.Torrent),
		TorrentListenPort: cfg.Torrent.ListenPort,
		TorrentEnableUPnP: cfg.Torrent.EnableUPnP,

		LocalURL: localDirectURL(cfg.HTTP, token),
	})
	defer shutdownModules()

	if mux, ok := router.(*chi.Mux); ok {
		mux.Handle("/ws", wsapi.New(hub, logger, cfg.HTTP.AllowedOrigins))
	}

	server := &http.Server{
		Addr:              cfg.HTTP.Addr(),
		Handler:           router,
		ReadHeaderTimeout: cfg.HTTP.ReadTimeout,

		WriteTimeout: cfg.HTTP.WriteTimeout,
		IdleTimeout:  cfg.HTTP.IdleTimeout,
	}

	group, groupCtx := errgroup.WithContext(ctx)

	group.Go(func() error {
		logger.Info().
			Str("addr", cfg.HTTP.Addr()).
			Str("docs", "http://"+cfg.HTTP.Addr()+"/docs").
			Msg("node listener started")

		if listenErr := server.ListenAndServe(); listenErr != nil &&
			!errors.Is(listenErr, http.ErrServerClosed) {
			return fmt.Errorf("http listener: %w", listenErr)
		}
		return nil
	})

	group.Go(func() error {
		<-groupCtx.Done()

		logger.Info().Msg("shutdown signal received")

		shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.HTTP.ShutdownTimeout)
		defer cancel()

		return server.Shutdown(shutdownCtx)
	})

	if err := group.Wait(); err != nil && !errors.Is(err, context.Canceled) {
		return err
	}

	logger.Info().Msg("stopped cleanly")

	return nil
}

// torrentClient is the connection the environment names, used until the user
// saves one in the settings.
func torrentClient(cfg config.Torrent) torrent.Connection {
	switch cfg.Client {
	case "embedded":
		return torrent.Connection{Kind: "embedded"}
	case "qbittorrent":
		return torrent.Connection{Kind: "qbittorrent", URL: cfg.ExternalURL, Username: cfg.ExternalUser, Password: cfg.ExternalPassword}
	default:
		return torrent.Connection{}
	}
}
