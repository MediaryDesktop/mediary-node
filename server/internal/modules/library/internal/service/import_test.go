package service

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

func TestImportFileAddsOneFileAndMatchesIt(t *testing.T) {
	h := newHarness(t)
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "Other", "Other 01.cbz"), "zip")
	root := h.addRoot(t, dir)
	h.scan(t, root.ID)

	writeFile(t, filepath.Join(dir, "Berserk", "Berserk - Ch. 013.cbz"), "zip")

	chapter := 13
	for range 2 {
		file, err := h.svc.ImportFile(context.Background(), root.ID, "Berserk/Berserk - Ch. 013.cbz", "anilist:30002", &chapter)
		if err != nil {
			t.Fatal(err)
		}
		if file.Match == nil || file.Match.MediaRef != "anilist:30002" || file.Match.Episode == nil || *file.Match.Episode != 13 || file.Match.Source != "manual" {
			t.Fatalf("match = %+v", file.Match)
		}
	}

	files := h.files(t)
	if len(files) != 2 {
		t.Fatalf("files = %d, want the old one and the imported one, once", len(files))
	}
	for _, file := range files {
		if file.Missing {
			t.Errorf("%s is missing after an import of another file", file.RelPath)
		}
	}
}

func TestImportFileStaysInsideTheFolder(t *testing.T) {
	h := newHarness(t)
	root := h.addRoot(t, t.TempDir())

	for _, path := range []string{"", ".", "../outside.cbz", "a/../../outside.cbz"} {
		if _, err := h.svc.ImportFile(context.Background(), root.ID, path, "anilist:1", nil); apperr.KindOf(err) != apperr.KindInvalid {
			t.Errorf("ImportFile(%q) error = %v, want invalid", path, err)
		}
	}
}
