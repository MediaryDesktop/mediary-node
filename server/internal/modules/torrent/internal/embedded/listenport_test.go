package embedded

import (
	"context"
	"os"
	"testing"

	"github.com/rs/zerolog"
)

func TestSavedListenPortRoundTrips(t *testing.T) {
	c := &Client{opts: Options{StateDir: t.TempDir(), Logger: zerolog.Nop()}}

	if got := c.savedListenPort(); got != 0 {
		t.Fatalf("savedListenPort() before saving = %d, want 0", got)
	}

	c.saveListenPort(51413)

	if got := c.savedListenPort(); got != 51413 {
		t.Fatalf("savedListenPort() = %d, want 51413", got)
	}
}

func TestSavedListenPortIgnoresNonsense(t *testing.T) {
	c := &Client{opts: Options{StateDir: t.TempDir(), Logger: zerolog.Nop()}}

	if err := os.WriteFile(c.listenPortPath(), []byte("not a port"), 0o600); err != nil {
		t.Fatal(err)
	}

	if got := c.savedListenPort(); got != 0 {
		t.Fatalf("savedListenPort() on garbage = %d, want 0", got)
	}
}

// TestListenPortIsRememberedAcrossRestarts covers why the port is kept at
// all: without it, a user who forwarded one on their router would have it
// stop working on the very next restart, picking a fresh random one.
func TestListenPortIsRememberedAcrossRestarts(t *testing.T) {
	stateDir := t.TempDir()

	first := New(Options{StateDir: stateDir, Logger: zerolog.Nop()})
	if _, err := first.Version(context.Background()); err != nil {
		t.Fatal(err)
	}
	firstPort := first.cl.LocalPort()
	first.Close()

	if firstPort <= 0 {
		t.Fatal("the client did not pick a listen port")
	}

	second := New(Options{StateDir: stateDir, Logger: zerolog.Nop()})
	t.Cleanup(second.Close)

	if _, err := second.Version(context.Background()); err != nil {
		t.Fatal(err)
	}

	if got := second.cl.LocalPort(); got != firstPort {
		t.Fatalf("second run's port = %d, want the remembered %d", got, firstPort)
	}
}

func TestListenPortExplicitlyGivenIsNeverOverwritten(t *testing.T) {
	stateDir := t.TempDir()

	c := New(Options{StateDir: stateDir, ListenPort: 51777, Logger: zerolog.Nop()})
	t.Cleanup(c.Close)

	if _, err := c.Version(context.Background()); err != nil {
		t.Fatal(err)
	}

	if got := c.cl.LocalPort(); got != 51777 {
		t.Fatalf("port = %d, want the one given, 51777", got)
	}
	if saved := c.savedListenPort(); saved != 0 {
		t.Fatalf("savedListenPort() = %d, want none kept for a port the config already gives", saved)
	}
}
