// Package filename holds what every name the node writes to disk must respect,
// on every system the node runs on. Each module still decides how its own
// names read; this is only the part they all share.
package filename

import "strings"

// Reserved reports whether Windows keeps the name for a device — CON, NUL,
// COM1 and the rest, with any extension. Windows refuses to create a file or a
// folder by that name, so a title called "Con" needs it changed.
func Reserved(name string) bool {
	upper := strings.ToUpper(strings.SplitN(name, ".", 2)[0])

	switch upper {
	case "CON", "PRN", "AUX", "NUL",
		"COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
		"LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9":
		return true
	}

	return false
}

// Truncate cuts s to at most the given number of runes, and drops the dots and
// spaces the cut leaves at the end: Windows drops them itself, and the node
// would then look for a name that does not exist.
func Truncate(s string, runes int) string {
	r := []rune(s)
	if len(r) <= runes {
		return s
	}

	return strings.TrimRight(string(r[:runes]), ". ")
}
