package service

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/qbittorrent"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/release"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/store"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

// How many polls in a row a torrent has to be missing from the client before its
// download is given up.
const missingPolls = 3

// How long a finished torrent's file may keep its working name before the
// import gives up on it.
const unfinishedWait = 2 * time.Minute

// The names clients write a file under until it is whole: the built-in
// client's, and qBittorrent's when "append .!qB" is on.
var workingSuffixes = []string{".part", ".!qB"}

// stillUnfinished reports whether a file the client calls done is only waiting
// to be renamed from its working name, a moment after the last piece.
func stillUnfinished(file string) bool {
	for _, suffix := range workingSuffixes {
		if _, err := os.Stat(file + suffix); err == nil {
			return true
		}
	}

	return false
}

// Start follows the downloads until ctx ends. A node that stopped mid-download
// picks up where it was: the client kept downloading, and the table says what
// for.
func (s *Service) Start(ctx context.Context) {
	go s.loop(ctx)
	go s.watchRules(ctx)
}

func (s *Service) loop(ctx context.Context) {
	for {
		active := s.Poll(ctx)

		wait := s.opts.IdleInterval
		if active {
			wait = s.opts.ActiveInterval
		}

		timer := time.NewTimer(wait)

		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-s.wake:
			timer.Stop()
		case <-timer.C:
		}
	}
}

// Poll asks the client about every unfinished download once, moves finished ones
// into the library, and reports whether any is still being followed.
func (s *Service) Poll(ctx context.Context) bool {
	unfinished, err := s.store.Unfinished(ctx)
	if err != nil {
		s.logger.Error().Err(err).Msg("list unfinished torrent downloads")
		return false
	}

	client, err := s.currentClient(ctx)
	if err != nil || client == nil {
		s.setClientError(err)
		return false
	}

	if len(unfinished) == 0 {
		// Nothing to follow, but the settings screen still wants to know whether
		// the client answers.
		_, versionErr := client.Version(ctx)
		s.setClientError(versionErr)
		return false
	}

	hashes := make([]string, 0, len(unfinished))
	for i := range unfinished {
		hashes = append(hashes, unfinished[i].InfoHash)
	}

	torrents, err := client.Torrents(ctx, hashes)
	s.setClientError(err)
	if err != nil {
		if !errors.Is(err, context.Canceled) {
			s.logger.Debug().Err(err).Msg("could not ask the torrent client")
		}
		return true
	}

	byHash := make(map[string]qbittorrent.Torrent, len(torrents))
	for i := range torrents {
		byHash[torrents[i].Hash] = torrents[i]
	}

	s.mu.Lock()
	s.live = byHash
	s.mu.Unlock()

	for i := range unfinished {
		torrent, found := byHash[unfinished[i].InfoHash]
		s.follow(ctx, client, unfinished[i], torrent, found)
	}

	s.publish("progress", 0)

	return true
}

func (s *Service) setClientError(err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.polled = true
	if err == nil {
		s.clientError = ""
		return
	}

	// The message alone: the cause is a Go network error, for the log, not for a
	// person reading the settings screen.
	s.clientError = messageOf(err)
}

func (s *Service) follow(ctx context.Context, client Client, download store.Download, torrent qbittorrent.Torrent, found bool) {
	now := s.opts.Now()

	if !found {
		// qBittorrent loads its torrents a moment after its WebUI answers, so one
		// empty answer right after it starts is not a removal.
		s.mu.Lock()
		s.missing[download.InfoHash]++
		gone := s.missing[download.InfoHash] >= missingPolls
		s.mu.Unlock()

		if gone {
			s.fail(ctx, download, "the torrent is no longer in the torrent client")
		}
		return
	}

	s.mu.Lock()
	delete(s.missing, download.InfoHash)
	s.mu.Unlock()

	if torrent.Name != "" && torrent.Name != download.Name {
		if err := s.store.SetName(ctx, download.ID, torrent.Name, now); err != nil {
			s.logger.Warn().Err(err).Int64("id", download.ID).Msg("save torrent name")
		}
	}

	if download.Choosing && len(download.Episodes) > 0 {
		s.pickEpisodes(ctx, client, download)
		return
	}

	if download.State == store.StateDownloading {
		if !complete(torrent) {
			return
		}

		if err := s.store.SetState(ctx, download.ID, store.StateImporting, "", now); err != nil {
			s.logger.Error().Err(err).Int64("id", download.ID).Msg("mark torrent download importing")
			return
		}
		download.State = store.StateImporting
		s.publish("importing", download.ID)
	}

	s.importFiles(ctx, client, download)
}

// complete reports whether every selected file is on disk. A torrent the client
// is still checking or moving is not, whatever its progress says.
func complete(t qbittorrent.Torrent) bool {
	if t.Progress < 1 {
		return false
	}

	for _, busy := range []string{"checking", "moving", "metaDL", "allocating"} {
		if strings.HasPrefix(t.State, busy) {
			return false
		}
	}

	return true
}

// importFiles adds the torrent's finished videos to the library under the title it
// was downloaded for. It is safe to run again: a file already in the library is
// only matched again.
func (s *Service) importFiles(ctx context.Context, client Client, download store.Download) {
	files, err := client.Files(ctx, download.InfoHash)
	if err != nil {
		s.logger.Debug().Err(err).Int64("id", download.ID).Msg("list torrent files")
		return
	}

	rootPath, found, err := s.library.RootPath(ctx, download.RootID)
	if err != nil {
		s.logger.Error().Err(err).Int64("id", download.ID).Msg("read the download folder")
		return
	}
	if !found {
		s.fail(ctx, download, "the download folder is no longer in the library")
		return
	}

	imported := 0

	for _, file := range files {
		if file.Priority == 0 || file.Progress < 1 {
			continue
		}

		rel := relPath(download, file)
		full := filepath.Join(rootPath, filepath.FromSlash(rel))

		if _, err := os.Stat(full); errors.Is(err, fs.ErrNotExist) {
			if stillUnfinished(full) {
				s.waitUnfinished(ctx, download, rel)
				return
			}

			s.fail(ctx, download, "the downloaded files are not where the node expects them; check the path mapping in the torrent settings")
			return
		}

		if _, err := s.library.ImportFile(ctx, download.RootID, rel, download.MediaRef, nil); err != nil {
			// Subtitles, covers and the rest are not files the library keeps.
			if apperr.KindOf(err) == apperr.KindPrecondition {
				continue
			}

			s.logger.Warn().Err(err).Str("file", rel).Msg("import downloaded file")
			_ = s.store.SetState(ctx, download.ID, store.StateImporting, err.Error(), s.opts.Now())

			return
		}

		imported++
	}

	if imported == 0 {
		s.fail(ctx, download, "the torrent has no video the library can keep")
		return
	}

	if err := s.store.Finish(ctx, download.ID, imported, s.opts.Now()); err != nil {
		s.logger.Error().Err(err).Int64("id", download.ID).Msg("finish torrent download")
		return
	}

	s.mu.Lock()
	delete(s.unfinished, download.InfoHash)
	s.mu.Unlock()

	s.publish("done", download.ID)
}

// waitUnfinished leaves the import for the next poll while the client renames
// the file, and fails it once that has taken far longer than it does.
func (s *Service) waitUnfinished(ctx context.Context, download store.Download, rel string) {
	now := s.opts.Now()

	s.mu.Lock()
	since, waiting := s.unfinished[download.InfoHash]
	if !waiting {
		since = now
		s.unfinished[download.InfoHash] = now
	}
	s.mu.Unlock()

	if now.Sub(since) < unfinishedWait {
		return
	}

	s.fail(ctx, download, "the torrent client finished "+path.Base(rel)+" but never gave it its name")
}

func (s *Service) fail(ctx context.Context, download store.Download, reason string) {
	s.mu.Lock()
	delete(s.unfinished, download.InfoHash)
	s.mu.Unlock()

	if err := s.store.SetState(ctx, download.ID, store.StateFailed, reason, s.opts.Now()); err != nil {
		s.logger.Error().Err(err).Int64("id", download.ID).Msg("mark torrent download failed")
		return
	}

	s.publish("failed", download.ID)
}

// pickEpisodes chooses a held batch's files for the episodes it was added for,
// once the client has its file list: their videos, and the files that belong to
// no other episode — fonts, a shared subtitle. A batch without any of them is
// given up and taken out of the client before it downloads anything.
func (s *Service) pickEpisodes(ctx context.Context, client Client, download store.Download) {
	files, err := client.Files(ctx, download.InfoHash)
	if err != nil || len(files) == 0 {
		return
	}

	wanted := map[int]bool{}
	for _, episode := range download.Episodes {
		wanted[episode] = true
	}

	var selected []int
	videos := 0

	for i := range files {
		video, episode := s.library.NameEpisode(relPath(download, files[i]))

		switch {
		case video && episode != nil && wanted[*episode]:
			selected = append(selected, files[i].Index)
			videos++
		case video:
		case belongsTo(files[i].Name, wanted):
			selected = append(selected, files[i].Index)
		}
	}

	if videos == 0 {
		if err := client.Delete(ctx, download.InfoHash, true); err != nil {
			s.logger.Warn().Err(err).Int64("id", download.ID).Msg("remove a batch without the wanted episodes")
		}
		s.fail(ctx, download, "the torrent holds none of the episodes it was added for")
		return
	}

	if err := s.SelectFiles(ctx, download.ID, selected); err != nil {
		s.logger.Warn().Err(err).Int64("id", download.ID).Msg("choose a batch's episodes")
	}
}

// belongsTo reports whether a file that is not a video goes with the wanted
// episodes: one whose name gives none of the other episodes' numbers.
func belongsTo(name string, wanted map[int]bool) bool {
	episodes := release.Parse(path.Base(name)).Episodes
	if episodes == nil {
		return true
	}

	for episode := episodes.From; episode <= episodes.To; episode++ {
		if wanted[episode] {
			return true
		}
	}

	return false
}
