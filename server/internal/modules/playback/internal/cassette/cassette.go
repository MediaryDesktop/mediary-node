// Adapted from Seanime (github.com/5rahim/seanime, internal/mediastream/cassette),
// GPL-3.0.
package cassette

import (
	"context"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"sync"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/playback/internal/videofile"
)

// NewCassetteOptions configuration for the transcoder
type NewCassetteOptions struct {
	Logger                *zerolog.Logger
	HwAccelKind           string
	Preset                string
	TempOutDir            string
	FfmpegPath            string
	FfprobePath           string
	HwAccelCustomSettings string
	// MaxConcurrency limits simultaneous ffmpeg processes. 0 = NumCPU
	MaxConcurrency int
}

// Cassette is the top-level transcoding orchestrator.
// it manages sessions, client tracking, and resource allocation.
type Cassette struct {
	sessionsMu sync.Mutex
	sessions   map[string]*Session // keyed by file path

	clientChan chan ClientInfo
	tracker    *ClientTracker
	governor   *Governor
	logger     *zerolog.Logger
	settings   Settings
}

// New creates and returns a cassette instance.
// it prepares the stream directory and initializes the governor and tracker.
func New(opts *NewCassetteOptions) (*Cassette, error) {
	streamDir := filepath.Join(opts.TempOutDir, "streams")
	if err := os.MkdirAll(streamDir, 0o750); err != nil {
		return nil, fmt.Errorf("cassette: failed to create stream dir: %w", err)
	}

	// clear stale segment dirs from previous runs.
	entries, err := os.ReadDir(streamDir)
	if err != nil {
		return nil, err
	}
	for _, e := range entries {
		_ = os.RemoveAll(path.Join(streamDir, e.Name()))
	}

	hwAccel := BuildHwAccelProfile(HwAccelOptions{
		Kind:           opts.HwAccelKind,
		Preset:         opts.Preset,
		CustomSettings: opts.HwAccelCustomSettings,
	}, opts.FfmpegPath, opts.Logger)

	c := &Cassette{
		sessions:   map[string]*Session{},
		clientChan: make(chan ClientInfo, 1024),
		governor:   NewGovernor(opts.MaxConcurrency, hwAccel.Name != "disabled", opts.Logger),
		logger:     opts.Logger,
		settings: Settings{
			StreamDir:   streamDir,
			HwAccel:     hwAccel,
			FfmpegPath:  opts.FfmpegPath,
			FfprobePath: opts.FfprobePath,
		},
	}
	c.tracker = NewClientTracker(c)

	c.logger.Info().
		Str("hwaccel", hwAccel.Name).
		Int("maxConcurrency", c.governor.maxSlot).
		Msg("cassette: initialised")

	return c, nil
}

// GetSettings returns the current settings.
func (c *Cassette) GetSettings() *Settings {
	return &c.settings
}

// GovernorStats returns the resource governor metrics.
func (c *Cassette) GovernorStats() GovernorStats {
	return c.governor.Stats()
}

// Destroy stops all sessions and clears the output directory.
func (c *Cassette) Destroy() {
	defer func() {
		if r := recover(); r != nil {
			c.logger.Warn().Interface("recover", r).Msg("cassette: recovered during destroy")
		}
	}()

	c.tracker.Stop()
	c.logger.Debug().Msg("cassette: destroying all sessions")

	c.sessionsMu.Lock()
	sessions := c.sessions
	c.sessions = map[string]*Session{}
	c.sessionsMu.Unlock()

	for _, s := range sessions {
		s.Destroy()
	}

	// clear keyframe cache
	ClearKeyframeCache()

	c.logger.Debug().Msg("cassette: destroyed")
}

// session management

func (c *Cassette) getSession(
	filePath, hash string,
	mediaInfo *videofile.MediaInfo,
) (*Session, error) {
	c.sessionsMu.Lock()
	s, ok := c.sessions[filePath]
	if !ok {
		s = NewSession(filePath, hash, mediaInfo, &c.settings, c.governor, c.logger)
		c.sessions[filePath] = s
	}
	c.sessionsMu.Unlock()

	if err := s.WaitReady(); err != nil {
		// A session that could not read its keyframes is dropped, so the next
		// request starts over instead of failing the same way forever.
		c.sessionsMu.Lock()
		if c.sessions[filePath] == s {
			delete(c.sessions, filePath)
		}
		c.sessionsMu.Unlock()

		return nil, err
	}

	return s, nil
}

// getSessionByPath returns the session for a path, or nil.
func (c *Cassette) getSessionByPath(filePath string) *Session {
	c.sessionsMu.Lock()
	defer c.sessionsMu.Unlock()

	return c.sessions[filePath]
}

// destroySession removes and destroys a session.
func (c *Cassette) destroySession(filePath string) {
	c.sessionsMu.Lock()
	s, ok := c.sessions[filePath]
	delete(c.sessions, filePath)
	c.sessionsMu.Unlock()

	if ok {
		s.Destroy()
	}
}

// Stop ends the transcode of one file: its encoders stop and its segments go.
func (c *Cassette) Stop(filePath string) {
	c.destroySession(filePath)
}

// public api

func (c *Cassette) sendClientInfo(info ClientInfo) {
	select {
	case c.clientChan <- info:
	default:
		// channel full, drop update
		c.logger.Warn().Msg("cassette: client channel full, dropping update")
	}
}

// GetMaster returns the hls master playlist
func (c *Cassette) GetMaster(
	filePath, hash string,
	mediaInfo *videofile.MediaInfo,
	client string,
	token string,
) (string, error) {
	start := time.Now()
	s, err := c.getSession(filePath, hash, mediaInfo)
	if err != nil {
		return "", err
	}
	c.sendClientInfo(ClientInfo{
		Client: client, Path: filePath,
		Quality: nil, Audio: -1, Head: -1,
	})
	c.logger.Trace().Dur("elapsed", time.Since(start)).Msg("cassette: GetMaster")
	return s.GetMaster(token), nil
}

// GetVideoIndex returns the hls variant playlist for video quality.
// fetching a variant is just a probe.
func (c *Cassette) GetVideoIndex(
	filePath, hash string,
	mediaInfo *videofile.MediaInfo,
	quality Quality,
	token string,
) (string, error) {
	s, err := c.getSession(filePath, hash, mediaInfo)
	if err != nil {
		return "", err
	}
	return s.GetVideoIndex(quality, token)
}

// GetAudioIndex returns the hls variant playlist for an audio track.
func (c *Cassette) GetAudioIndex(
	filePath, hash string,
	mediaInfo *videofile.MediaInfo,
	audio int32,
	token string,
) (string, error) {
	s, err := c.getSession(filePath, hash, mediaInfo)
	if err != nil {
		return "", err
	}
	return s.GetAudioIndex(audio, token)
}

// GetVideoSegment returns the path to a transcoded video segment file.
func (c *Cassette) GetVideoSegment(
	ctx context.Context,
	filePath, hash string,
	mediaInfo *videofile.MediaInfo,
	quality Quality,
	segment int32,
	client string,
) (string, error) {
	s, err := c.getSession(filePath, hash, mediaInfo)
	if err != nil {
		return "", err
	}
	c.sendClientInfo(ClientInfo{
		Client: client, Path: filePath,
		Quality: &quality, Audio: -1, Head: segment,
	})
	return s.GetVideoSegment(ctx, quality, segment)
}

// GetAudioSegment returns the path to a transcoded audio segment file.
func (c *Cassette) GetAudioSegment(
	ctx context.Context,
	filePath, hash string,
	mediaInfo *videofile.MediaInfo,
	audio, segment int32,
	client string,
) (string, error) {
	s, err := c.getSession(filePath, hash, mediaInfo)
	if err != nil {
		return "", err
	}
	c.sendClientInfo(ClientInfo{
		Client: client, Path: filePath,
		Quality: nil, Audio: audio, Head: segment,
	})
	return s.GetAudioSegment(ctx, audio, segment)
}
