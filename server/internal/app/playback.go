package app

import (
	"context"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library"
	"github.com/mediaryorg/mediary-node/server/internal/modules/playback"
	"github.com/mediaryorg/mediary-node/server/internal/modules/tracker"
)

// playableFiles lets the player open a file without knowing how the library keeps
// it — and, just as importantly, without taking a path from the client: the node
// plays what it scanned.
type playableFiles struct {
	library *library.Module
}

func (p playableFiles) Playable(ctx context.Context, fileID int64) (*playback.PlayableFile, error) {
	file, err := p.library.Playable(ctx, fileID)
	if err != nil || file == nil {
		return nil, err
	}

	return &playback.PlayableFile{
		ID:       file.ID,
		Path:     file.Path,
		Title:    file.Title,
		MediaRef: file.MediaRef,
		Episode:  file.Episode,
		Duration: file.Duration,
		Missing:  file.Missing,
	}, nil
}

// watchedEpisodes carries what the player saw to the tracker, which owns what it
// means for the user's list.
type watchedEpisodes struct {
	tracker *tracker.Module
}

func (w watchedEpisodes) MarkWatched(ctx context.Context, mediaRef string, episode int) error {
	return w.tracker.MarkWatched(ctx, mediaRef, episode)
}
