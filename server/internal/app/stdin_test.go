package app

import (
	"io"
	"testing"
	"time"
)

// The node runs for as long as the shell holds its stdin open, and stops once
// the shell lets go of it.
func TestTheNodeStopsWhenTheShellClosesItsInput(t *testing.T) {
	reader, writer := io.Pipe()
	stopped := make(chan struct{})

	go stopWhenClosed(reader, func() { close(stopped) })

	// Anything the shell might write changes nothing.
	if _, err := writer.Write([]byte("ignored\n")); err != nil {
		t.Fatal(err)
	}

	select {
	case <-stopped:
		t.Fatal("stopped while the input was still open")
	case <-time.After(50 * time.Millisecond):
	}

	_ = writer.Close()

	select {
	case <-stopped:
	case <-time.After(5 * time.Second):
		t.Fatal("did not stop after the input closed")
	}
}
