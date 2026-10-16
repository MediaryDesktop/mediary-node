package app

import (
	"context"
	"strings"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library"
	"github.com/mediaryorg/mediary-node/server/internal/modules/media"
	"github.com/mediaryorg/mediary-node/server/internal/modules/playback"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent"
	"github.com/mediaryorg/mediary-node/server/internal/modules/tracker"
)

// playableFiles lets the player open a file without knowing how the library keeps
// it — and, just as importantly, without taking a path from the client: the node
// plays what it scanned, or a stream it made from a debrid service, which takes
// a negative ID so the player handles both alike.
type playableFiles struct {
	library *library.Module
	media   *media.Module
	streams *torrent.Module
}

func (p playableFiles) Playable(ctx context.Context, fileID int64) (*playback.PlayableFile, error) {
	if fileID < 0 {
		return p.stream(ctx, fileID)
	}

	file, err := p.library.Playable(ctx, fileID)
	if err != nil || file == nil {
		return nil, err
	}

	return &playback.PlayableFile{
		ID:       file.ID,
		Path:     file.Path,
		Title:    file.Title,
		MediaRef: file.MediaRef,
		Episode:  p.overallEpisode(ctx, file.MediaRef, file.Season, file.Episode),
		Duration: file.Duration,
		Missing:  file.Missing,
	}, nil
}

func (p playableFiles) stream(ctx context.Context, fileID int64) (*playback.PlayableFile, error) {
	if p.streams == nil {
		return nil, nil
	}

	file, err := p.streams.StreamFile(ctx, fileID)
	if err != nil {
		return nil, err
	}

	return &playback.PlayableFile{
		ID:       fileID,
		Path:     file.URL,
		Title:    file.Name,
		MediaRef: file.MediaRef,
		Episode:  p.overallEpisode(ctx, file.MediaRef, file.Season, file.Episode),
		Remote:   true,
		Key:      file.Key,
		Open:     file.Open,
	}, nil
}

// RenewLink drops a stream's link after the service's CDN refused it.
func (p playableFiles) RenewLink(fileID int64) {
	if fileID < 0 && p.streams != nil {
		p.streams.RenewStreamLink(fileID)
	}
}

// overallEpisode counts a show's episode across its seasons — S02E05 of a show
// whose first season has ten is the fifteenth — because progress on a list is
// one number, as on AniList. Without the episode list the file's own number
// stands, which is still right for a first season.
func (p playableFiles) overallEpisode(ctx context.Context, mediaRef string, season, episode *int) *int {
	if episode == nil || season == nil || !strings.HasPrefix(mediaRef, "tmdb:tv:") {
		return episode
	}

	list, err := p.media.Episodes(ctx, mediaRef)
	if err != nil {
		return episode
	}

	for i := range list.Episodes {
		listed := &list.Episodes[i]
		if listed.Season != nil && *listed.Season == *season && listed.Number == *episode {
			overall := i + 1
			return &overall
		}
	}

	return episode
}

// watchedEpisodes carries what the player saw to the tracker, which owns what it
// means for the user's list.
type watchedEpisodes struct {
	tracker *tracker.Module
}

func (w watchedEpisodes) MarkWatched(ctx context.Context, mediaRef string, episode int) error {
	return w.tracker.MarkWatched(ctx, mediaRef, episode)
}
