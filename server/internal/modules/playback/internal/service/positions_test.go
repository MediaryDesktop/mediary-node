package service

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/events"
)

type savedPosition struct {
	fileID   int64
	position float64
	duration float64
	reached  bool
}

type fakePositions struct {
	mu     sync.Mutex
	resume float64
	saved  []savedPosition
}

func (f *fakePositions) SavePosition(_ context.Context, file *PlayableFile, position, duration float64, reached bool) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.saved = append(f.saved, savedPosition{file.ID, position, duration, reached})

	return nil
}

func (f *fakePositions) ResumeAt(context.Context, *PlayableFile) (float64, error) {
	return f.resume, nil
}

func (f *fakePositions) last() (savedPosition, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if len(f.saved) == 0 {
		return savedPosition{}, false
	}

	return f.saved[len(f.saved)-1], true
}

// recordingLauncher is a fakeLauncher that remembers where each player started.
type recordingLauncher struct {
	fakeLauncher

	mu     sync.Mutex
	starts []float64
}

func (l *recordingLauncher) Start(ctx context.Context, path string, startAt float64) (Player, error) {
	l.mu.Lock()
	l.starts = append(l.starts, startAt)
	l.mu.Unlock()

	return l.fakeLauncher.Start(ctx, path, startAt)
}

func newPositionHarness(t *testing.T, resume float64) (*harness, *recordingLauncher, *fakePositions) {
	t.Helper()

	hub := events.NewHub(64)
	stream, unsubscribe := hub.Subscribe(events.TopicPlayback)
	t.Cleanup(unsubscribe)

	launcher := &recordingLauncher{}
	positions := &fakePositions{resume: resume}

	svc := New(zerolog.Nop(), hub, Options{
		Launcher:  launcher,
		Library:   fakeLibrary{file: episodeFile},
		Progress:  &fakeProgress{},
		Positions: positions,
	})

	return &harness{svc: svc, launcher: &launcher.fakeLauncher, stream: stream}, launcher, positions
}

func TestMPVStartsWhereTheUserStopped(t *testing.T) {
	h, launcher, _ := newPositionHarness(t, 842)

	status, err := h.svc.Start(context.Background(), episodeFile.ID, false)
	if err != nil {
		t.Fatal(err)
	}

	if launcher.starts[0] != 842 || status.Session.Position != 842 {
		t.Fatalf("started at %v (session %v), want 842", launcher.starts[0], status.Session.Position)
	}

	if _, err := h.svc.Start(context.Background(), episodeFile.ID, true); err != nil {
		t.Fatal(err)
	}

	if launcher.starts[1] != 0 {
		t.Fatalf("asked for the beginning, started at %v", launcher.starts[1])
	}
}

func TestClosingThePlayerKeepsItsPosition(t *testing.T) {
	h, _, positions := newPositionHarness(t, 0)

	if _, err := h.svc.Start(context.Background(), episodeFile.ID, false); err != nil {
		t.Fatal(err)
	}

	player := h.launcher.last()
	player.property("duration", 1440.0)
	player.property("time-pos", 615.0)
	player.end("stop")

	h.waitFor(t, "ended")

	saved, ok := positions.last()
	if !ok || saved.position != 615 || saved.duration != 1440 || saved.reached {
		t.Fatalf("kept %+v, want 615 of 1440 not watched", saved)
	}
}

func TestPlayingToTheEndKeepsItAsWatched(t *testing.T) {
	h, _, positions := newPositionHarness(t, 0)

	if _, err := h.svc.Start(context.Background(), episodeFile.ID, false); err != nil {
		t.Fatal(err)
	}

	player := h.launcher.last()
	player.property("duration", 1440.0)
	player.property("time-pos", 1439.0)
	player.end("eof")

	h.waitFor(t, "ended")

	if saved, ok := positions.last(); !ok || !saved.reached {
		t.Fatalf("kept %+v, want it watched", saved)
	}
}

func TestTheBuiltInPlayerKeepsEveryReport(t *testing.T) {
	h, _, positions := newPositionHarness(t, 0)

	watched, err := h.svc.ReportProgress(context.Background(), episodeFile.ID, 300, 1440, false)
	if err != nil || watched {
		t.Fatalf("an early report: watched=%v, %v", watched, err)
	}

	if saved, ok := positions.last(); !ok || saved.position != 300 || saved.reached {
		t.Fatalf("kept %+v, want 300 not watched", saved)
	}

	if _, err := h.svc.ReportProgress(context.Background(), episodeFile.ID, 1300, 1440, false); err != nil {
		t.Fatal(err)
	}

	if saved, _ := positions.last(); !saved.reached {
		t.Fatalf("kept %+v, want it watched past the threshold", saved)
	}
}

// A pump still draining the first file's player must not write its position
// over the second file's session.
func TestAReplacedPlayerKeepsNothingOverTheNewSession(t *testing.T) {
	h, _, positions := newPositionHarness(t, 0)

	if _, err := h.svc.Start(context.Background(), episodeFile.ID, false); err != nil {
		t.Fatal(err)
	}

	first := h.launcher.last()

	if _, err := h.svc.Start(context.Background(), episodeFile.ID, false); err != nil {
		t.Fatal(err)
	}

	second := h.launcher.last()
	second.property("time-pos", 50.0)

	// The first player's late events arrive after it was replaced.
	first.property("time-pos", 999.0)
	time.Sleep(50 * time.Millisecond)

	second.end("stop")

	// The first player's end may be announced as well; wait for the second's save.
	for deadline := time.Now().Add(3 * time.Second); time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		if saved, ok := positions.last(); ok && saved.position == 50 {
			break
		}
	}

	positions.mu.Lock()
	defer positions.mu.Unlock()

	for _, saved := range positions.saved {
		if saved.position == 999 {
			t.Fatal("the replaced player's position was kept")
		}
	}

	if len(positions.saved) == 0 || positions.saved[len(positions.saved)-1].position != 50 {
		t.Fatalf("the second session kept %+v, want its own 50", positions.saved)
	}
}
