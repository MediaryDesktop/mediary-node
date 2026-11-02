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
	ISBNResolver     = service.ISBNResolver
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

// RootContent is what a library folder holds — "books", "manga", "anime"… — for a
// module that writes files of one kind into it. It returns false when there is
// no folder with the id.
func (m *Module) RootContent(ctx context.Context, rootID int64) (content string, found bool, err error) {
	roots, err := m.svc.Roots(ctx)
	if err != nil {
		return "", false, err
	}

	for _, root := range roots {
		if root.ID == rootID {
			return root.Content, true, nil
		}
	}

	return "", false, nil
}

// EnsureRoot creates a folder the node writes into and makes it part of the
// library, for a module with a folder of its own. relDir is where the folder
// sits inside the root it ends up in; empty when it is that root.
func (m *Module) EnsureRoot(ctx context.Context, path string) (rootID int64, relDir string, err error) {
	return m.svc.EnsureRoot(ctx, path)
}

// EnsureRootOf is EnsureRoot for a folder of one content — "manga", "books"… —
// that a new root is added as.
func (m *Module) EnsureRootOf(ctx context.Context, path, content string) (rootID int64, relDir string, err error) {
	return m.svc.EnsureRootOf(ctx, path, content)
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

// NameSeason is the season a video's path gives — S02E05, Season 2/ — for a show
// numbered by season; nil when it gives none, or when it is not a video.
func (m *Module) NameSeason(relPath string) *int {
	kind, ok := scanner.KindOf(relPath)
	if !ok || kind != scanner.KindVideo {
		return nil
	}

	parsed := parser.Parse(relPath, kind)
	if parsed.Form == parser.FormExtra {
		return nil
	}

	return parsed.Season
}

// Episodes are the episodes of a title the library has on disk: matched video
// files, not missing, read from the match or else from the name.
func (m *Module) Episodes(ctx context.Context, mediaRef string) ([]int, error) {
	page, err := m.svc.Files(ctx, service.FileQuery{MediaRef: mediaRef, Kind: string(scanner.KindVideo), Limit: 500})
	if err != nil {
		return nil, err
	}

	seen := map[int]bool{}
	var episodes []int

	for i := range page.Items {
		file := &page.Items[i]
		if file.Missing || file.Match == nil {
			continue
		}

		episode := file.Match.Episode
		if episode == nil {
			episode = file.Parsed.Episode
		}

		if episode != nil && !seen[*episode] {
			seen[*episode] = true
			episodes = append(episodes, *episode)
		}
	}

	return episodes, nil
}
