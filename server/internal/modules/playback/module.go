package playback

import (
	"path/filepath"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/playback/internal/handler"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/playback/internal/mpv"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/playback/internal/service"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/playback/internal/videofile"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/events"
)

// The module's ports: playback plays files the library owns and reports progress to
// the tracker, without importing either. internal/app wires both.
type (
	PlayableFile = service.PlayableFile
	Library      = service.Library
	Progress     = service.Progress
	Tools        = service.Tools
)

type Deps struct {
	Logger zerolog.Logger
	Events *events.Hub

	// Tools says where mpv, ffmpeg and ffprobe are, on every use.
	Tools Tools

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
	var transcoder *lazyTranscoder

	if deps.Transcode {
		transcoder = &lazyTranscoder{
			tools:   deps.Tools,
			logger:  deps.Logger,
			hwAccel: deps.TranscodeHWAccel,
			dir:     deps.TranscodeDir,
		}
	}

	ffmpeg := func() (string, error) { return deps.Tools.Path("ffmpeg") }

	opts := service.Options{
		Launcher: service.MPVLauncher{
			Tools:  deps.Tools,
			Socket: mpv.SocketPath(deps.DataDir),
			Logger: deps.Logger,
		},
		Library:  deps.Library,
		Progress: deps.Progress,
		LocalURL: deps.LocalURL,
		Prober: videofile.Prober{
			FFprobe:  func() (string, error) { return deps.Tools.Path("ffprobe") },
			CacheDir: filepath.Join(deps.DataDir, "cache", "mediainfo"),
		},
		Extractor: &videofile.Extractor{
			FFmpeg:   ffmpeg,
			CacheDir: filepath.Join(deps.DataDir, "cache", "extracted"),
		},
		Thumbnailer: &videofile.Thumbnailer{
			FFmpeg:   ffmpeg,
			CacheDir: filepath.Join(deps.DataDir, "cache", "thumbnails"),
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
	transcoder *lazyTranscoder
}

// Close stops every encoder, so no ffmpeg outlives the node.
func (m *Module) Close() {
	if m.transcoder != nil {
		m.transcoder.close()
	}
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}
