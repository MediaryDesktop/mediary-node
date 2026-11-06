package service

import (
	"context"
	"sync"
	"testing"
	"time"
)

// gatedTitles holds the first Describe until released: a write that reaches it
// has read the entry and not yet saved it, the window in which another write to
// the same title used to slip in and be lost.
type gatedTitles struct {
	inner *fakeTitles

	mu      sync.Mutex
	gated   bool
	entered chan struct{}
	release chan struct{}
}

func newGatedTitles(inner *fakeTitles) *gatedTitles {
	return &gatedTitles{inner: inner, entered: make(chan struct{}), release: make(chan struct{})}
}

func (g *gatedTitles) Describe(ctx context.Context, refs []string) map[string]LocalTitle {
	g.mu.Lock()
	first := !g.gated
	g.gated = true
	g.mu.Unlock()

	if first {
		close(g.entered)
		<-g.release
	}

	g.mu.Lock()
	defer g.mu.Unlock()

	return g.inner.Describe(ctx, refs)
}

func (g *gatedTitles) Lookup(ctx context.Context, ref string) (*LocalTitle, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	return g.inner.Lookup(ctx, ref)
}

// The user edits the notes while the player raises the progress of the same
// title: both changes survive.
func TestConcurrentWritesToOneEntryKeepBoth(t *testing.T) {
	h, titles := newLocalHarness(t)
	ctx := context.Background()

	if err := h.svc.MarkWatched(ctx, "tmdb:tv:7", 1); err != nil {
		t.Fatalf("watch 1: %v", err)
	}

	gate := newGatedTitles(titles)
	h.svc.opts.Titles = gate

	notes := "watching with friends"
	edited := make(chan error, 1)
	go func() {
		_, err := h.svc.UpdateEntry(ctx, "tmdb:tv:7", EntryPatch{Notes: &notes})
		edited <- err
	}()

	<-gate.entered

	watched := make(chan error, 1)
	go func() { watched <- h.svc.MarkWatched(ctx, "tmdb:tv:7", 5) }()

	// Long enough for the second write to finish if nothing holds it back.
	time.Sleep(100 * time.Millisecond)
	close(gate.release)

	if err := <-edited; err != nil {
		t.Fatalf("edit notes: %v", err)
	}
	if err := <-watched; err != nil {
		t.Fatalf("watch 5: %v", err)
	}

	collection, err := h.svc.Entries(ctx, MediaTypeDorama)
	if err != nil {
		t.Fatalf("entries: %v", err)
	}

	if len(collection.Entries) != 1 {
		t.Fatalf("entries %+v", collection.Entries)
	}
	entry := collection.Entries[0]
	if entry.Notes != notes || entry.Progress != 5 {
		t.Errorf("notes %q, progress %d: want %q and 5, both writes kept", entry.Notes, entry.Progress, notes)
	}
}

// Two raises at once never leave the lower one last. The lower one is held
// after reading the entry, so without the lock it would save after the higher.
func TestConcurrentRaisesNeverLowerProgress(t *testing.T) {
	h, titles := newLocalHarness(t)
	ctx := context.Background()

	if err := h.svc.MarkWatched(ctx, "tmdb:tv:7", 1); err != nil {
		t.Fatalf("watch 1: %v", err)
	}

	gate := newGatedTitles(titles)
	h.svc.opts.Titles = gate

	low := make(chan error, 1)
	go func() { low <- h.svc.MarkWatched(ctx, "tmdb:tv:7", 3) }()

	<-gate.entered

	high := make(chan error, 1)
	go func() { high <- h.svc.MarkWatched(ctx, "tmdb:tv:7", 4) }()

	time.Sleep(100 * time.Millisecond)
	close(gate.release)

	if err := <-high; err != nil {
		t.Fatalf("watch 4: %v", err)
	}
	if err := <-low; err != nil {
		t.Fatalf("watch 3: %v", err)
	}

	collection, err := h.svc.Entries(ctx, MediaTypeDorama)
	if err != nil {
		t.Fatalf("entries: %v", err)
	}

	if len(collection.Entries) != 1 || collection.Entries[0].Progress != 4 {
		t.Errorf("entries %+v, want progress 4", collection.Entries)
	}
}

func TestRefLocksForgetReleasedTitles(t *testing.T) {
	var locks refLocks

	unlock := locks.lock("tmdb:tv:7")
	other := locks.lock("tmdb:tv:1396")

	if got := len(locks.locks); got != 2 {
		t.Fatalf("held locks = %d, want 2", got)
	}

	unlock()
	other()

	if got := len(locks.locks); got != 0 {
		t.Errorf("locks left after release = %d, want 0", got)
	}
}
