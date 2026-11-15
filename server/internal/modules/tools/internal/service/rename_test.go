package service

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

// A file held open inside the folder is what an antivirus or a program that
// has just exited does on Windows; the rename has to wait it out.
func TestRenameWaitsForAFolderThatIsBrieflyHeld(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("only Windows refuses to rename a folder with an open file in it")
	}

	dir := t.TempDir()
	from := filepath.Join(dir, "9.0.2.tmp")
	to := filepath.Join(dir, "9.0.2")

	if err := os.MkdirAll(from, 0o750); err != nil {
		t.Fatal(err)
	}

	held, err := os.Create(filepath.Join(from, "ffmpeg.exe"))
	if err != nil {
		t.Fatal(err)
	}

	if err := os.Rename(from, to); err == nil {
		t.Fatal("the plain rename went through; the test no longer holds the folder")
	}

	go func() {
		time.Sleep(300 * time.Millisecond)
		_ = held.Close()
	}()

	if err := renamePatiently(t.Context(), from, to); err != nil {
		t.Fatalf("rename once the folder is let go: %v", err)
	}

	if _, err := os.Stat(filepath.Join(to, "ffmpeg.exe")); err != nil {
		t.Fatalf("the folder did not move: %v", err)
	}
}
