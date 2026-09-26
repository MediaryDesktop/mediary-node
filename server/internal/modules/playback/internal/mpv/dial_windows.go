//go:build windows

package mpv

import (
	"context"
	"fmt"
	"net"
	"os"
	"strconv"

	"github.com/Microsoft/go-winio"
)

// SocketPath is a named pipe on Windows, not a file: --input-ipc-server takes
// either, but only a pipe exists on this platform. The process id keeps two nodes
// on one machine out of each other's pipe.
func SocketPath(string) string {
	return `\\.\pipe\mediary-mpv-` + strconv.Itoa(os.Getpid())
}

func dial(ctx context.Context, socket string) (net.Conn, error) {
	conn, err := winio.DialPipeContext(ctx, socket)
	if err != nil {
		return nil, fmt.Errorf("connect to mpv at %s: %w", socket, err)
	}

	return conn, nil
}
