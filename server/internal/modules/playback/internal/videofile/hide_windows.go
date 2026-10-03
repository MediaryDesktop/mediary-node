package videofile

import (
	"os/exec"
	"syscall"
)

// The node runs without a console, so a child it starts would get a window of
// its own flashing over the player.
func hideWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
}
