//go:build !windows

package mpv

import (
	"context"
	"fmt"
	"net"
	"path/filepath"
)

// SocketPath is where mpv is told to put its IPC socket. On unix it is a file, so
// it lives in the node's own data directory.
func SocketPath(dataDir string) string {
	return filepath.Join(dataDir, "mpv.sock")
}

func dial(ctx context.Context, socket string) (net.Conn, error) {
	var dialer net.Dialer

	conn, err := dialer.DialContext(ctx, "unix", socket)
	if err != nil {
		return nil, fmt.Errorf("connect to mpv at %s: %w", socket, err)
	}

	return conn, nil
}
