package service

import (
	"context"
	"errors"
	"path/filepath"
	"sync"
	"testing"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/matcher"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// fakeTitles stands in for the composition root's adapter over the tracker and the
// source. It counts searches, because how often the node asks the source is a
// property worth holding on to: a season of 24 episodes must cost one search.
type fakeTitles struct {
	mu sync.Mutex

	tracked   []TitleCandidate
	found     []TitleCandidate
	described []TitleDescription
	searches  []string

	isbns       map[string]TitleCandidate
	isbnLookups []string

	// types is the media type each Tracked and Search call asked for, in order.
	types []string

	trackedErr  error
	searchErr   error
	describeErr error
}

func (f *fakeTitles) Tracked(_ context.Context, mediaType string) ([]TitleCandidate, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.types = append(f.types, mediaType)

	if f.trackedErr != nil {
		return nil, f.trackedErr
	}

	return f.tracked, nil
}

func (f *fakeTitles) Search(_ context.Context, query, mediaType string) ([]TitleCandidate, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.searches = append(f.searches, query)
	f.types = append(f.types, mediaType)

	if f.searchErr != nil {
		return nil, f.searchErr
	}

	return f.found, nil
}

func (f *fakeTitles) Describe(_ context.Context, mediaRefs []string) ([]TitleDescription, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if f.describeErr != nil {
		return nil, f.describeErr
	}

	wanted := make(map[string]struct{}, len(mediaRefs))
	for _, ref := range mediaRefs {
		wanted[ref] = struct{}{}
	}

	described := make([]TitleDescription, 0, len(f.described))
	for _, title := range f.described {
		if _, want := wanted[title.MediaRef]; want {
			described = append(described, title)
		}
	}

	return described, nil
}

func (f *fakeTitles) ByISBN(_ context.Context, isbn string) (*TitleCandidate, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.isbnLookups = append(f.isbnLookups, isbn)

	if found, ok := f.isbns[isbn]; ok {
		return &found, nil
	}

	return nil, nil
}

func (f *fakeTitles) searchCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()

	return len(f.searches)
}

func count(value int) *int { return &value }

var frierenCandidate = TitleCandidate{
	MediaRef: "anilist:154587",
	Titles:   []string{"Sousou no Frieren", "Frieren: Beyond Journey's End"},
	Format:   "TV",
	Year:     count(2023),
	Episodes: count(28),
}

func writeEpisodes(t *testing.T, root string, names ...string) {
	t.Helper()

	for _, name := range names {
		writeFile(t, filepath.Join(root, name), name)
	}
}

func TestScanMatchesFilesFromTheTrackedCollection(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	h.titles.tracked = []TitleCandidate{frierenCandidate}

	writeEpisodes(t, root,
		"[SubsPlease] Sousou no Frieren - 01 (1080p).mkv",
		"[SubsPlease] Sousou no Frieren - 02 (1080p).mkv",
	)

	h.addRoot(t, root)

	status := h.scan(t, 0)
	if status.Considered != 2 || status.Matched != 2 {
		t.Fatalf("scan considered %d and matched %d, want 2 and 2", status.Considered, status.Matched)
	}

	// The collection answered, so nothing was asked of the source.
	if h.titles.searchCount() != 0 {
		t.Errorf("searched %d times, want none: the user's own list already had the answer", h.titles.searchCount())
	}

	for _, file := range h.files(t) {
		if file.Match == nil {
			t.Fatalf("%s is still unmatched", file.RelPath)
		}
		if file.Match.MediaRef != frierenCandidate.MediaRef {
			t.Errorf("%s matched %s, want %s", file.RelPath, file.Match.MediaRef, frierenCandidate.MediaRef)
		}
		if file.Match.Source != "auto" {
			t.Errorf("%s match source = %q, want auto", file.RelPath, file.Match.Source)
		}
		if file.Match.Confidence < matcher.AutoThreshold {
			t.Errorf("%s stored confidence %.2f, below the threshold it was matched by",
				file.RelPath, file.Match.Confidence)
		}
	}

	episodes := map[int]bool{}
	for _, file := range h.files(t) {
		if file.Match.Episode != nil {
			episodes[*file.Match.Episode] = true
		}
	}

	if !episodes[1] || !episodes[2] {
		t.Errorf("stored episodes = %v, want the number of each file kept", episodes)
	}
}

func TestScanAsksTheSourceOncePerTitle(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	h.titles.found = []TitleCandidate{frierenCandidate}

	writeEpisodes(t, root,
		"[SubsPlease] Sousou no Frieren - 01 (1080p).mkv",
		"[SubsPlease] Sousou no Frieren - 02 (1080p).mkv",
		"[SubsPlease] Sousou no Frieren - 03 (1080p).mkv",
	)

	h.addRoot(t, root)

	status := h.scan(t, 0)
	if status.Matched != 3 {
		t.Fatalf("matched %d files, want 3", status.Matched)
	}

	if searches := h.titles.searchCount(); searches != 1 {
		t.Errorf("searched %d times for one title, want 1: the request budget is the scarce resource", searches)
	}
}

func TestScanLeavesAWeakGuessToTheUser(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	cover := "https://img/one-piece.jpg"

	h.titles.found = []TitleCandidate{{
		MediaRef:   "anilist:21",
		Titles:     []string{"One Piece"},
		Format:     "TV",
		Year:       count(1999),
		CoverImage: &cover,
	}}

	writeEpisodes(t, root, "One - 01.mkv")
	h.addRoot(t, root)

	status := h.scan(t, 0)
	if status.Matched != 0 {
		t.Fatalf("matched %d files on a one-word title, want none", status.Matched)
	}

	file := h.files(t)[0]
	if file.Match != nil {
		t.Fatalf("file was matched to %s without being confirmed", file.Match.MediaRef)
	}

	// What the node would not decide it has to offer.
	suggestions, err := h.svc.Suggestions(context.Background(), file.ID)
	if err != nil {
		t.Fatalf("suggestions: %v", err)
	}
	if len(suggestions) == 0 {
		t.Fatal("no suggestions for an unmatched file")
	}
	if suggestions[0].MediaRef != "anilist:21" {
		t.Errorf("first suggestion = %s, want the closest title", suggestions[0].MediaRef)
	}
	if suggestions[0].Confidence >= matcher.AutoThreshold {
		t.Errorf("suggestion confidence %.2f is above the threshold, so it should have been matched already",
			suggestions[0].Confidence)
	}
	if suggestions[0].CoverImage == nil || *suggestions[0].CoverImage != cover {
		t.Errorf("suggestion cover = %v, want the poster the source gave", suggestions[0].CoverImage)
	}
}

func TestScanNeverTouchesAManualMatch(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	h.titles.tracked = []TitleCandidate{frierenCandidate}

	writeEpisodes(t, root, "[SubsPlease] Sousou no Frieren - 01 (1080p).mkv")
	h.addRoot(t, root)
	h.scan(t, 0)

	file := h.files(t)[0]
	if _, err := h.svc.SetMatch(context.Background(), file.ID, "anilist:999", nil, nil); err != nil {
		t.Fatalf("set match: %v", err)
	}

	h.scan(t, 0)

	after := h.files(t)[0]
	if after.Match == nil || after.Match.MediaRef != "anilist:999" || after.Match.Source != "manual" {
		t.Errorf("match after rescan = %+v, want the user's own decision kept", after.Match)
	}
}

func TestScanDoesNotMatchExtras(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	h.titles.tracked = []TitleCandidate{frierenCandidate}

	writeEpisodes(t, root,
		"[SubsPlease] Sousou no Frieren - NCOP01 (1080p).mkv",
		"[SubsPlease] Sousou no Frieren - 01 (1080p).mkv",
	)

	h.addRoot(t, root)
	h.scan(t, 0)

	for _, file := range h.files(t) {
		isExtra := file.Parsed.Form == "extra"

		if isExtra && file.Match != nil {
			t.Errorf("an opening was matched to %s — it belongs to no episode", file.Match.MediaRef)
		}
		if !isExtra && file.Match == nil {
			t.Errorf("%s is unmatched while the collection holds its title", file.RelPath)
		}
	}
}

func TestScanSurvivesAnUnreachableSource(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	h.titles.trackedErr = errors.New("no mirror yet")
	h.titles.searchErr = errors.New("anilist is unreachable")

	writeEpisodes(t, root, "[SubsPlease] Sousou no Frieren - 01 (1080p).mkv")
	h.addRoot(t, root)

	status := h.scan(t, 0)
	if status.Running {
		t.Error("scan did not finish while the source was down")
	}
	if status.Matched != 0 {
		t.Errorf("matched %d files without a source, want none", status.Matched)
	}
	if status.Added != 1 {
		t.Errorf("added %d files, want 1: scanning must not depend on the source", status.Added)
	}

	// The file is still there to be matched later, which the next scan will retry.
	if h.files(t)[0].Match != nil {
		t.Error("a file was matched while the source was unreachable")
	}
}

func TestSuggestionsRefuseWhatItCannotAnswer(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	writeEpisodes(t, root, "[SubsPlease] Sousou no Frieren - NCOP01 (1080p).mkv")
	h.addRoot(t, root)
	h.scan(t, 0)

	file := h.files(t)[0]

	// An opening belongs to no title's numbering, and saying so is better than an
	// empty list that looks like "nothing matches".
	_, err := h.svc.Suggestions(context.Background(), file.ID)
	if apperr.KindOf(err) != apperr.KindPrecondition {
		t.Errorf("suggestions for an extra returned %v, want a precondition failure", err)
	}

	if _, err := h.svc.Suggestions(context.Background(), 404); apperr.KindOf(err) != apperr.KindNotFound {
		t.Errorf("suggestions for a missing file returned %v, want not found", err)
	}
}
