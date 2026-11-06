// Package childenv is the environment the node hands the programs it starts —
// mpv, FFmpeg, ffprobe. They get the user's environment, PATH and the rest,
// but none of the node's own NODE_* variables: those carry the local token, the
// cloud device token, API keys and the torrent client's password, and mpv runs
// whatever scripts the user installed.
package childenv

import (
	"os"
	"os/exec"
	"strings"
)

const prefix = "NODE_"

// Apply sets cmd to start with the node's environment minus its own variables.
// An Env already set on cmd is filtered the same way and otherwise kept.
func Apply(cmd *exec.Cmd) {
	if cmd.Env == nil {
		cmd.Env = Filter(os.Environ())
		return
	}

	cmd.Env = Filter(cmd.Env)
}

// Filter drops the NODE_* entries from an environment in os.Environ's form.
// Windows treats variable names without regard to case, so the check does too.
func Filter(environ []string) []string {
	out := make([]string, 0, len(environ))

	for _, entry := range environ {
		if len(entry) >= len(prefix) && strings.EqualFold(entry[:len(prefix)], prefix) {
			continue
		}

		out = append(out, entry)
	}

	return out
}
