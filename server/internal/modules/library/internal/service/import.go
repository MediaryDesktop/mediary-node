package service

import (
	"context"
	"path"
	"strings"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/scanner"
	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

// ImportFile adds one file the node wrote into a root — a downloaded chapter —
// and matches it to the title it was downloaded for. It is a scan of that one
// file: the same rows, the same parser, without walking the root, and without
// guessing a match the node already knows.
func (s *Service) ImportFile(ctx context.Context, rootID int64, relPath, mediaRef string, episode *int) (*File, error) {
	relPath = path.Clean(strings.ReplaceAll(relPath, "\\", "/"))
	if relPath == "." || strings.HasPrefix(relPath, "../") || path.IsAbs(relPath) {
		return nil, apperr.Invalid("path", "%q is not a path inside the folder", relPath)
	}

	root, err := s.store.Root(ctx, rootID)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read library root")
	}
	if root == nil {
		return nil, apperr.New(apperr.KindNotFound, "library root %d does not exist", rootID)
	}

	file, ok, err := scanner.Describe(root.Path, relPath)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindPrecondition, "could not read the new file")
	}
	if !ok {
		return nil, apperr.New(apperr.KindPrecondition, "%s is not a file the library keeps", relPath)
	}

	known, err := s.store.FileStates(ctx, rootID)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read known files")
	}

	// diffFiles marks every known file it does not find as missing, so it only
	// sees the row of this one path, if there is one.
	var same []store.FileState
	for _, state := range known {
		if state.RelPath == file.RelPath {
			same = append(same, state)
		}
	}

	changes := diffFiles(same, []scanner.File{file})
	if !changes.Empty() {
		if applyErr := s.store.ApplyScan(ctx, rootID, changes, s.opts.Now()); applyErr != nil {
			return nil, apperr.Wrap(applyErr, apperr.KindInternal, "add the new file")
		}
	}

	if known, err = s.store.FileStates(ctx, rootID); err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read known files")
	}

	var fileID int64
	for _, state := range known {
		if state.RelPath == file.RelPath {
			fileID = state.ID
		}
	}
	if fileID == 0 {
		return nil, apperr.New(apperr.KindInternal, "%s was added but cannot be found", relPath)
	}

	if episode == nil {
		if episode, err = s.parsedEpisode(ctx, fileID); err != nil {
			return nil, err
		}
	}

	matched, err := s.SetMatch(ctx, fileID, mediaRef, nil, episode)
	if err != nil {
		return nil, err
	}

	s.hub.Publish(events.TopicLibraryUpdate, map[string]any{"reason": "imported"})

	return matched, nil
}

// parsedEpisode is the episode the parser read from a video's name, for a caller
// that knows the title but not the episode — a torrent hands over whole folders
// of them. An extra keeps no number: NCOP01 is an opening, not the first episode.
func (s *Service) parsedEpisode(ctx context.Context, fileID int64) (*int, error) {
	file, err := s.store.File(ctx, fileID)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read library file")
	}
	if file == nil || file.Kind != string(scanner.KindVideo) || file.Parsed.Form == "extra" {
		return nil, nil
	}

	return file.Parsed.Episode, nil
}
