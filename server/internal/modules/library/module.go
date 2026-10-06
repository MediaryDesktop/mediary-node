package library

import (
	"context"
	"database/sql"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/handler"
	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/parser"
	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/scanner"
	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/service"
	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

// TitleCandidate and TitleSource are the module's port for "what could this file
// be". The library owns the matching, the composition root owns who answers:
// reaching into another module's data from here is exactly what the module
// boundaries exist to prevent.
type (
	TitleCandidate   = service.TitleCandidate
	RelatedCandidate = service.RelatedCandidate
	TitleDescription = service.TitleDescription
	TitleSource      = service.TitleSource
)

// PlayableFile is the module's read-only port onto one scanned file, for the parts
// of the node that open files — the player above all. Wired by internal/app; no
// module imports another.
type PlayableFile = service.PlayableFile

type Deps struct {
	DB     *sql.DB
	Logger zerolog.Logger
	Events *events.Hub

	FollowSymlinks bool

	Titles TitleSource
}

func New(deps Deps) *Module {
	svc := service.New(store.New(deps.DB), deps.Logger, deps.Events, service.Options{
		FollowSymlinks: deps.FollowSymlinks,
		Titles:         deps.Titles,
	})

	return &Module{handler: handler.New(svc), svc: svc}
}

type Module struct {
	handler *handler.Handler
	svc     *service.Service
}

func (m *Module) Register(api huma.API) {
	m.handler.Register(api)
}

// Playable resolves a scanned file for whoever has to open it. It returns nil when
// no such file was scanned.
func (m *Module) Playable(ctx context.Context, fileID int64) (*PlayableFile, error) {
	return m.svc.Playable(ctx, fileID)
}

// RootPath is where a library folder is on disk, for a module that writes files
// into it. It returns false when there is no folder with the id.
func (m *Module) RootPath(ctx context.Context, rootID int64) (path string, found bool, err error) {
	roots, err := m.svc.Roots(ctx)
	if err != nil {
		return "", false, err
	}

	for _, root := range roots {
		if root.ID == rootID {
			return root.Path, true, nil
		}
	}

	return "", false, nil
}

// ImportFile adds a file the node wrote into a library folder and matches it to
// the title it belongs to, without a scan of the whole folder.
func (m *Module) ImportFile(ctx context.Context, rootID int64, relPath, mediaRef string, episode *int) (int64, error) {
	file, err := m.svc.ImportFile(ctx, rootID, relPath, mediaRef, episode)
	if err != nil {
		return 0, err
	}

	return file.ID, nil
}

// NameEpisode is what the library makes of a file it does not have yet, from its
// path alone: whether it would keep it as a video, and the episode the name
// gives. An extra is a video without an episode.
func (m *Module) NameEpisode(relPath string) (video bool, episode *int) {
	kind, ok := scanner.KindOf(relPath)
	if !ok || kind != scanner.KindVideo {
		return false, nil
	}

	parsed := parser.Parse(relPath, kind)
	if parsed.Form == parser.FormExtra {
		return true, nil
	}

	return true, parsed.Episode
}
