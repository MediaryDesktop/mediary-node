package service

import (
	"context"
	"path/filepath"
	"testing"
	"time"
)

// stuckTitles hangs every lookup until its context ends, as a source that
// never answers would.
type stuckTitles struct {
	entered chan struct{}
	ended   chan struct{}
}

func (s *stuckTitles) Tracked(ctx context.Context, _ string) ([]TitleCandidate, error) {
	select {
	case s.entered <- struct{}{}:
	default:
	}

	<-ctx.Done()

	select {
	case s.ended <- struct{}{}:
	default:
	}

	return nil, ctx.Err()
}

func (s *stuckTitles) Search(ctx context.Context, _, _ string) ([]TitleCandidate, error) {
	<-ctx.Done()
	return nil, ctx.Err()
}

func (s *stuckTitles) Describe(context.Context, []string) ([]TitleDescription, error) {
	return nil, nil
}

// Stopping the node stops a scan in progress and waits for it: the scan must
// not go on writing once the database behind it is closed.
func TestCloseStopsARunningScanAndWaitsForIt(t *testing.T) {
	h := newHarness(t)
	stuck := &stuckTitles{entered: make(chan struct{}, 1), ended: make(chan struct{}, 1)}
	h.svc.opts.Titles = stuck

	root := t.TempDir()
	writeFile(t, filepath.Join(root, "Sousou no Frieren", "[SubsPlease] Sousou no Frieren - 01 (1080p).mkv"), "one")
	h.addRoot(t, root)

	if _, err := h.svc.StartScan(context.Background(), 0); err != nil {
		t.Fatalf("start scan: %v", err)
	}

	select {
	case <-stuck.entered:
	case <-time.After(10 * time.Second):
		t.Fatal("the scan never reached matching")
	}

	closed := make(chan struct{})
	go func() {
		h.svc.Close()
		close(closed)
	}()

	select {
	case <-closed:
	case <-time.After(10 * time.Second):
		t.Fatal("Close did not return: the scan was not stopped")
	}

	select {
	case <-stuck.ended:
	default:
		t.Error("Close returned before the scan's lookup was cancelled")
	}
}
