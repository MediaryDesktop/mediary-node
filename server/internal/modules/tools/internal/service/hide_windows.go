package service

import (
	"os/exec"
	"syscall"
)

// hideWindow keeps the version check from flashing a console: the node runs
// without one.
func hideWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
}
