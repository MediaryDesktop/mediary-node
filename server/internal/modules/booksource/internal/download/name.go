// Package download keeps books on disk as ordinary files in a library folder,
// where the scanner, the matcher and the reader already know what to do with
// them.
package download

import (
	"strconv"
	"strings"
	"unicode"
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

	return truncate(name, maxNameRunes-len([]rune(suffix))) + suffix
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

	if reserved(out) {
		out = "_" + out
	}

	return out
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
