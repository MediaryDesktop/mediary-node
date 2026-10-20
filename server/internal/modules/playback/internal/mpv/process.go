package mpv

import (
	"context"
	"fmt"
	"os/exec"
	"time"
)

// How long the node waits for mpv to create its socket. mpv opens the window first
// and the socket a moment later, so the first dial almost always fails.
const (
	connectTimeout = 10 * time.Second
	connectRetry   = 100 * time.Millisecond
)

type LaunchOptions struct {
	Binary string
	Socket string
	File   string

	// StartAt resumes where the user left off, in seconds.
	StartAt float64
}

// Launch starts mpv on a file with its IPC socket open. The file is passed as an
// argument rather than loaded over IPC afterwards: the window then shows the video
// immediately, and if the node fails to connect the user is still watching —
// losing progress tracking is better than losing playback.
func Launch(options LaunchOptions) (*exec.Cmd, error) {
	args := []string{
		"--input-ipc-server=" + options.Socket,

		// Without this mpv exits as soon as the file ends, before the node has read
		// the end-of-file event.
		"--keep-open=yes",
	}

	if options.StartAt > 0 {
		args = append(args, fmt.Sprintf("--start=%.0f", options.StartAt))
	}

	args = append(args, "--", options.File)

	// Deliberately not CommandContext: the player has to outlive the request that
	// started it — an episode runs for twenty minutes — and it is stopped explicitly
	// when the session ends.
	command := exec.Command(options.Binary, args...) //nolint:gosec,noctx // see above; the binary is the user's own player

	if err := command.Start(); err != nil {
		return nil, fmt.Errorf("start mpv: %w", err)
	}

	return command, nil
}

// Connect dials the socket mpv was told to open, retrying until it exists.
func Connect(ctx context.Context, socket string) (*Client, error) {
	deadline, cancel := context.WithTimeout(ctx, connectTimeout)
	defer cancel()

	for {
		conn, err := dial(deadline, socket)
		if err == nil {
			return New(conn), nil
		}

		select {
		case <-deadline.Done():
			return nil, fmt.Errorf("mpv did not open its control socket in time: %w", err)
		case <-time.After(connectRetry):
		}
	}
}
