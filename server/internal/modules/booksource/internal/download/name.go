// Package download keeps books on disk as ordinary files in a library folder,
// where the scanner, the matcher and the reader already know what to do with
// them.
package download

import (
	"strconv"
	"strings"
	"unicode"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/filename"
)

const maxNameRunes = 120

// FileName is what a book is saved as: "Mary Shelley - Frankenstein.epub", or
// the title alone when the source names no author. copyNumber above 1 tells it
// apart from a file of the same name already in the folder: "… (2).epub".
func FileName(author, title, ext string, copyNumber int) string {
	name := clean(title)
	if name == "" {
		name = "Book"
	}
	if who := clean(author); who != "" {
		name = who + " - " + name
	}

	suffix := ext
	if copyNumber > 1 {
		suffix = " (" + strconv.Itoa(copyNumber) + ")" + ext
	}

	return filename.Truncate(name, maxNameRunes-len([]rune(suffix))) + suffix
}

// clean makes a name safe as a path segment on every system the node runs on:
// no separators, nothing Windows refuses, no dots or spaces at the ends.
func clean(name string) string {
	var b strings.Builder

	for _, r := range name {
		switch {
		case r < 0x20 || r == 0x7f || !unicode.IsPrint(r) && !unicode.IsSpace(r):
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

	return out
}
