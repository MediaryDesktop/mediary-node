package service

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/playback/internal/mpv"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

type fakePlayer struct {
	events chan mpv.Event
	closed chan struct{}

	mu       sync.Mutex
	commands [][]any
	set      map[string]any
	once     sync.Once
}

func newFakePlayer() *fakePlayer {
	return &fakePlayer{
		events: make(chan mpv.Event, 16),
		closed: make(chan struct{}),
		set:    map[string]any{},
	}
}

func (f *fakePlayer) Command(_ context.Context, args ...any) (json.RawMessage, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.commands = append(f.commands, args)

	return nil, nil
}

func (f *fakePlayer) Set(_ context.Context, property string, value any) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.set[property] = value

	return nil
}

func (f *fakePlayer) Observe(context.Context, int, string) error { return nil }

func (f *fakePlayer) Events() <-chan mpv.Event { return f.events }

func (f *fakePlayer) Closed() <-chan struct{} { return f.closed }

func (f *fakePlayer) Close() error {
	f.once.Do(func() { close(f.closed) })

	return nil
}

func (f *fakePlayer) property(name string, value any) {
	encoded, _ := json.Marshal(value)

	f.events <- mpv.Event{Name: "property-change", Property: name, Data: encoded}
}

func (f *fakePlayer) end(reason string) {
	f.events <- mpv.Event{Name: "end-file", Reason: reason}
}

func (f *fakePlayer) wasSet(property string) (any, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()

	value, ok := f.set[property]

	return value, ok
}

type fakeLauncher struct {
	mu      sync.Mutex
	players []*fakePlayer
	paths   []string
	err     error
}

func (l *fakeLauncher) Start(_ context.Context, path string, _ float64) (Player, error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	l.paths = append(l.paths, path)

	if l.err != nil {
		return nil, l.err
	}

	player := newFakePlayer()
	l.players = append(l.players, player)

	return player, nil
}

func (l *fakeLauncher) last() *fakePlayer {
	l.mu.Lock()
	defer l.mu.Unlock()

	if len(l.players) == 0 {
		return nil
	}

	return l.players[len(l.players)-1]
}

type fakeLibrary struct {
	file *PlayableFile
	err  error
}

func (f fakeLibrary) Playable(context.Context, int64) (*PlayableFile, error) {
	return f.file, f.err
}

type fakeProgress struct {
	mu      sync.Mutex
	marked  []string
	episode int
	err     error
}

func (f *fakeProgress) MarkWatched(_ context.Context, mediaRef string, episode int) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	if f.err != nil {
		return f.err
	}

	f.marked = append(f.marked, mediaRef)
	f.episode = episode

	return nil
}

func (f *fakeProgress) calls() int {
	f.mu.Lock()
	defer f.mu.Unlock()

	return len(f.marked)
}

type harness struct {
	svc      *Service
	launcher *fakeLauncher
	progress *fakeProgress
	stream   <-chan events.Event
}

func episodeOf(number int) *int { return &number }

func newHarness(t *testing.T, file *PlayableFile) *harness {
	t.Helper()

	hub := events.NewHub(64)
	stream, unsubscribe := hub.Subscribe(events.TopicPlayback)
	t.Cleanup(unsubscribe)

	launcher := &fakeLauncher{}
	progress := &fakeProgress{}

	svc := New(zerolog.Nop(), hub, Options{
		Launcher: launcher,
		Library:  fakeLibrary{file: file},
		Progress: progress,
	})

	return &harness{svc: svc, launcher: launcher, progress: progress, stream: stream}
}

// waitFor blocks until the node publishes the state the test is about, so the
// assertions never race the pump goroutine.
func (h *harness) waitFor(t *testing.T, state string) events.Event {
	t.Helper()

	deadline := time.After(3 * time.Second)

	for {
		select {
		case event := <-h.stream:
			if event.Payload["state"] == state {
				return event
			}
		case <-deadline:
			t.Fatalf("the node never published %q", state)

			return events.Event{}
		}
	}
}

var episodeFile = &PlayableFile{
	ID:       7,
	Path:     "D:\\Anime\\Frieren\\ep 01.mkv",
	Title:    "Sousou no Frieren",
	MediaRef: "anilist:154587",
	Episode:  episodeOf(1),
}

func TestStartOpensThePlayerOnTheScannedFile(t *testing.T) {
	h := newHarness(t, episodeFile)

	status, err := h.svc.Start(context.Background(), episodeFile.ID)
	if err != nil {
		t.Fatalf("start: %v", err)
	}

	if !status.Playing || status.Session == nil {
		t.Fatalf("status = %+v, want a playing session", status)
	}
	if status.Session.Title != episodeFile.Title || status.Session.FileID != episodeFile.ID {
		t.Errorf("session = %+v, want the library's own file", status.Session)
	}

	h.waitFor(t, "started")
}

func TestStartRefusesAFileTheScanNoLongerFinds(t *testing.T) {
	missing := *episodeFile
	missing.Missing = true

	h := newHarness(t, &missing)

	_, err := h.svc.Start(context.Background(), missing.ID)
	if apperr.KindOf(err) != apperr.KindPrecondition {
		t.Errorf("start on a missing file returned %v, want a precondition failure", err)
	}

	if h.launcher.last() != nil {
		t.Error("the player was opened on a file that is not there")
	}
}

func TestStartRefusesAnUnknownFile(t *testing.T) {
	h := newHarness(t, nil)

	_, err := h.svc.Start(context.Background(), 404)
	if apperr.KindOf(err) != apperr.KindNotFound {
		t.Errorf("start on an unknown file returned %v, want not found", err)
	}
}

func TestWatchingMostOfTheEpisodeMarksItOnce(t *testing.T) {
	h := newHarness(t, episodeFile)

	if _, err := h.svc.Start(context.Background(), episodeFile.ID); err != nil {
		t.Fatalf("start: %v", err)
	}

	player := h.launcher.last()
	player.property("duration", 1440.0)
	player.property("time-pos", 200.0)
	player.property("time-pos", 1300.0)

	h.waitFor(t, "watched")

	if h.progress.calls() != 1 {
		t.Fatalf("the tracker was told %d times, want once", h.progress.calls())
	}
	if h.progress.episode != 1 {
		t.Errorf("episode = %d, want the one the matcher recorded", h.progress.episode)
	}

	// Further position reports must not tell the tracker again.
	player.property("time-pos", 1400.0)
	player.property("time-pos", 1430.0)

	time.Sleep(50 * time.Millisecond)

	if h.progress.calls() != 1 {
		t.Errorf("the tracker was told %d times, want once for one session", h.progress.calls())
	}
}

func TestPlayingToTheEndMarksTheEpisodeEvenWithoutADuration(t *testing.T) {
	h := newHarness(t, episodeFile)

	if _, err := h.svc.Start(context.Background(), episodeFile.ID); err != nil {
		t.Fatalf("start: %v", err)
	}

	h.launcher.last().end("eof")

	h.waitFor(t, "watched")

	if h.progress.calls() != 1 {
		t.Errorf("the tracker was told %d times, want once", h.progress.calls())
	}
}

// Closing the window a few minutes in is not watching it.
func TestClosingThePlayerEarlyMarksNothing(t *testing.T) {
	h := newHarness(t, episodeFile)

	if _, err := h.svc.Start(context.Background(), episodeFile.ID); err != nil {
		t.Fatalf("start: %v", err)
	}

	player := h.launcher.last()
	player.property("duration", 1440.0)
	player.property("time-pos", 120.0)
	player.end("stop")

	h.waitFor(t, "ended")

	if h.progress.calls() != 0 {
		t.Errorf("the tracker was told about an episode nobody finished")
	}
	if h.svc.Status().Playing {
		t.Error("the session outlived the player")
	}
}

func TestAnUnmatchedFileHasNothingToMark(t *testing.T) {
	unmatched := &PlayableFile{ID: 9, Path: "D:\\Anime\\mystery.mkv", Title: "mystery.mkv"}

	h := newHarness(t, unmatched)

	if _, err := h.svc.Start(context.Background(), unmatched.ID); err != nil {
		t.Fatalf("start: %v", err)
	}

	h.launcher.last().end("eof")
	h.waitFor(t, "ended")

	if h.progress.calls() != 0 {
		t.Error("the tracker was told about a file that belongs to no title")
	}
}

// A failed write has to leave the session ready to try again rather than silently
// counting as done.
func TestAFailedMarkIsNotRememberedAsDone(t *testing.T) {
	h := newHarness(t, episodeFile)
	h.progress.err = errors.New("anilist is unreachable")

	if _, err := h.svc.Start(context.Background(), episodeFile.ID); err != nil {
		t.Fatalf("start: %v", err)
	}

	player := h.launcher.last()
	player.property("duration", 100.0)
	player.property("time-pos", 90.0)

	time.Sleep(50 * time.Millisecond)

	if status := h.svc.Status(); status.Session != nil && status.Session.Watched {
		t.Error("the session counted as watched although the tracker refused it")
	}
}

func TestStartingASecondFileClosesTheFirstPlayer(t *testing.T) {
	h := newHarness(t, episodeFile)

	if _, err := h.svc.Start(context.Background(), episodeFile.ID); err != nil {
		t.Fatalf("first start: %v", err)
	}
	first := h.launcher.last()

	if _, err := h.svc.Start(context.Background(), episodeFile.ID); err != nil {
		t.Fatalf("second start: %v", err)
	}

	select {
	case <-first.Closed():
	case <-time.After(2 * time.Second):
		t.Fatal("two players are open at once")
	}
}

func TestControlSteersTheOpenPlayer(t *testing.T) {
	h := newHarness(t, episodeFile)

	if _, err := h.svc.Start(context.Background(), episodeFile.ID); err != nil {
		t.Fatalf("start: %v", err)
	}

	if _, err := h.svc.Control(context.Background(), ActionPause, 0); err != nil {
		t.Fatalf("pause: %v", err)
	}

	paused, ok := h.launcher.last().wasSet("pause")
	if !ok || paused != true {
		t.Errorf("pause = %v, want the player paused", paused)
	}

	if _, err := h.svc.Control(context.Background(), "nonsense", 0); apperr.KindOf(err) != apperr.KindInvalid {
		t.Errorf("an unknown action returned %v, want invalid", err)
	}
}

func TestControlWithoutAPlayerSaysSo(t *testing.T) {
	h := newHarness(t, episodeFile)

	_, err := h.svc.Control(context.Background(), ActionPause, 0)
	if apperr.KindOf(err) != apperr.KindPrecondition {
		t.Errorf("control with nothing playing returned %v, want a precondition failure", err)
	}
}

func TestShouldMarkWatched(t *testing.T) {
	cases := []struct {
		name        string
		position    float64
		duration    float64
		playedToEnd bool
		want        bool
	}{
		{name: "played to the end", playedToEnd: true, want: true},
		{name: "past the threshold", position: 90, duration: 100, want: true},
		{name: "exactly at the threshold", position: 85, duration: 100, want: true},
		{name: "short of the threshold", position: 84, duration: 100, want: false},
		{name: "duration still unknown", position: 600, want: false},
	}

	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			if got := shouldMarkWatched(test.position, test.duration, test.playedToEnd); got != test.want {
				t.Errorf("shouldMarkWatched(%v, %v, %v) = %v, want %v",
					test.position, test.duration, test.playedToEnd, got, test.want)
			}
		})
	}
}
