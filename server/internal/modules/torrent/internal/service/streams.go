package service

import (
	"context"
	"path"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/debrid"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// Streamer is a client that can play a torrent without downloading it: a debrid
// service, which holds the files and links to them.
type Streamer interface {
	Service() string
	Stream(ctx context.Context, magnet string, torrent []byte) (hash string, err error)
	StreamState(ctx context.Context, hash string) (debrid.Remote, error)
	StreamLink(ctx context.Context, hash string, fileID int) (string, error)
}

// A link is asked for again after this long. Services keep theirs for hours; a
// fresh one now and then costs one call and never plays an expired one.
const streamLinkTTL = 20 * time.Minute

// Streams are kept this long after they were last looked at.
const streamIdle = 6 * time.Hour

type StreamRequest struct {
	MediaRef string
	Title    string
	Magnet   string
	Torrent  []byte
	// ReleaseID is a search result to play, in place of a magnet or a file.
	ReleaseID string
	// Episode, and Season for a show numbered by season, pick the file from a
	// batch and are what the player marks watched.
	Episode *int
	Season  *int
}

// TorrentStream is a torrent being readied to play without downloading it.
type TorrentStream struct {
	ID       int64   `json:"id"`
	State    string  `json:"state" enum:"preparing,queued,ready,failed" doc:"ready once the service holds the file; failed when it gave up, or the torrent has no fitting video."`
	Service  string  `json:"service" example:"TorBox"`
	Progress float64 `json:"progress" minimum:"0" maximum:"1" doc:"How far the service is with the torrent, while preparing."`
	Speed    int64   `json:"speed" doc:"The service's download speed, bytes per second, while preparing."`
	Error    string  `json:"error,omitempty"`
	FileID   int64   `json:"file_id,omitempty" doc:"Once ready: a negative ID the player takes like a library file's — /v1/playback/files/{id}/stream, /direct, /hls and POST /v1/playback all accept it."`
	Name     string  `json:"name,omitempty" doc:"The file that plays, once chosen."`
	MediaRef string  `json:"media_ref"`
	Episode  *int    `json:"episode,omitempty"`
}

// StreamFile is a ready stream as the player needs it.
type StreamFile struct {
	FileID int64
	// Key names the file for the player's caches: the torrent's hash and the
	// file in it, which outlive the stream's own ID across restarts.
	Key      string
	URL      string
	Name     string
	Size     int64
	MediaRef string
	Episode  *int
	Season   *int
}

type streamEntry struct {
	id       int64
	hash     string
	mediaRef string
	title    string
	episode  *int
	season   *int
	// The chosen file, once the service has the files; -1 until then.
	file     int
	name     string
	size     int64
	link     string
	linkedAt time.Time
	usedAt   time.Time
}

type streamRegistry struct {
	mu   sync.Mutex
	last int64
	byID map[int64]*streamEntry
}

// StartStream gives the torrent to the debrid service and starts readying it.
// Asking again for the same torrent and episode returns the stream already made.
func (s *Service) StartStream(ctx context.Context, req StreamRequest) (*TorrentStream, error) {
	req.MediaRef = strings.TrimSpace(req.MediaRef)
	if req.MediaRef == "" {
		return nil, apperr.Invalid("media_ref", "a stream has to be for a title")
	}

	given := 0
	for _, set := range []bool{req.Magnet != "", len(req.Torrent) > 0, req.ReleaseID != ""} {
		if set {
			given++
		}
	}
	if given != 1 {
		return nil, apperr.Invalid("magnet", "give one of a magnet link, a .torrent file or a search result")
	}

	streamer, err := s.streamer(ctx)
	if err != nil {
		return nil, err
	}

	if req.ReleaseID != "" {
		if req.Magnet, req.Torrent, err = s.resolveRelease(ctx, req.ReleaseID); err != nil {
			return nil, err
		}
	}

	hash, err := streamer.Stream(ctx, req.Magnet, req.Torrent)
	if err != nil {
		return nil, err
	}

	entry := s.streamFor(hash, req)

	return s.streamView(ctx, streamer, entry)
}

// StreamStatus is how far a stream is; the client asks again until it is ready.
func (s *Service) StreamStatus(ctx context.Context, id int64) (*TorrentStream, error) {
	entry := s.streamEntry(id)
	if entry == nil {
		return nil, apperr.New(apperr.KindNotFound, "stream %d does not exist", id)
	}

	streamer, err := s.streamer(ctx)
	if err != nil {
		return nil, err
	}

	return s.streamView(ctx, streamer, entry)
}

// StreamFile is a ready stream's file and a current link to it, for the player.
// fileID is the negative ID the stream gave out.
func (s *Service) StreamFile(ctx context.Context, fileID int64) (*StreamFile, error) {
	entry := s.streamEntry(-fileID)
	if entry == nil {
		return nil, apperr.New(apperr.KindNotFound, "stream %d does not exist: start it again", -fileID)
	}

	s.streams.mu.Lock()
	file, link, linkedAt := entry.file, entry.link, entry.linkedAt
	s.streams.mu.Unlock()

	if file < 0 {
		return nil, apperr.New(apperr.KindPrecondition, "the stream is not ready yet")
	}

	if link == "" || time.Since(linkedAt) >= streamLinkTTL {
		streamer, err := s.streamer(ctx)
		if err != nil {
			return nil, err
		}

		if link, err = streamer.StreamLink(ctx, entry.hash, file); err != nil {
			return nil, err
		}

		s.streams.mu.Lock()
		entry.link, entry.linkedAt = link, time.Now()
		s.streams.mu.Unlock()
	}

	s.streams.mu.Lock()
	defer s.streams.mu.Unlock()

	return &StreamFile{
		FileID:   fileID,
		Key:      "stream-" + entry.hash + "-" + strconv.Itoa(file),
		URL:      link,
		Name:     entry.name,
		Size:     entry.size,
		MediaRef: entry.mediaRef,
		Episode:  entry.episode,
		Season:   entry.season,
	}, nil
}

// RenewStreamLink forgets a stream's link, so the next StreamFile asks the
// service for a fresh one: the service's CDN refused the old one.
func (s *Service) RenewStreamLink(fileID int64) {
	entry := s.streamEntry(-fileID)
	if entry == nil {
		return
	}

	s.streams.mu.Lock()
	entry.link = ""
	s.streams.mu.Unlock()
}

func (s *Service) streamer(ctx context.Context) (Streamer, error) {
	client, err := s.requireClient(ctx)
	if err != nil {
		return nil, err
	}

	streamer, ok := client.(Streamer)
	if !ok {
		return nil, apperr.New(apperr.KindPrecondition, "watching without downloading needs a debrid service as the torrent client")
	}

	return streamer, nil
}

func (s *Service) streamFor(hash string, req StreamRequest) *streamEntry {
	s.streams.mu.Lock()
	defer s.streams.mu.Unlock()

	now := s.opts.Now()

	for id, entry := range s.streams.byID {
		if now.Sub(entry.usedAt) > streamIdle {
			delete(s.streams.byID, id)
		}
	}

	for _, entry := range s.streams.byID {
		if entry.hash == hash && sameEpisode(entry.episode, req.Episode) && sameEpisode(entry.season, req.Season) {
			entry.usedAt = now
			return entry
		}
	}

	if s.streams.byID == nil {
		s.streams.byID = map[int64]*streamEntry{}
	}

	s.streams.last++
	entry := &streamEntry{
		id:       s.streams.last,
		hash:     hash,
		mediaRef: req.MediaRef,
		title:    strings.TrimSpace(req.Title),
		episode:  req.Episode,
		season:   req.Season,
		file:     -1,
		usedAt:   now,
	}
	s.streams.byID[entry.id] = entry

	return entry
}

func (s *Service) streamEntry(id int64) *streamEntry {
	s.streams.mu.Lock()
	defer s.streams.mu.Unlock()

	entry := s.streams.byID[id]
	if entry != nil {
		entry.usedAt = s.opts.Now()
	}

	return entry
}

func sameEpisode(a, b *int) bool {
	return (a == nil && b == nil) || (a != nil && b != nil && *a == *b)
}

func (s *Service) streamView(ctx context.Context, streamer Streamer, entry *streamEntry) (*TorrentStream, error) {
	remote, err := streamer.StreamState(ctx, entry.hash)
	if err != nil {
		return nil, err
	}

	view := &TorrentStream{
		ID:       entry.id,
		Service:  streamer.Service(),
		MediaRef: entry.mediaRef,
		Episode:  entry.episode,
	}

	switch {
	case remote.Failed != "":
		view.State, view.Error = "failed", remote.Failed
		return view, nil
	case remote.Queued:
		view.State = "queued"
		return view, nil
	case !remote.Ready || len(remote.Files) == 0:
		view.State = "preparing"
		view.Progress = min(max(remote.Progress, 0), 1)
		view.Speed = max(remote.Speed, 0)
		return view, nil
	}

	s.streams.mu.Lock()
	chosen := entry.file
	s.streams.mu.Unlock()

	if chosen < 0 {
		file, ok := s.chooseFile(remote.Files, entry.episode, entry.season)
		if !ok {
			view.State = "failed"
			view.Error = "the torrent has no video for this episode"
			if entry.episode == nil {
				view.Error = "the torrent has no video"
			}
			return view, nil
		}

		s.streams.mu.Lock()
		entry.file, entry.name, entry.size = file.ID, path.Base(file.Path), file.Size
		s.streams.mu.Unlock()
	}

	s.streams.mu.Lock()
	view.Name = entry.name
	s.streams.mu.Unlock()

	view.State, view.Progress, view.FileID = "ready", 1, -entry.id

	return view, nil
}

// chooseFile picks the video to play: the one whose name gives the episode, in
// the season when one is asked; without an episode, the largest video, which is
// the film or the episode in a single-episode release.
func (s *Service) chooseFile(files []debrid.RemoteFile, episode, season *int) (debrid.RemoteFile, bool) {
	var best debrid.RemoteFile
	found := false

	for _, file := range files {
		video, number := s.library.NameEpisode(file.Path)
		if !video {
			continue
		}

		if episode != nil {
			if number == nil || *number != *episode {
				continue
			}
			if season != nil {
				if named := s.library.NameSeason(file.Path); named != nil && *named != *season {
					continue
				}
			}
		}

		if !found || file.Size > best.Size {
			best, found = file, true
		}
	}

	return best, found
}
