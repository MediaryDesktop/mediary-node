package service

import (
	"context"
	"os"
	"path/filepath"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

// SetIgnored marks a file as one to leave alone, or takes that mark off. An
// ignored file stops being offered to the matcher, which is the whole point: a
// sample or a trailer the parser could not place otherwise comes back as
// unmatched after every single scan.
func (s *Service) SetIgnored(ctx context.Context, fileID int64, ignored bool) (*File, error) {
	file, err := s.store.File(ctx, fileID)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read library file")
	}
	if file == nil {
		return nil, apperr.New(apperr.KindNotFound, "library file %d does not exist", fileID)
	}

	var at *time.Time
	if ignored {
		now := s.opts.Now()
		at = &now
	}

	if _, err := s.store.SetIgnored(ctx, fileID, at); err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "set ignored")
	}

	s.hub.Publish(events.TopicLibraryUpdate, map[string]any{"reason": "ignored_changed"})

	updated, err := s.store.File(ctx, fileID)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read library file")
	}

	result := fileFrom(*updated)

	return &result, nil
}

// DeleteFile removes the file from disk and then from the library. The order is
// the point: a file the node could not delete — open in a player, on a read-only
// share — keeps its row, so the user sees it is still there and can try again.
// Forgetting the row first would leave the file on disk with nothing pointing at
// it until the next scan found it again.
func (s *Service) DeleteFile(ctx context.Context, fileID int64) error {
	file, err := s.store.File(ctx, fileID)
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "read library file")
	}
	if file == nil {
		return apperr.New(apperr.KindNotFound, "library file %d does not exist", fileID)
	}

	path := filepath.Join(file.RootPath, filepath.FromSlash(file.RelPath))

	// A file that is already gone is not a failure: the user asked for it not to
	// be there, and it is not there.
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return apperr.Wrap(err, apperr.KindInternal, "delete %s", path)
	}

	if _, err := s.store.DeleteFile(ctx, fileID); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "forget library file")
	}

	s.hub.Publish(events.TopicLibraryUpdate, map[string]any{"reason": "file_deleted"})

	return nil
}
