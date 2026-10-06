package service

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/qbittorrent"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// How many polls in a row a torrent has to be missing from the client before its
// download is given up.
const missingPolls = 3

// Start follows the downloads until ctx ends. A node that stopped mid-download
// picks up where it was: the client kept downloading, and the table says what
// for.
func (s *Service) Start(ctx context.Context) {
	go s.loop(ctx)
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
			s.fail(ctx, download, "the torrent is no longer in qBittorrent")
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

		if _, err := os.Stat(filepath.Join(rootPath, filepath.FromSlash(rel))); errors.Is(err, fs.ErrNotExist) {
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

	s.publish("done", download.ID)
}

func (s *Service) fail(ctx context.Context, download store.Download, reason string) {
	if err := s.store.SetState(ctx, download.ID, store.StateFailed, reason, s.opts.Now()); err != nil {
		s.logger.Error().Err(err).Int64("id", download.ID).Msg("mark torrent download failed")
		return
	}

	s.publish("failed", download.ID)
}
