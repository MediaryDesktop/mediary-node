//go:build !windows

package videofile

import "os/exec"

func HideWindow(*exec.Cmd) {}
