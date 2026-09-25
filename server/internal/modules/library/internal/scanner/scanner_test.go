package scanner

import (
	"context"
	"os"
	"path/filepath"
	"slices"
	"testing"
)

func writeFile(t *testing.T, path, content string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("create dir for %s: %v", path, err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func relPaths(files []File) []string {
	paths := make([]string, 0, len(files))
	for _, file := range files {
		paths = append(paths, file.RelPath)
	}
	slices.Sort(paths)

	return paths
}

func TestWalkPicksMediaAndSkipsTheRest(t *testing.T) {
	root := t.TempDir()

	writeFile(t, filepath.Join(root, "Anime", "Show", "[Grp] Show - 01.mkv"), "video")
	writeFile(t, filepath.Join(root, "Anime", "Show", "Show - 02.mp4"), "video")
	writeFile(t, filepath.Join(root, "Manga", "Chapter 1.cbz"), "manga")
	writeFile(t, filepath.Join(root, "Books", "novel.epub"), "book")

	writeFile(t, filepath.Join(root, "Anime", "Show", "notes.txt"), "text")
	writeFile(t, filepath.Join(root, "Anime", "Show", "subs.ass"), "subs")
	writeFile(t, filepath.Join(root, "Anime", "Show", "Show - 03.mkv.part"), "partial")
	writeFile(t, filepath.Join(root, "Anime", "Show", "._Show - 01.mkv"), "sidecar")
	writeFile(t, filepath.Join(root, ".hidden", "hidden.mkv"), "video")
	writeFile(t, filepath.Join(root, "@eaDir", "thumb.mkv"), "video")

	// A zero-byte file is an interrupted copy, not something to offer the player.
	writeFile(t, filepath.Join(root, "Anime", "Show", "Show - 04.mkv"), "")

	files, err := Walk(context.Background(), root, Options{})
	if err != nil {
		t.Fatalf("walk: %v", err)
	}

	want := []string{
		"Anime/Show/Show - 02.mp4",
		"Anime/Show/[Grp] Show - 01.mkv",
		"Books/novel.epub",
		"Manga/Chapter 1.cbz",
	}
	slices.Sort(want)

	if got := relPaths(files); !slices.Equal(got, want) {
		t.Fatalf("walked files = %v, want %v", got, want)
	}

	kinds := make(map[string]Kind, len(files))
	for _, file := range files {
		kinds[file.RelPath] = file.Kind
	}

	for relPath, want := range map[string]Kind{
		"Anime/Show/[Grp] Show - 01.mkv": KindVideo,
		"Manga/Chapter 1.cbz":            KindManga,
		"Books/novel.epub":               KindBook,
	} {
		if kinds[relPath] != want {
			t.Errorf("kind of %s = %q, want %q", relPath, kinds[relPath], want)
		}
	}
}

func TestWalkReportsSizeAndProgress(t *testing.T) {
	root := t.TempDir()

	writeFile(t, filepath.Join(root, "a.mkv"), "12345")
	writeFile(t, filepath.Join(root, "b.mkv"), "1234567890")

	seen := 0

	files, err := Walk(context.Background(), root, Options{OnFile: func(count int) { seen = count }})
	if err != nil {
		t.Fatalf("walk: %v", err)
	}

	if seen != 2 {
		t.Errorf("progress reported %d files, want 2", seen)
	}

	sizes := map[string]int64{}
	for _, file := range files {
		sizes[file.RelPath] = file.Size
	}

	if sizes["a.mkv"] != 5 || sizes["b.mkv"] != 10 {
		t.Errorf("sizes = %v, want a.mkv=5 b.mkv=10", sizes)
	}
}

func TestWalkRefusesAMissingRoot(t *testing.T) {
	if _, err := Walk(context.Background(), filepath.Join(t.TempDir(), "gone"), Options{}); err == nil {
		t.Fatal("walking a missing root succeeded, want an error so the scan skips the root instead of emptying it")
	}
}

func TestWalkLeavesDirectorySymlinksAloneByDefault(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()

	writeFile(t, filepath.Join(outside, "linked.mkv"), "video")
	writeFile(t, filepath.Join(root, "own.mkv"), "video")

	if err := os.Symlink(outside, filepath.Join(root, "link")); err != nil {
		t.Skipf("symlinks unavailable on this machine: %v", err)
	}

	files, err := Walk(context.Background(), root, Options{})
	if err != nil {
		t.Fatalf("walk: %v", err)
	}

	if got := relPaths(files); !slices.Equal(got, []string{"own.mkv"}) {
		t.Fatalf("walked files = %v, want only own.mkv while symlinks are off", got)
	}

	followed, err := Walk(context.Background(), root, Options{FollowSymlinks: true})
	if err != nil {
		t.Fatalf("walk following symlinks: %v", err)
	}

	// The file is reported where the user sees it — under the link inside the
	// root — not where it physically lives.
	want := []string{"link/linked.mkv", "own.mkv"}
	if got := relPaths(followed); !slices.Equal(got, want) {
		t.Fatalf("walked files = %v, want %v", got, want)
	}
}

func TestWalkStopsOnCancel(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "a.mkv"), "video")

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if _, err := Walk(ctx, root, Options{}); err == nil {
		t.Fatal("walk on a cancelled context succeeded, want an error so no partial listing is applied")
	}
}
