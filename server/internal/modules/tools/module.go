// Package tools installs the programs the node runs — mpv and FFmpeg — and says
// where each one is. It is part of the node, not a plugin: what it installs and
// from where is fixed in the binary.
package tools

import (
	"path/filepath"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/tools/internal/handler"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/tools/internal/manifest"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/tools/internal/service"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/events"
)

type Deps struct {
	Logger zerolog.Logger
	Events *events.Hub

	// DataDir gets a tools folder. Empty, as when the OpenAPI document is
	// written, leaves the disk alone.
	DataDir string

	// The paths set by hand. Empty means the node's own copy, else PATH.
	MPVPath     string
	FFmpegPath  string
	FFprobePath string
}

type Module struct {
	svc     *service.Service
	handler *handler.Handler
}

func New(deps Deps) *Module {
	m, err := manifest.Load()
	if err != nil {
		// The manifest is built in; a broken one is a broken build.
		panic(err)
	}

	dir := ""
	if deps.DataDir != "" {
		dir = filepath.Join(deps.DataDir, "tools")
	}

	svc := service.New(deps.Logger, deps.Events, service.Options{
		Dir:      dir,
		Manifest: m,
		Configured: map[string]string{
			"mpv":     deps.MPVPath,
			"ffmpeg":  deps.FFmpegPath,
			"ffprobe": deps.FFprobePath,
		},
	})

	return &Module{svc: svc, handler: handler.New(svc)}
}

// Path is where a program runs from now. It is asked on every use, so one
// installed while the node runs is used at once.
func (m *Module) Path(program string) (string, error) {
	return m.svc.Path(program)
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}

// Close stops every install under way.
func (m *Module) Close() {
	m.svc.Close()
}
