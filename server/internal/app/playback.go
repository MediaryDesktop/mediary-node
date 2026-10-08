package app

import (
	"context"
	"strings"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library"
	"github.com/mediaryorg/mediary-node/server/internal/modules/media"
	"github.com/mediaryorg/mediary-node/server/internal/modules/playback"
	"github.com/mediaryorg/mediary-node/server/internal/modules/tracker"
)

// playableFiles lets the player open a file without knowing how the library keeps
// it — and, just as importantly, without taking a path from the client: the node
// plays what it scanned.
type playableFiles struct {
	library *library.Module
	media   *media.Module
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
		Episode:  p.overallEpisode(ctx, file),
		Duration: file.Duration,
		Missing:  file.Missing,
	}, nil
}

// overallEpisode counts a show's episode across its seasons — S02E05 of a show
// whose first season has ten is the fifteenth — because progress on a list is
// one number, as on AniList. Without the episode list the file's own number
// stands, which is still right for a first season.
func (p playableFiles) overallEpisode(ctx context.Context, file *library.PlayableFile) *int {
	if file.Episode == nil || file.Season == nil || !strings.HasPrefix(file.MediaRef, "tmdb:tv:") {
		return file.Episode
	}

	list, err := p.media.Episodes(ctx, file.MediaRef)
	if err != nil {
		return file.Episode
	}

	for i := range list.Episodes {
		episode := &list.Episodes[i]
		if episode.Season != nil && *episode.Season == *file.Season && episode.Number == *file.Episode {
			overall := i + 1
			return &overall
		}
	}

	return file.Episode
}

// watchedEpisodes carries what the player saw to the tracker, which owns what it
// means for the user's list.
type watchedEpisodes struct {
	tracker *tracker.Module
}

func (w watchedEpisodes) MarkWatched(ctx context.Context, mediaRef string, episode int) error {
	return w.tracker.MarkWatched(ctx, mediaRef, episode)
}
