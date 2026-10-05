// Package download keeps chapters on disk as ordinary CBZ files in a library
// folder, where the scanner, the matcher and the reader already know what to do
// with them.
package download

import (
	"path"
	"strings"
	"unicode"
)

const maxNameRunes = 120

// RelPath is where a chapter goes inside the library folder: a folder per series
// and a file per chapter. Chapter numbers are padded, so a file manager and any
// other comic reader sort "Ch. 009" before "Ch. 010".
func RelPath(series, number, title string) string {
	folder := clean(series)
	if folder == "" {
		folder = "Manga"
	}

	var name string
	if padded := padNumber(number); padded != "" {
		name = folder + " - Ch. " + padded
	} else if chapter := clean(title); chapter != "" && chapter != folder {
		name = folder + " - " + chapter
	} else {
		name = folder + " - Extra"
	}

	return path.Join(folder, truncate(name, maxNameRunes)+".cbz")
}

func padNumber(number string) string {
	number = strings.TrimSpace(number)
	if number == "" {
		return ""
	}

	whole, fraction, dotted := strings.Cut(number, ".")
	for _, r := range whole + fraction {
		if !unicode.IsDigit(r) {
			return ""
		}
	}
	if whole == "" {
		return ""
	}

	for len(whole) < 3 {
		whole = "0" + whole
	}
	if dotted && fraction != "" {
		return whole + "." + fraction
	}

	return whole
}

// clean makes a name safe as a path segment on every system the node runs on:
// no separators, nothing Windows refuses, no dots or spaces at the ends.
func clean(name string) string {
	var b strings.Builder

	for _, r := range name {
		switch {
		case r < 0x20 || r == 0x7f:
			continue
		case strings.ContainsRune(`<>:"/\|?*`, r):
			b.WriteRune(' ')
		default:
			b.WriteRune(r)
		}
	}

	out := strings.Join(strings.Fields(b.String()), " ")
	out = strings.Trim(out, ". ")

	if reserved(out) {
		out = "_" + out
	}

	return truncate(out, maxNameRunes)
}

func reserved(name string) bool {
	upper := strings.ToUpper(strings.SplitN(name, ".", 2)[0])

	switch upper {
	case "CON", "PRN", "AUX", "NUL",
		"COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
		"LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9":
		return true
	}

	return false
}

func truncate(s string, runes int) string {
	r := []rune(s)
	if len(r) <= runes {
		return s
	}

	return strings.TrimRight(string(r[:runes]), ". ")
}
