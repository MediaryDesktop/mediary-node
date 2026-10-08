package service

import (
	"context"
	"maps"
	"slices"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/qbittorrent"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// TorrentFile is one file inside a torrent, as the library reads its name.
type TorrentFile struct {
	Index    int     `json:"index"`
	Name     string  `json:"name" doc:"Path inside the torrent, with forward slashes."`
	Size     int64   `json:"size"`
	Progress float64 `json:"progress" minimum:"0" maximum:"1"`
	Selected bool    `json:"selected" doc:"Whether the client downloads it."`
	Video    bool    `json:"video" doc:"Whether the library keeps it as a video."`
	Episode  *int    `json:"episode,omitempty" doc:"The episode its name gives; absent for an extra or a name without one."`
	Season   *int    `json:"season,omitempty" doc:"The season its name gives, for a show numbered by season; the episode then counts within it."`
}

// Files lists the torrent's files. It is empty while a magnet's metadata has not
// arrived: until then nobody knows what the torrent holds.
func (s *Service) Files(ctx context.Context, id int64) ([]TorrentFile, error) {
	download, err := s.find(ctx, id)
	if err != nil {
		return nil, err
	}

	client, err := s.requireClient(ctx)
	if err != nil {
		return nil, err
	}

	files, err := client.Files(ctx, download.InfoHash)
	if err != nil {
		return nil, err
	}

	out := make([]TorrentFile, 0, len(files))
	for i := range files {
		path := relPath(*download, files[i])
		video, episode := s.library.NameEpisode(path)

		out = append(out, TorrentFile{
			Season:   s.library.NameSeason(path),
			Index:    files[i].Index,
			Name:     files[i].Name,
			Size:     files[i].Size,
			Progress: files[i].Progress,
			Selected: files[i].Priority != qbittorrent.PrioritySkip,
			Video:    video,
			Episode:  episode,
		})
	}

	return out, nil
}

// SelectFiles makes the client download exactly these files. A torrent held for
// the choice starts once it is made.
func (s *Service) SelectFiles(ctx context.Context, id int64, selected []int) error {
	download, err := s.find(ctx, id)
	if err != nil {
		return err
	}
	if download.State != store.StateDownloading {
		return apperr.New(apperr.KindConflict, "the download has finished; its files can no longer be chosen")
	}
	if len(selected) == 0 {
		return apperr.Invalid("selected", "choose at least one file")
	}

	client, err := s.requireClient(ctx)
	if err != nil {
		return err
	}

	files, err := client.Files(ctx, download.InfoHash)
	if err != nil {
		return err
	}
	if len(files) == 0 {
		return apperr.New(apperr.KindConflict, "the torrent's file list has not arrived yet")
	}

	wanted := make(map[int]bool, len(selected))
	for _, index := range selected {
		wanted[index] = true
	}

	var keep, skip []int
	for i := range files {
		if wanted[files[i].Index] {
			keep = append(keep, files[i].Index)
			delete(wanted, files[i].Index)
		} else {
			skip = append(skip, files[i].Index)
		}
	}

	if len(wanted) > 0 {
		unknown := slices.Sorted(maps.Keys(wanted))
		return apperr.Invalid("selected", "the torrent has no file %d", unknown[0])
	}

	if err := client.SetFilePriority(ctx, download.InfoHash, keep, qbittorrent.PriorityNormal); err != nil {
		return err
	}
	if err := client.SetFilePriority(ctx, download.InfoHash, skip, qbittorrent.PrioritySkip); err != nil {
		return err
	}

	if download.Choosing {
		if err := client.Resume(ctx, download.InfoHash); err != nil {
			return err
		}
		if err := s.store.SetChoosing(ctx, download.ID, false, s.opts.Now()); err != nil {
			return apperr.Wrap(err, apperr.KindInternal, "save the file choice")
		}
	}

	s.signal()
	s.publish("files", download.ID)

	return nil
}
