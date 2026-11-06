package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"

	"github.com/rs/zerolog"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/playback/internal/mpv"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

// Tools finds the programs playback runs: mpv, ffmpeg and ffprobe. It is asked
// on every use, so one installed while the node runs is used at once. When a
// program is nowhere its error wraps exec.ErrNotFound and says what to do.
type Tools interface {
	Path(program string) (string, error)
}

// MPVLauncher opens mpv on a file and connects to its control socket.
type MPVLauncher struct {
	Tools Tools

	// Socket is where mpv is told to open its IPC endpoint.
	Socket string

	Logger zerolog.Logger
}

func (l MPVLauncher) Start(ctx context.Context, path string, startAt float64) (Player, error) {
	binary, err := l.Tools.Path("mpv")
	if err != nil {
		// The reason is the whole value of this error — the user has to install mpv
		// or point the node at it — so it is the message, not a cause buried under a
		// tidier sentence the client would show instead.
		return nil, apperr.Wrap(err, apperr.KindPrecondition, "%v", err)
	}

	command, err := mpv.Launch(mpv.LaunchOptions{
		Binary:  binary,
		Socket:  l.Socket,
		File:    path,
		StartAt: startAt,
	})
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "could not start the player: %v", err)
	}

	client, err := mpv.Connect(ctx, l.Socket)
	if err != nil {
		// The window is already open and playing, so the file is not the problem —
		// only the node's view of it is. Killing the player over that would be
		// worse than losing the position.
		l.Logger.Warn().Err(err).Msg("playing without control of the player")

		return &process{command: command, logger: l.Logger}, nil
	}

	return &process{command: command, client: client, logger: l.Logger}, nil
}

// process is one mpv window: the client that steers it and the child that has to be
// reaped when it ends.
type process struct {
	command *exec.Cmd
	client  *mpv.Client
	logger  zerolog.Logger
}

func (p *process) Command(ctx context.Context, args ...any) (json.RawMessage, error) {
	if p.client == nil {
		return nil, mpv.ErrClosed
	}

	return p.client.Command(ctx, args...)
}

func (p *process) Set(ctx context.Context, property string, value any) error {
	if p.client == nil {
		return mpv.ErrClosed
	}

	return p.client.Set(ctx, property, value)
}

func (p *process) Observe(ctx context.Context, id int, property string) error {
	if p.client == nil {
		return mpv.ErrClosed
	}

	return p.client.Observe(ctx, id, property)
}

func (p *process) Events() <-chan mpv.Event {
	if p.client == nil {
		return nil
	}

	return p.client.Events()
}

func (p *process) Closed() <-chan struct{} {
	if p.client == nil {
		return p.waitForExit()
	}

	return p.client.Closed()
}

func (p *process) Close() error {
	if p.client != nil {
		if err := p.client.Close(); err != nil {
			p.logger.Debug().Err(err).Msg("close mpv connection")
		}
	}

	if p.command.Process == nil {
		return nil
	}

	if err := p.command.Process.Kill(); err != nil && !errors.Is(err, os.ErrProcessDone) {
		return fmt.Errorf("stop mpv: %w", err)
	}

	_ = p.command.Wait()

	return nil
}

// waitForExit stands in for the connection's closed channel when the node never got
// one: the window closing is then the only signal that playback ended.
func (p *process) waitForExit() <-chan struct{} {
	done := make(chan struct{})

	go func() {
		_ = p.command.Wait()
		close(done)
	}()

	return done
}
