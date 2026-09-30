package service

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/matcher"
)

func TestScanRecordsHistory(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	h.titles.tracked = []TitleCandidate{frierenCandidate}

	writeEpisodes(t, root,
		"[SubsPlease] Sousou no Frieren - 01 (1080p).mkv",
		"[SubsPlease] Sousou no Frieren - 02 (1080p).mkv",
	)
	h.addRoot(t, root)

	status := h.scan(t, 0)

	history, err := h.svc.ScanHistory(context.Background(), ScanHistoryQuery{})
	if err != nil {
		t.Fatalf("scan history: %v", err)
	}
	if len(history.Items) != 1 {
		t.Fatalf("history holds %d runs, want 1", len(history.Items))
	}

	run := history.Items[0]
	if run.Status != "completed" {
		t.Errorf("status = %q, want completed", run.Status)
	}
	if run.Considered != status.Considered || run.Matched != status.Matched {
		t.Errorf("history considered=%d matched=%d, want the scan's own %d and %d",
			run.Considered, run.Matched, status.Considered, status.Matched)
	}
	if run.Found != 2 {
		t.Errorf("history found = %d, want 2", run.Found)
	}

	detail, err := h.svc.ScanRun(context.Background(), run.ID)
	if err != nil {
		t.Fatalf("scan run detail: %v", err)
	}

	if len(detail.Roots) != 1 || detail.Roots[0].RootPath != root {
		t.Errorf("detail roots = %+v, want the one root scanned", detail.Roots)
	}

	if len(detail.Groups) != 1 {
		t.Fatalf("detail groups = %+v, want the one title matched", detail.Groups)
	}
	group := detail.Groups[0]
	if group.MediaRef != frierenCandidate.MediaRef || group.FileCount != 2 {
		t.Errorf("group = %+v, want %s with 2 files", group, frierenCandidate.MediaRef)
	}
	if !group.Tracked {
		t.Error("group.Tracked = false, want true: the match came off the user's own list")
	}

	// The log under a title is what happened to that title's own files.
	if len(group.Files) != 2 {
		t.Errorf("group files = %+v, want both episodes logged under the title", group.Files)
	}

	if len(detail.UnmatchedFiles) != 0 {
		t.Errorf("unmatched files = %+v, want none: every file matched", detail.UnmatchedFiles)
	}
}

func TestScanHistoryRecordsWhyAFileDidNotMatch(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	h.titles.found = []TitleCandidate{{
		MediaRef: "anilist:21",
		Titles:   []string{"One Piece"},
		Format:   "TV",
		Year:     count(1999),
	}}

	writeEpisodes(t, root, "One - 01.mkv")
	h.addRoot(t, root)
	h.scan(t, 0)

	history, err := h.svc.ScanHistory(context.Background(), ScanHistoryQuery{})
	if err != nil {
		t.Fatalf("scan history: %v", err)
	}
	if len(history.Items) != 1 {
		t.Fatalf("history holds %d runs, want 1", len(history.Items))
	}

	detail, err := h.svc.ScanRun(context.Background(), history.Items[0].ID)
	if err != nil {
		t.Fatalf("scan run detail: %v", err)
	}

	if len(detail.Groups) != 0 {
		t.Errorf("groups = %+v, want none: nothing cleared the threshold", detail.Groups)
	}

	if len(detail.UnmatchedFiles) != 1 {
		t.Fatalf("unmatched files = %+v, want the one weak guess", detail.UnmatchedFiles)
	}

	entry := detail.UnmatchedFiles[0]
	if entry.RelPath != filepath.Base(entry.RelPath) {
		t.Errorf("rel_path = %q, want just the file name at the root", entry.RelPath)
	}
	if entry.Confidence == nil {
		t.Fatal("confidence is nil, want the best rejected score")
	}
	if *entry.Confidence >= matcher.AutoThreshold {
		t.Errorf("confidence = %.2f, want it below the threshold that would have matched it", *entry.Confidence)
	}
}
