package videofile

import (
	"os/exec"
	"syscall"
)

// HideWindow keeps ffmpeg and ffprobe from opening a console: the node runs
// without one, so each child would otherwise get a window over the player.
func HideWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
}
