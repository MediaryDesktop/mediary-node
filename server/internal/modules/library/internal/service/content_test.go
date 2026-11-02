package service

import (
	"context"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

var breakingBad = TitleCandidate{
	MediaRef:     "tmdb:tv:1396",
	Titles:       []string{"Breaking Bad"},
	Format:       "TV",
	Year:         count(2008),
	SpansSeasons: true,
}

func TestAFolderOfShowsIsMatchedAgainstShows(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	h.titles.found = []TitleCandidate{breakingBad}

	writeEpisodes(t, root,
		"Breaking.Bad.S01E01.1080p.WEB-DL.mkv",
		"Breaking.Bad.S02E05.1080p.WEB-DL.mkv",
	)

	if _, err := h.svc.AddRoot(context.Background(), root, ContentMoviesAndShows); err != nil {
		t.Fatalf("add root: %v", err)
	}

	if status := h.scan(t, 0); status.Matched != 2 {
		t.Fatalf("matched %d of %d", status.Matched, status.Considered)
	}

	seasons := map[int]int{}
	for _, file := range h.files(t) {
		if file.Match == nil || file.Match.MediaRef != breakingBad.MediaRef {
			t.Fatalf("%s matched %+v", file.RelPath, file.Match)
		}
		seasons[*file.Match.Season] = *file.Match.Episode
	}

	if seasons[1] != 1 || seasons[2] != 5 {
		t.Fatalf("stored season → episode %v; a show's episodes count within their season", seasons)
	}

	if slices.Contains(h.titles.types, "anime") || !slices.Contains(h.titles.types, "series") {
		t.Fatalf("asked for %v: a folder of shows is never matched against anime", h.titles.types)
	}
}

func TestAFolderOfMixedVideosIsMatchedAgainstBothSources(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	h.titles.found = []TitleCandidate{breakingBad}

	writeEpisodes(t, root, "Breaking.Bad.S01E01.1080p.WEB-DL.mkv")

	if _, err := h.svc.AddRoot(context.Background(), root, ContentMixed); err != nil {
		t.Fatalf("add root: %v", err)
	}

	if status := h.scan(t, 0); status.Matched != 1 {
		t.Fatalf("matched %d of %d", status.Matched, status.Considered)
	}

	if !slices.Contains(h.titles.types, "anime") || !slices.Contains(h.titles.types, "series") {
		t.Fatalf("asked for %v, want both anime and series", h.titles.types)
	}
}

func TestChangingWhatAFolderHoldsRedoesItsAutomaticMatches(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()
	dir := t.TempDir()

	h.titles.tracked = []TitleCandidate{frierenCandidate}

	writeEpisodes(t, dir,
		"[SubsPlease] Sousou no Frieren - 01 (1080p).mkv",
		"[SubsPlease] Sousou no Frieren - 02 (1080p).mkv",
	)

	root := h.addRoot(t, dir)
	if root.Content != ContentAnime {
		t.Fatalf("a folder is anime unless said otherwise, got %q", root.Content)
	}

	h.scan(t, 0)

	files := h.files(t)
	manual := files[0]
	if _, err := h.svc.SetMatch(ctx, manual.ID, "anilist:999", nil, nil); err != nil {
		t.Fatalf("set match: %v", err)
	}

	h.titles.tracked = nil

	stream, unsubscribe := h.hub.Subscribe(events.TopicLibraryScan)
	defer unsubscribe()

	changed, err := h.svc.SetRootContent(ctx, root.ID, ContentMoviesAndShows)
	if err != nil {
		t.Fatalf("set content: %v", err)
	}
	if changed.Content != ContentMoviesAndShows {
		t.Fatalf("root %+v", changed)
	}

	waitForScan(t, stream)

	for _, file := range h.files(t) {
		switch {
		case file.ID == manual.ID:
			if file.Match == nil || file.Match.MediaRef != "anilist:999" {
				t.Errorf("the user's own match must stay, got %+v", file.Match)
			}
		case file.Match != nil:
			t.Errorf("%s kept its anime match %+v after the folder became movies and shows", file.RelPath, file.Match)
		}
	}

	if _, err := h.svc.SetRootContent(ctx, root.ID, "podcasts"); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("unknown content: %v", err)
	}
	if _, err := h.svc.SetRootContent(ctx, 999, ContentAnime); apperr.KindOf(err) != apperr.KindNotFound {
		t.Fatalf("unknown root: %v", err)
	}
}

func waitForScan(t *testing.T, stream <-chan events.Event) {
	t.Helper()

	deadline := time.After(20 * time.Second)

	for {
		select {
		case event := <-stream:
			if event.Payload["phase"] == "finished" {
				return
			}
		case <-deadline:
			t.Fatal("scan did not finish")
		}
	}
}

func TestMediaTypeForForm(t *testing.T) {
	cases := []struct {
		form, content, want string
		supported           bool
	}{
		{"series", ContentAnime, "anime", true},
		{"movie", ContentAnime, "anime", true},
		{"series", ContentMoviesAndShows, "series", true},
		{"special", ContentMoviesAndShows, "series", true},
		{"movie", ContentMoviesAndShows, "movie", true},
		{"manga", ContentMoviesAndShows, "manga", true},
		{"extra", ContentMoviesAndShows, "", false},
		{"book", ContentAnime, "book", true},
		{"series", ContentDoramas, "dorama", true},
		{"special", ContentDoramas, "dorama", true},
		{"movie", ContentDoramas, "movie", true},
		{"book", ContentBooks, "book", true},
		{"manga", ContentManga, "manga", true},
	}

	for _, c := range cases {
		got, supported := mediaTypeForForm(c.form, c.content)
		if got != c.want || supported != c.supported {
			t.Errorf("%s in %s = %q %v, want %q %v", c.form, c.content, got, supported, c.want, c.supported)
		}
	}
}

func TestMediaTypesForFormInAMixedFolder(t *testing.T) {
	cases := []struct {
		form      string
		want      []string
		supported bool
	}{
		{"series", []string{"anime", "series"}, true},
		{"special", []string{"anime", "series"}, true},
		{"movie", []string{"anime", "movie"}, true},
		{"manga", []string{"manga"}, true},
		{"book", []string{"book"}, true},
		{"extra", nil, false},
	}

	for _, c := range cases {
		got, supported := mediaTypesForForm(c.form, ContentMixed)
		if !slices.Equal(got, c.want) || supported != c.supported {
			t.Errorf("%s = %v %v, want %v %v", c.form, got, supported, c.want, c.supported)
		}
	}

	if got, _ := mediaTypesForForm("series", ContentMoviesAndShows); !slices.Equal(got, []string{"series"}) {
		t.Errorf("a folder of one type asks one source, got %v", got)
	}
}

type listeningTitles struct {
	*fakeTitles
	matched []string
}

func (l *listeningTitles) Matched(_ context.Context, refs []string) {
	l.matched = append(l.matched, refs...)
}

func TestAScanAnnouncesTheTitlesItFoundBySearching(t *testing.T) {
	h := newHarness(t)
	listener := &listeningTitles{fakeTitles: h.titles}
	h.svc.opts.Titles = listener

	h.titles.tracked = []TitleCandidate{frierenCandidate}
	h.titles.found = []TitleCandidate{breakingBad}

	anime, shows := t.TempDir(), t.TempDir()
	writeEpisodes(t, anime, "[SubsPlease] Sousou no Frieren - 01 (1080p).mkv")
	writeEpisodes(t, shows, "Breaking.Bad.S01E01.mkv", "Breaking.Bad.S01E02.mkv")

	h.addRoot(t, anime)
	if _, err := h.svc.AddRoot(context.Background(), shows, ContentMoviesAndShows); err != nil {
		t.Fatalf("add root: %v", err)
	}

	h.scan(t, 0)

	if strings.Join(listener.matched, ",") != breakingBad.MediaRef {
		t.Fatalf("announced %v: only what a search found, once — the user's own list is already described", listener.matched)
	}
}

func TestAFolderOfBooksKeepsOnlyBooks(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()
	dir := t.TempDir()

	writeEpisodes(t, dir,
		"[SubsPlease] Sousou no Frieren - 01 (1080p).mkv",
		"Berserk v01.cbz",
		"Frank Herbert - Dune.pdf",
	)

	root := h.addRoot(t, dir)
	h.scan(t, 0)

	if kinds := fileKinds(h.files(t)); kinds != "book,manga,video" {
		t.Fatalf("a folder of anime keeps every kind, got %s", kinds)
	}

	stream, unsubscribe := h.hub.Subscribe(events.TopicLibraryScan)
	defer unsubscribe()

	if _, err := h.svc.SetRootContent(ctx, root.ID, ContentBooks); err != nil {
		t.Fatalf("set content: %v", err)
	}
	waitForScan(t, stream)

	// The others leave the library rather than linger as missing.
	files := h.files(t)
	if kinds := fileKinds(files); kinds != "book" || files[0].Missing {
		t.Fatalf("a folder of books keeps %s, missing %v", kinds, files[0].Missing)
	}

	if _, err := h.svc.SetRootContent(ctx, root.ID, ContentManga); err != nil {
		t.Fatalf("set content: %v", err)
	}
	waitForScan(t, stream)

	if kinds := fileKinds(h.files(t)); kinds != "manga" {
		t.Fatalf("a folder of manga keeps %s", kinds)
	}
}

func fileKinds(files []File) string {
	kinds := map[string]bool{}
	for _, file := range files {
		kinds[file.Kind] = true
	}

	sorted := make([]string, 0, len(kinds))
	for kind := range kinds {
		sorted = append(sorted, kind)
	}
	slices.Sort(sorted)

	return strings.Join(sorted, ",")
}
