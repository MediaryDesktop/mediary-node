package service

import (
	"context"
	"testing"
)

func TestCollectionReadsTheLibraryAsTitles(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	h.titles.tracked = []TitleCandidate{frierenCandidate}
	h.titles.described = []TitleDescription{
		{MediaRef: frierenCandidate.MediaRef, MediaType: "anime", Title: "Sousou no Frieren"},
	}

	writeEpisodes(t, root,
		"[SubsPlease] Sousou no Frieren - 01 (1080p).mkv",
		"[SubsPlease] Sousou no Frieren - 02 (1080p).mkv",
	)

	// Nothing on the user's list explains this one, so it stays unmatched and must
	// not turn up as a title on the shelf.
	writeEpisodes(t, root, "One - 01.mkv")

	h.addRoot(t, root)
	h.scan(t, 0)

	collection, err := h.svc.Collection(context.Background())
	if err != nil {
		t.Fatalf("collection: %v", err)
	}

	if len(collection.Entries) != 1 {
		t.Fatalf("collection holds %d titles, want the one both episodes share", len(collection.Entries))
	}

	entry := collection.Entries[0]
	if entry.MediaRef != frierenCandidate.MediaRef || entry.FileCount != 2 {
		t.Errorf("entry = %+v, want %s with 2 files", entry, frierenCandidate.MediaRef)
	}
	if entry.Title == nil || entry.Title.Title != "Sousou no Frieren" {
		t.Errorf("entry title = %+v, want the name the node already holds", entry.Title)
	}
	if entry.MissingCount != 0 {
		t.Errorf("missing = %d, want none", entry.MissingCount)
	}

	if collection.Files != 3 {
		t.Errorf("files = %d, want every file in the library", collection.Files)
	}
	if collection.Unmatched != 1 {
		t.Errorf("unmatched = %d, want the one file no title explains", collection.Unmatched)
	}
}

// A title the source cannot name still belongs on the shelf: the user has the
// files either way, and an entry that vanishes with the network is worse than
// one without a poster.
func TestCollectionKeepsTitlesItCannotName(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	writeEpisodes(t, root, "Show - 01.mkv")
	h.addRoot(t, root)
	h.scan(t, 0)

	file := h.files(t)[0]
	if _, err := h.svc.SetMatch(context.Background(), file.ID, "anilist:404", nil, nil); err != nil {
		t.Fatalf("set match: %v", err)
	}

	collection, err := h.svc.Collection(context.Background())
	if err != nil {
		t.Fatalf("collection: %v", err)
	}

	if len(collection.Entries) != 1 {
		t.Fatalf("collection holds %d titles, want the matched one", len(collection.Entries))
	}
	if collection.Entries[0].Title != nil {
		t.Errorf("title = %+v, want none the node could not describe", collection.Entries[0].Title)
	}
	if collection.Entries[0].MediaRef != "anilist:404" {
		t.Errorf("media_ref = %q, want the reference kept", collection.Entries[0].MediaRef)
	}
}
