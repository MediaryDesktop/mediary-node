package service

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/playback/internal/mpv"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

const (
	// A file counts as watched at this point, not at the very end: credits, next-episode
	// previews and the habit of closing the window early all live in the last minutes.
	watchedFraction = 0.85

	// One position event per interval. mpv reports the position several times a
	// second and the UI cannot use more than this.
	positionInterval = time.Second

	// Property ids for observe_property. They come back on every change, so the
	// pump tells them apart by name rather than by id.
	positionProperty = 1
	durationProperty = 2
	pauseProperty    = 3
)

type Options struct {
	Launcher    Launcher
	Library     Library
	Progress    Progress
	Prober      Prober
	Extractor   Extractor
	Thumbnailer Thumbnailer
	Transcoder  Transcoder

	Now func() time.Time
}

type Service struct {
	logger zerolog.Logger
	hub    *events.Hub
	opts   Options

	mu      sync.Mutex
	session *PlaybackSession
	player  Player

	// Files the built-in player already counted. Its reports arrive every few
	// seconds past the threshold, and each would otherwise be another write to
	// the user's list.
	counted map[int64]bool
}

func New(logger zerolog.Logger, hub *events.Hub, opts Options) *Service {
	if opts.Now == nil {
		opts.Now = time.Now
	}

	return &Service{logger: logger, hub: hub, opts: opts}
}

func (s *Service) Status() PlaybackStatus {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.statusLocked()
}

// Start opens the player on a library file. One window at a time: starting a second
// file replaces the first, because two players fighting over the same speakers is
// never what the user meant.
func (s *Service) Start(ctx context.Context, fileID int64) (*PlaybackStatus, error) {
	if s.opts.Launcher == nil {
		return nil, apperr.New(apperr.KindPrecondition, "playback is not configured on this node")
	}

	file, err := s.playable(ctx, fileID)
	if err != nil {
		return nil, err
	}

	s.stop()

	player, err := s.opts.Launcher.Start(ctx, file.Path, 0)
	if err != nil {
		return nil, err
	}

	session := &PlaybackSession{
		FileID:    file.ID,
		Path:      file.Path,
		Title:     file.Title,
		MediaRef:  file.MediaRef,
		Episode:   file.Episode,
		StartedAt: s.opts.Now(),
	}

	s.mu.Lock()
	s.session = session
	s.player = player
	status := s.statusLocked()
	s.mu.Unlock()

	s.observe(ctx, player)

	// The pump outlives the request that started playback, so it gets a context of
	// its own: an episode is watched long after the POST has been answered.
	go s.pump(context.WithoutCancel(ctx), player)

	s.publish("started", session)

	return &status, nil
}

func (s *Service) observe(ctx context.Context, player Player) {
	for id, property := range map[int]string{
		positionProperty: "time-pos",
		durationProperty: "duration",
		pauseProperty:    "pause",
	} {
		if err := player.Observe(ctx, id, property); err != nil {
			s.logger.Warn().Err(err).Str("property", property).Msg("mpv refused to report a property")
		}
	}
}

// Control steers the open player. There is deliberately little here: mpv's own
// window is in front of the user, and the node only adds what the desktop needs to
// show and to nudge.
func (s *Service) Control(ctx context.Context, action Action, value float64) (*PlaybackStatus, error) {
	s.mu.Lock()
	player := s.player
	s.mu.Unlock()

	if player == nil {
		return nil, apperr.New(apperr.KindPrecondition, "nothing is playing")
	}

	var err error

	switch action {
	case ActionPause:
		err = player.Set(ctx, "pause", true)
	case ActionResume:
		err = player.Set(ctx, "pause", false)
	case ActionSeek:
		_, err = player.Command(ctx, "seek", value, "absolute")
	default:
		return nil, apperr.Invalid("action", "unknown playback action %q", action)
	}

	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindUnavailable, "the player did not accept the command")
	}

	status := s.Status()

	return &status, nil
}

func (s *Service) Stop() PlaybackStatus {
	s.stop()

	return s.Status()
}

func (s *Service) stop() {
	s.mu.Lock()
	player := s.player
	s.player = nil
	s.mu.Unlock()

	if player != nil {
		if err := player.Close(); err != nil {
			s.logger.Debug().Err(err).Msg("close player")
		}
	}
}

// pump follows the player until it closes: it keeps the session current, forwards
// what the UI needs, and decides when the episode counts as watched. Every side
// effect lives here; apply only folds the event into the session.
func (s *Service) pump(ctx context.Context, player Player) {
	lastPublished := time.Time{}

	for {
		select {
		case event, open := <-player.Events():
			if !open {
				s.finish(ctx, player, false)

				return
			}

			change := s.apply(event)

			switch {
			case change.pauseChanged:
				s.publish("paused", s.snapshot())

			case change.positionMoved:
				now := s.opts.Now()
				if now.Sub(lastPublished) >= positionInterval {
					lastPublished = now
					s.publish("position", s.snapshot())
				}
			}

			if change.reachedWatched {
				s.markWatched(ctx)
			}

			if event.Name == "end-file" {
				s.finish(ctx, player, event.Reason == "eof")

				return
			}

		case <-player.Closed():
			s.finish(ctx, player, false)

			return
		}
	}
}

// applied says what one player event did to the session, so the caller knows what
// is worth telling anyone about.
type applied struct {
	positionMoved  bool
	pauseChanged   bool
	reachedWatched bool
}

func (s *Service) apply(event mpv.Event) applied {
	if event.Name != "property-change" {
		return applied{}
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	session := s.session
	if session == nil {
		return applied{}
	}

	change := applied{}

	switch event.Property {
	case "time-pos":
		var position float64
		if json.Unmarshal(event.Data, &position) == nil {
			session.Position = position
			change.positionMoved = true
		}
	case "duration":
		var duration float64
		if json.Unmarshal(event.Data, &duration) == nil {
			session.Duration = duration
		}
	case "pause":
		var paused bool
		if json.Unmarshal(event.Data, &paused) == nil {
			session.Paused = paused
			change.pauseChanged = true
		}
	}

	change.reachedWatched = !session.Watched &&
		shouldMarkWatched(session.Position, session.Duration, false)

	return change
}

func (s *Service) finish(ctx context.Context, player Player, playedToEnd bool) {
	if playedToEnd {
		s.markWatched(ctx)
	}

	if err := player.Close(); err != nil {
		s.logger.Debug().Err(err).Msg("close player")
	}

	s.mu.Lock()
	if s.player == player {
		s.player = nil
	}
	ended := s.session
	s.session = nil
	s.mu.Unlock()

	s.publish("ended", ended)
}

// markWatched tells the tracker once per session. The tracker owns what happens
// next — including refusing to lower progress the user already has elsewhere.
func (s *Service) markWatched(ctx context.Context) {
	s.mu.Lock()
	session := s.session

	if session == nil || session.Watched || session.MediaRef == "" || session.Episode == nil {
		s.mu.Unlock()

		return
	}

	session.Watched = true
	mediaRef := session.MediaRef
	episode := *session.Episode
	snapshot := *session
	s.mu.Unlock()

	if s.opts.Progress == nil {
		return
	}

	if err := s.opts.Progress.MarkWatched(ctx, mediaRef, episode); err != nil {
		s.logger.Warn().Err(err).Str("media_ref", mediaRef).Int("episode", episode).
			Msg("could not record the episode as watched")

		s.mu.Lock()
		if s.session != nil && s.session.FileID == snapshot.FileID {
			s.session.Watched = false
		}
		s.mu.Unlock()

		return
	}

	s.publish("watched", &snapshot)
}

// ReportProgress is the built-in player's side of what the mpv pump does: the
// renderer says where it is, and the same rule decides when the episode counts.
func (s *Service) ReportProgress(ctx context.Context, fileID int64, position, duration float64, ended bool) (bool, error) {
	if !shouldMarkWatched(position, duration, ended) {
		return false, nil
	}

	s.mu.Lock()
	counted := s.counted[fileID]
	s.mu.Unlock()

	if counted {
		return true, nil
	}

	file, err := s.playable(ctx, fileID)
	if err != nil {
		return false, err
	}

	if file.MediaRef == "" || file.Episode == nil || s.opts.Progress == nil {
		return false, nil
	}

	if err := s.opts.Progress.MarkWatched(ctx, file.MediaRef, *file.Episode); err != nil {
		return false, apperr.Wrap(err, apperr.KindUnavailable, "could not record the episode as watched")
	}

	s.mu.Lock()
	if s.counted == nil {
		s.counted = map[int64]bool{}
	}
	s.counted[fileID] = true
	s.mu.Unlock()

	s.hub.Publish(events.TopicPlayback, map[string]any{
		"state":     "watched",
		"file_id":   file.ID,
		"media_ref": file.MediaRef,
		"watched":   true,
	})

	return true, nil
}

// shouldMarkWatched is the whole rule, kept apart from the plumbing because it is
// the part that can be wrong in a way the user notices.
func shouldMarkWatched(position, duration float64, playedToEnd bool) bool {
	if playedToEnd {
		return true
	}
	if duration <= 0 {
		return false
	}

	return position/duration >= watchedFraction
}

func (s *Service) statusLocked() PlaybackStatus {
	if s.session == nil {
		return PlaybackStatus{}
	}

	session := *s.session

	return PlaybackStatus{Playing: s.player != nil, Session: &session}
}

func (s *Service) snapshot() *PlaybackSession {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.session == nil {
		return nil
	}

	session := *s.session

	return &session
}

func (s *Service) publish(state string, session *PlaybackSession) {
	payload := map[string]any{"state": state}

	if session != nil {
		payload["file_id"] = session.FileID
		payload["position"] = session.Position
		payload["duration"] = session.Duration
		payload["paused"] = session.Paused
		payload["watched"] = session.Watched

		if session.MediaRef != "" {
			payload["media_ref"] = session.MediaRef
		}
	}

	s.hub.Publish(events.TopicPlayback, payload)
}
