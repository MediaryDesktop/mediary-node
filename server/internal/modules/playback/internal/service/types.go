package service

import (
	"context"
	"encoding/json"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/modules/playback/internal/mpv"
)

// PlayableFile is what the module needs to know about a file to play it. Which
// files exist is the library's business, so this arrives through a port rather
// than from a table this module reads.
type PlayableFile struct {
	ID    int64
	Path  string
	Title string

	// MediaRef and Episode are present only for a matched file. Without them the
	// file still plays; there is simply nothing to mark watched.
	MediaRef string
	Episode  *int

	// Duration is how long the library's scan found the file to run. Nil when
	// the scan could not read it.
	Duration *time.Duration

	Missing bool
}

// Library answers "what is this file". Implemented over the library module by the
// composition root.
type Library interface {
	Playable(ctx context.Context, fileID int64) (*PlayableFile, error)
}

// Progress records that an episode was watched. Implemented over the tracker,
// which owns the rule that progress is never silently lowered.
type Progress interface {
	MarkWatched(ctx context.Context, mediaRef string, episode int) error
}

// Player is a running player the node can steer. mpv satisfies it; tests use a
// fake, because a test that needs a video window is a test nobody runs.
type Player interface {
	Command(ctx context.Context, args ...any) (json.RawMessage, error)
	Set(ctx context.Context, property string, value any) error
	Observe(ctx context.Context, id int, property string) error
	Events() <-chan mpv.Event
	Closed() <-chan struct{}
	Close() error
}

// Launcher opens a player on a file. The real one starts mpv and connects to its
// socket; closing the player also ends the process.
type Launcher interface {
	Start(ctx context.Context, path string, startAt float64) (Player, error)
}

type PlaybackSession struct {
	FileID int64  `json:"file_id" doc:"Library file being played."`
	Path   string `json:"path" doc:"Absolute path mpv was given."`
	Title  string `json:"title" doc:"Title as the library reads it, for the UI."`

	MediaRef string `json:"media_ref,omitempty" doc:"Title this file is matched to. Absent while unmatched."`
	Episode  *int   `json:"episode,omitempty" doc:"Episode number within that title."`

	Position float64 `json:"position" doc:"Where the player is, in seconds."`
	Duration float64 `json:"duration" doc:"Length of the file, in seconds. Zero until the player reports it."`
	Paused   bool    `json:"paused" doc:"True while the player is paused."`

	Watched bool `json:"watched" doc:"True once this session counted as watched and the tracker was told."`

	StartedAt time.Time `json:"started_at" doc:"When playback started."`
}

type PlaybackStatus struct {
	Playing bool             `json:"playing" doc:"True while a player is open."`
	Session *PlaybackSession `json:"session,omitempty" doc:"The open session. Absent when nothing is playing."`
}

// Action is what the UI can ask of an open player. Anything richer belongs in mpv's
// own window, which the user already has in front of them.
type Action string

const (
	ActionPause  Action = "pause"
	ActionResume Action = "resume"
	ActionSeek   Action = "seek"
)
