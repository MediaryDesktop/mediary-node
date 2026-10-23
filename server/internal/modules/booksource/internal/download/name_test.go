package download

import (
	"strings"
	"testing"
	"unicode/utf8"
)

func TestFileName(t *testing.T) {
	for _, tc := range []struct {
		author, title, ext string
		copyNumber         int
		want               string
	}{
		{"Mary Shelley", "Frankenstein", ".epub", 1, "Mary Shelley - Frankenstein.epub"},
		{"Mary Shelley", "Frankenstein", ".epub", 2, "Mary Shelley - Frankenstein (2).epub"},
		{"", "Beowulf", ".pdf", 1, "Beowulf.pdf"},
		{"Lewis Carroll", "Alice's Adventures: In Wonderland?", ".epub", 1, "Lewis Carroll - Alice's Adventures In Wonderland.epub"},
		{"A/B", "C\\D", ".fb2", 1, "A B - C D.fb2"},
		{"", "", ".epub", 1, "Book.epub"},
		{"", "CON", ".epub", 1, "_CON.epub"},
		{"  Jane   Austen ", "Emma...", ".mobi", 1, "Jane Austen - Emma.mobi"},
	} {
		if got := FileName(tc.author, tc.title, tc.ext, tc.copyNumber); got != tc.want {
			t.Errorf("FileName(%q, %q, %q, %d) = %q, want %q", tc.author, tc.title, tc.ext, tc.copyNumber, got, tc.want)
		}
	}
}

// A long title is cut, and the extension and copy number survive the cut.
func TestFileNameKeepsTheExtensionOfALongTitle(t *testing.T) {
	name := FileName("Author", strings.Repeat("Ш", 300), ".epub", 3)

	if utf8.RuneCountInString(name) > maxNameRunes || !strings.HasSuffix(name, " (3).epub") {
		t.Errorf("name = %q (%d runes)", name, utf8.RuneCountInString(name))
	}
}
