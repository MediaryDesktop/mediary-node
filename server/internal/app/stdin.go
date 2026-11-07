package app

import (
	"io"
)

// stopWhenClosed reads input until it ends and then calls stop. The desktop
// shell holds the node's stdin open for as long as it wants the node to run,
// and closes it to ask for a clean shutdown — the one request that reaches a
// child on Windows, where there are no signals. Whatever is read is discarded:
// the shell never writes, only closes.
func stopWhenClosed(input io.Reader, stop func()) {
	_, _ = io.Copy(io.Discard, input)

	stop()
}
