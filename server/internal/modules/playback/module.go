package playback

import (
	"path/filepath"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

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

	Library  Library
	Progress Progress
}

func New(deps Deps) *Module {
	svc := service.New(deps.Logger, deps.Events, service.Options{
		Launcher: service.MPVLauncher{
			Binary: deps.MPVPath,
			Socket: mpv.SocketPath(deps.DataDir),
			Logger: deps.Logger,
		},
		Library:  deps.Library,
		Progress: deps.Progress,
		Prober: videofile.Prober{
			FFprobePath: deps.FFprobePath,
			CacheDir:    filepath.Join(deps.DataDir, "cache", "mediainfo"),
		},
		Extractor: &videofile.Extractor{
			FFmpegPath: deps.FFmpegPath,
			CacheDir:   filepath.Join(deps.DataDir, "cache", "extracted"),
		},
	})

	return &Module{handler: handler.New(svc)}
}

type Module struct {
	handler *handler.Handler
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}
