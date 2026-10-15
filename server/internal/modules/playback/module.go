package playback

import (
	"path/filepath"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/playback/internal/cassette"
	"github.com/mediaryorg/mediary-node/server/internal/modules/playback/internal/handler"
	"github.com/mediaryorg/mediary-node/server/internal/modules/playback/internal/mpv"
	"github.com/mediaryorg/mediary-node/server/internal/modules/playback/internal/service"
	"github.com/mediaryorg/mediary-node/server/internal/modules/playback/internal/videofile"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

// The module's ports: playback plays files the library owns and reports progress to
// the tracker, without importing either. internal/app wires both.
type (
	PlayableFile = service.PlayableFile
	Library      = service.Library
	Progress     = service.Progress
)

type Deps struct {
	Logger zerolog.Logger
	Events *events.Hub

	// MPVPath is the configured player. Empty means the node looks for mpv on PATH.
	MPVPath string

	// FFmpegPath and FFprobePath are the configured tools. Empty means the node
	// looks for them on PATH.
	FFmpegPath  string
	FFprobePath string

	// DataDir is where the player's control socket goes on platforms where it is a
	// file rather than a named pipe, and where probed media info is cached.
	DataDir string

	// Transcode turns on HLS for files the renderer cannot play as they are.
	// Segments go to TranscodeDir, which is emptied on every start.
	Transcode        bool
	TranscodeDir     string
	TranscodeHWAccel string

	Library  Library
	Progress Progress

	// LocalURL is the node's own address of a file's direct endpoint, token
	// included; streams reach ffprobe, ffmpeg and mpv through it.
	LocalURL func(fileID int64) string
}

func New(deps Deps) *Module {
	var transcoder *cassette.Cassette

	if deps.Transcode {
		logger := deps.Logger

		ffmpeg := deps.FFmpegPath
		if ffmpeg == "" {
			ffmpeg = "ffmpeg"
		}

		var err error
		transcoder, err = cassette.New(&cassette.NewCassetteOptions{
			Logger:      &logger,
			HwAccelKind: deps.TranscodeHWAccel,
			TempOutDir:  deps.TranscodeDir,
			FfmpegPath:  ffmpeg,
			FfprobePath: deps.FFprobePath,
		})
		if err != nil {
			// Direct play and mpv do not need it; a broken transcode dir should
			// not take them down.
			deps.Logger.Error().Err(err).Msg("transcoding is unavailable")
			transcoder = nil
		}
	}

	opts := service.Options{
		Launcher: service.MPVLauncher{
			Binary: deps.MPVPath,
			Socket: mpv.SocketPath(deps.DataDir),
			Logger: deps.Logger,
		},
		Library:  deps.Library,
		Progress: deps.Progress,
		LocalURL: deps.LocalURL,
		Prober: videofile.Prober{
			FFprobePath: deps.FFprobePath,
			CacheDir:    filepath.Join(deps.DataDir, "cache", "mediainfo"),
		},
		Extractor: &videofile.Extractor{
			FFmpegPath: deps.FFmpegPath,
			CacheDir:   filepath.Join(deps.DataDir, "cache", "extracted"),
		},
		Thumbnailer: &videofile.Thumbnailer{
			FFmpegPath: deps.FFmpegPath,
			CacheDir:   filepath.Join(deps.DataDir, "cache", "thumbnails"),
		},
	}

	// A typed nil in the interface would read as "transcoding on".
	if transcoder != nil {
		opts.Transcoder = transcoder
	}

	svc := service.New(deps.Logger, deps.Events, opts)

	return &Module{handler: handler.New(svc), transcoder: transcoder}
}

type Module struct {
	handler    *handler.Handler
	transcoder *cassette.Cassette
}

// Close stops every encoder, so no ffmpeg outlives the node.
func (m *Module) Close() {
	if m.transcoder != nil {
		m.transcoder.Destroy()
	}
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}
