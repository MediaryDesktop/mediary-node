package service

import (
	"context"
	"testing"
)

// A title page lists its own episodes and nothing else, whichever folder they
// happen to sit in.
func TestFilesFilteredByTitle(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	writeEpisodes(t, root, "Alpha - 01.mkv", "Alpha - 02.mkv", "Beta - 01.mkv")
	h.addRoot(t, root)
	h.scan(t, 0)

	for _, file := range h.files(t) {
		ref := "anilist:2"
		if file.Parsed.Title == "Alpha" {
			ref = "anilist:1"
		}

		if _, err := h.svc.SetMatch(context.Background(), file.ID, ref, nil, file.Parsed.Episode); err != nil {
			t.Fatalf("match %s: %v", file.RelPath, err)
		}
	}

	page, err := h.svc.Files(context.Background(), FileQuery{MediaRef: "anilist:1"})
	if err != nil {
		t.Fatalf("list files: %v", err)
	}

	if page.Total != 2 || len(page.Items) != 2 {
		t.Fatalf("files for anilist:1 = %d (total %d), want 2", len(page.Items), page.Total)
	}
	for _, file := range page.Items {
		if file.Match == nil || file.Match.MediaRef != "anilist:1" {
			t.Errorf("%s is matched to %+v, not anilist:1", file.RelPath, file.Match)
		}
	}
}
