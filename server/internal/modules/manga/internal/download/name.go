// Package download keeps chapters on disk as ordinary CBZ files in a library
// folder, where the scanner, the matcher and the reader already know what to do
// with them.
package download

import (
	"path"
	"strings"
	"unicode"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/filename"
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

	return path.Join(folder, filename.Truncate(name, maxNameRunes)+".cbz")
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

	if filename.Reserved(out) {
		out = "_" + out
	}

	return filename.Truncate(out, maxNameRunes)
}
