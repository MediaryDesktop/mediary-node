package service

import (
	"context"
	"fmt"
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

// A torrent the service has not got a byte of in this long has nobody sharing
// it: waiting more only keeps the player from opening on another release.
const streamStall = 3 * time.Minute

type StreamRequest struct {
	MediaRef string
	Title    string
	Magnet   string
	Torrent  []byte
	// ReleaseID is a search result to play, in place of a magnet or a file.
	ReleaseID string
	// Auto has the node search for the episode and play the best release, in
	// place of a magnet, a file or a search result.
	Auto bool
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
	Release  string  `json:"release,omitempty" doc:"The release the node picked, when it picked one."`
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
	file    int
	name    string
	release string
	// The search result it came from, when it came from one.
	releaseID string
	size      int64
	link      string
	linkedAt  time.Time
	usedAt    time.Time
	// When the stream was last asked for, which the stall is counted from.
	askedAt time.Time
}

type streamRegistry struct {
	mu   sync.Mutex
	last int64
	byID map[int64]*streamEntry
	// Hashes and search results that stalled, and when: auto-select passes
	// them over rather than wait on the same dead torrent again.
	stalled map[string]time.Time
}

// StartStream gives the torrent to the debrid service and starts readying it.
// Asking again for the same torrent and episode returns the stream already made.
func (s *Service) StartStream(ctx context.Context, req StreamRequest) (*TorrentStream, error) {
	req.MediaRef = strings.TrimSpace(req.MediaRef)
	if req.MediaRef == "" {
		return nil, apperr.Invalid("media_ref", "a stream has to be for a title")
	}

	given := 0
	for _, set := range []bool{req.Magnet != "", len(req.Torrent) > 0, req.ReleaseID != "", req.Auto} {
		if set {
			given++
		}
	}
	if given != 1 {
		return nil, apperr.Invalid("magnet", "give one of a magnet link, a .torrent file, a search result or auto")
	}

	streamer, err := s.streamer(ctx)
	if err != nil {
		return nil, err
	}

	var picked string
	if req.Auto {
		release, pickErr := s.pickStreamRelease(ctx, req)
		if pickErr != nil {
			return nil, pickErr
		}
		req.ReleaseID, picked = release.ID, release.Title
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
	s.streams.mu.Lock()
	if picked != "" {
		entry.release = picked
	}
	if req.ReleaseID != "" {
		entry.releaseID = req.ReleaseID
	}
	s.streams.mu.Unlock()

	return s.streamView(ctx, streamer, entry)
}

// pickStreamRelease searches for the episode and takes the release that plays
// soonest and best: one the debrid service already holds first — it plays in
// seconds, whatever its seeders — then one the profile allows, then the better
// scored. A batch counts when it holds the episode; the file is picked from it.
func (s *Service) pickStreamRelease(ctx context.Context, req StreamRequest) (*TorrentRelease, error) {
	var episode, season int
	if req.Episode != nil {
		episode = *req.Episode
	}
	if req.Season != nil {
		season = *req.Season
	}

	result, err := s.Search(ctx, SearchRequest{MediaRef: req.MediaRef, Episode: episode, Season: season})
	if err != nil {
		return nil, err
	}

	profile, err := s.Profile(ctx)
	if err != nil {
		return nil, err
	}

	s.streams.mu.Lock()
	live := make([]TorrentRelease, 0, len(result.Releases))
	for i := range result.Releases {
		found := &result.Releases[i]
		_, deadHash := s.streams.stalled[strings.ToLower(found.InfoHash)]
		_, deadID := s.streams.stalled["release:"+found.ID]
		if !deadID && (found.InfoHash == "" || !deadHash) {
			live = append(live, *found)
		}
	}
	s.streams.mu.Unlock()

	best := bestStreamRelease(live, episode > 0, profile)
	if best == nil {
		if episode > 0 {
			return nil, apperr.New(apperr.KindNotFound, "no release of episode %d was found: try choosing one in the search", episode)
		}
		return nil, apperr.New(apperr.KindNotFound, "no release was found: try choosing one in the search")
	}

	return best, nil
}

func bestStreamRelease(releases []TorrentRelease, forEpisode bool, profile *TorrentProfile) *TorrentRelease {
	var best *TorrentRelease

	for i := range releases {
		found := &releases[i]

		// With an episode asked, only a release that holds it: a name without
		// episodes may well be another season or a film.
		if forEpisode && found.Match != "episode" && found.Match != "batch" {
			continue
		}
		if excluded(found.Title, profile) {
			continue
		}

		held := found.Cached != nil && *found.Cached
		// Nothing plays from a torrent nobody seeds, unless the service has it.
		if !held && found.Seeders == 0 {
			continue
		}

		if best == nil || streamsBetter(found, best) {
			best = found
		}
	}

	return best
}

func streamsBetter(a, b *TorrentRelease) bool {
	aHeld, bHeld := a.Cached != nil && *a.Cached, b.Cached != nil && *b.Cached
	if aHeld != bHeld {
		return aHeld
	}
	if a.Eligible != b.Eligible {
		return a.Eligible
	}
	// A batch the service does not hold has to be fetched whole before the
	// episode plays, which for a long show is hundreds of gigabytes.
	if !aHeld && !bHeld && (a.Match == "episode") != (b.Match == "episode") {
		return a.Match == "episode"
	}

	return beats(*a, *b)
}

// excluded reports whether a release name carries a word the profile never wants.
func excluded(title string, profile *TorrentProfile) bool {
	name := strings.ToLower(title)
	for _, word := range profile.Excluded {
		if strings.Contains(name, strings.ToLower(word)) {
			return true
		}
	}

	return false
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

// streamer is the debrid service set up, whatever the torrent client: streams
// do not download, so they do not depend on who does.
func (s *Service) streamer(ctx context.Context) (Streamer, error) {
	active, err := s.activeDebrid(ctx)
	if err != nil {
		return nil, err
	}
	if active == nil {
		return nil, apperr.New(apperr.KindPrecondition, "watching without downloading needs a debrid service: set one up in the settings")
	}

	streamer, ok := active.service.Client.(Streamer)
	if !ok {
		return nil, apperr.New(apperr.KindUnavailable, "%s cannot play torrents here", debridNames[active.kind])
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
	for key, at := range s.streams.stalled {
		if now.Sub(at) > streamIdle {
			delete(s.streams.stalled, key)
		}
	}

	for _, entry := range s.streams.byID {
		if entry.hash == hash && sameEpisode(entry.episode, req.Episode) && sameEpisode(entry.season, req.Season) {
			entry.usedAt, entry.askedAt = now, now
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
		askedAt:  now,
	}
	s.streams.byID[entry.id] = entry

	return entry
}

func (s *Service) markStalled(entry *streamEntry) {
	s.streams.mu.Lock()
	defer s.streams.mu.Unlock()

	if s.streams.stalled == nil {
		s.streams.stalled = map[string]time.Time{}
	}

	now := s.opts.Now()
	s.streams.stalled[strings.ToLower(entry.hash)] = now
	if entry.releaseID != "" {
		s.streams.stalled["release:"+entry.releaseID] = now
	}
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

	s.streams.mu.Lock()
	release, askedAt := entry.release, entry.askedAt
	s.streams.mu.Unlock()

	view := &TorrentStream{
		ID:       entry.id,
		Service:  streamer.Service(),
		MediaRef: entry.mediaRef,
		Episode:  entry.episode,
		Release:  release,
	}

	switch {
	case remote.Failed != "":
		view.State, view.Error = "failed", remote.Failed
		return view, nil
	case remote.Queued:
		view.State = "queued"
		return view, nil
	case !remote.Ready && remote.Progress <= 0 && remote.Speed <= 0 && s.opts.Now().Sub(askedAt) > streamStall:
		s.markStalled(entry)
		view.State = "failed"
		view.Error = fmt.Sprintf("%s found nobody sharing this release in %d minutes: choose another one in the search",
			streamer.Service(), int(streamStall.Minutes()))
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
