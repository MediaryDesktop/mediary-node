package service

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func writeBytes(t *testing.T, dir, name string, data []byte) string {
	t.Helper()

	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}

	return path
}

func keyOf(t *testing.T, path string) string {
	t.Helper()

	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}

	key, err := computeContentKey(path, info.Size())
	if err != nil {
		t.Fatal(err)
	}

	return key
}

func TestContentKeyIgnoresWhereTheFileIs(t *testing.T) {
	data := bytes.Repeat([]byte("episode"), 600_000) // about 4 MiB: both ends are read

	first := writeBytes(t, t.TempDir(), "[Group] Show - 01.mkv", data)
	second := writeBytes(t, t.TempDir(), "show.s01e01.mkv", data)

	if keyOf(t, first) != keyOf(t, second) {
		t.Fatal("the same bytes under another name and folder got another key")
	}
}

func TestContentKeySeesAChangeAtEitherEnd(t *testing.T) {
	dir := t.TempDir()
	data := bytes.Repeat([]byte{7}, 3*contentChunk)

	base := keyOf(t, writeBytes(t, dir, "base", data))

	head := bytes.Clone(data)
	head[10] = 8

	tail := bytes.Clone(data)
	tail[len(tail)-10] = 8

	if keyOf(t, writeBytes(t, dir, "head", head)) == base {
		t.Error("a change near the start kept the key")
	}
	if keyOf(t, writeBytes(t, dir, "tail", tail)) == base {
		t.Error("a change near the end kept the key")
	}
}

func TestContentKeyOfSmallFiles(t *testing.T) {
	dir := t.TempDir()

	small := keyOf(t, writeBytes(t, dir, "small", []byte("one page")))
	other := keyOf(t, writeBytes(t, dir, "other", []byte("two page")))
	empty := keyOf(t, writeBytes(t, dir, "empty", nil))

	if small == other {
		t.Error("two small files with different bytes got one key")
	}
	if empty == "" {
		t.Error("an empty file got no key")
	}

	// A file just over one chunk: its tail overlaps nothing it already read.
	justOver := bytes.Repeat([]byte{1}, contentChunk+5)
	if keyOf(t, writeBytes(t, dir, "over", justOver)) == "" {
		t.Error("a file just over a chunk got no key")
	}
}
