//go:build !windows

package videofile

import "os/exec"

func hideWindow(*exec.Cmd) {}
