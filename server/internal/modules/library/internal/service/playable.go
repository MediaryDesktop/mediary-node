package service

import (
	"context"
	"path/filepath"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// PlayableFile is what another module needs to open one of these files: where it is
// and, when the matcher worked it out, which episode of what it is.
type PlayableFile struct {
	ID    int64
	Path  string
	Title string

	MediaRef string
	Episode  *int

	// Season is set for a show whose source numbers episodes within seasons.
	Season *int

	// Duration is what the scan read out of the container. Nil when it could not.
	Duration *time.Duration

	Missing bool
}

// Playable answers for a single file. It exists so that the parts of the node that
// play and read files do not have to know how the library stores them — and so that
// they never take a path from the client instead.
func (s *Service) Playable(ctx context.Context, fileID int64) (*PlayableFile, error) {
	row, err := s.store.File(ctx, fileID)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read library file")
	}
	if row == nil {
		return nil, nil
	}

	playable := &PlayableFile{
		ID:      row.ID,
		Path:    filepath.Join(row.RootPath, filepath.FromSlash(row.RelPath)),
		Title:   row.Parsed.Title,
		Missing: row.MissingSince != nil,

		Duration: row.Duration,
	}

	if playable.Title == "" {
		playable.Title = row.RelPath
	}

	if row.Match != nil {
		playable.MediaRef = row.Match.MediaRef
		playable.Episode = row.Match.Episode
		playable.Season = row.Match.Season
	}

	return playable, nil
}
