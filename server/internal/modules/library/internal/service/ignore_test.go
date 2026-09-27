package service

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// The point of the flag: a file the user sets aside stops being offered, so the
// number they are trying to clear actually goes down and stays down.
func TestIgnoredFilesLeaveTheUnmatchedCount(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	writeEpisodes(t, root, "Whatever This Is - 01.mkv")
	h.addRoot(t, root)
	h.scan(t, 0)

	file := h.files(t)[0]

	page, err := h.svc.Files(context.Background(), FileQuery{})
	if err != nil {
		t.Fatalf("list files: %v", err)
	}
	if page.Counts.Unmatched != 1 {
		t.Fatalf("unmatched before = %d, want 1", page.Counts.Unmatched)
	}

	ignored, err := h.svc.SetIgnored(context.Background(), file.ID, true)
	if err != nil {
		t.Fatalf("ignore file: %v", err)
	}
	if !ignored.Ignored {
		t.Error("file does not report itself as ignored")
	}

	page, err = h.svc.Files(context.Background(), FileQuery{})
	if err != nil {
		t.Fatalf("list files: %v", err)
	}
	if page.Counts.Unmatched != 0 {
		t.Errorf("unmatched after ignoring = %d, want 0", page.Counts.Unmatched)
	}
	if page.Counts.Ignored != 1 {
		t.Errorf("ignored = %d, want 1", page.Counts.Ignored)
	}

	// A rescan must not undo it, or the flag would be worth nothing.
	h.scan(t, 0)

	if !h.files(t)[0].Ignored {
		t.Error("the file stopped being ignored after a rescan")
	}

	// And the matcher must not be handed it again either.
	unmatched, err := h.svc.Files(context.Background(), FileQuery{UnmatchedOnly: true})
	if err != nil {
		t.Fatalf("list unmatched: %v", err)
	}
	if len(unmatched.Items) != 0 {
		t.Errorf("unmatched list holds %d files, want none", len(unmatched.Items))
	}

	only, err := h.svc.Files(context.Background(), FileQuery{IgnoredOnly: true})
	if err != nil {
		t.Fatalf("list ignored: %v", err)
	}
	if len(only.Items) != 1 || only.Items[0].ID != file.ID {
		t.Errorf("ignored list = %+v, want the one file set aside", only.Items)
	}

	if _, err := h.svc.SetIgnored(context.Background(), file.ID, false); err != nil {
		t.Fatalf("unignore file: %v", err)
	}
	if h.files(t)[0].Ignored {
		t.Error("the file is still ignored after the mark was taken off")
	}
}

func TestDeleteFileRemovesItFromDiskAndLibrary(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	path := filepath.Join(root, "Show - 01.mkv")
	writeFile(t, path, "one")
	writeFile(t, filepath.Join(root, "Show - 02.mkv"), "two")

	h.addRoot(t, root)
	h.scan(t, 0)

	file := h.files(t)[0]
	if err := h.svc.DeleteFile(context.Background(), file.ID); err != nil {
		t.Fatalf("delete file: %v", err)
	}

	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Errorf("the file is still on disk: %v", err)
	}

	files := h.files(t)
	if len(files) != 1 {
		t.Fatalf("library holds %d files, want the other one only", len(files))
	}

	if err := h.svc.DeleteFile(context.Background(), file.ID); apperr.KindOf(err) != apperr.KindNotFound {
		t.Errorf("deleting the same file twice returned %v, want not found", err)
	}
}

// A file that is already gone is not a failure: the user wants it not to be
// there, and it is not there. The row still has to go.
func TestDeleteFileForgetsAFileThatIsAlreadyGone(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	path := filepath.Join(root, "Show - 01.mkv")
	writeFile(t, path, "one")

	h.addRoot(t, root)
	h.scan(t, 0)

	file := h.files(t)[0]

	if err := os.Remove(path); err != nil {
		t.Fatalf("remove file: %v", err)
	}

	if err := h.svc.DeleteFile(context.Background(), file.ID); err != nil {
		t.Fatalf("delete a file that is already gone: %v", err)
	}

	if files := h.files(t); len(files) != 0 {
		t.Errorf("library still holds %+v", files)
	}
}
