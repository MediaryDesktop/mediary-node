package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

type fakeTitles struct {
	cached  map[string]LocalTitle
	source  map[string]LocalTitle
	offline bool
	lookups int
}

func (f *fakeTitles) Describe(_ context.Context, refs []string) map[string]LocalTitle {
	described := map[string]LocalTitle{}
	for _, ref := range refs {
		if title, ok := f.cached[ref]; ok {
			described[ref] = title
		}
	}

	return described
}

func (f *fakeTitles) Lookup(_ context.Context, ref string) (*LocalTitle, error) {
	f.lookups++

	if f.offline {
		return nil, apperr.New(apperr.KindUnavailable, "TMDB is unreachable")
	}

	title, ok := f.source[ref]
	if !ok {
		return nil, apperr.New(apperr.KindNotFound, "TMDB has no such title")
	}

	if f.cached == nil {
		f.cached = map[string]LocalTitle{}
	}
	f.cached[ref] = title

	return &title, nil
}

func localTitleOf(mediaType MediaType, name string, episodes int) LocalTitle {
	cover := "https://image.tmdb.org/t/p/w500/" + strings.ReplaceAll(name, " ", "") + ".jpg"

	return LocalTitle{
		MediaType: mediaType,
		Media:     Media{Title: Title{UserPreferred: &name, English: &name}, Episodes: &episodes, CoverImage: &cover},
	}
}

func newLocalHarness(t *testing.T) (*harness, *fakeTitles) {
	t.Helper()

	fake := newFakeAniList(t)
	h := newHarness(t, fake.server.URL)
	h.now = time.Date(2026, 10, 8, 20, 0, 0, 0, time.UTC)

	titles := &fakeTitles{source: map[string]LocalTitle{
		"tmdb:movie:603": localTitleOf(MediaTypeMovie, "The Matrix", 1),
		"tmdb:tv:1396":   localTitleOf(MediaTypeSeries, "Breaking Bad", 3),
		"tmdb:tv:7":      localTitleOf(MediaTypeDorama, "Crash Landing on You", 16),
	}}
	h.svc.opts.Titles = titles

	return h, titles
}

func TestALocalEntryIsAddedWithoutAniList(t *testing.T) {
	h, _ := newLocalHarness(t)
	ctx := context.Background()

	if _, err := h.svc.CreateList(ctx, ListMediaTypeMovie, "Favourites", ""); err != nil {
		t.Fatalf("create list: %v", err)
	}

	planning, favourites := "PLANNING", []string{"Favourites"}

	entry, err := h.svc.UpdateEntry(ctx, "tmdb:movie:603", EntryPatch{Status: &planning, CustomLists: &favourites})
	if err != nil {
		t.Fatalf("add: %v", err)
	}

	if entry.Provider != ProviderLocal || entry.MediaType != MediaTypeMovie || entry.SyncPending {
		t.Fatalf("entry %+v", entry)
	}

	collection, err := h.svc.Entries(ctx, MediaTypeMovie)
	if err != nil {
		t.Fatalf("entries: %v", err)
	}

	if len(collection.Entries) != 1 || *collection.Entries[0].Media.Title.UserPreferred != "The Matrix" {
		t.Fatalf("entries %+v", collection.Entries)
	}

	if strings.Join(collection.Entries[0].CustomLists, "|") != "Favourites" {
		t.Fatalf("custom lists %v", collection.Entries[0].CustomLists)
	}

	var got []string
	for _, list := range collection.Lists {
		got = append(got, list.Name+"="+string(rune('0'+list.Count)))
	}
	if strings.Join(got, ",") != "PLANNING=1,Favourites=1" {
		t.Fatalf("lists %v", got)
	}

	lists, err := h.svc.Lists(ctx)
	if err != nil {
		t.Fatalf("lists: %v", err)
	}
	if list := findList(lists, ListMediaTypeMovie, "Favourites"); list == nil || len(list.Covers) != 1 {
		t.Fatalf("the local list carries the title's poster, got %+v", list)
	}

	if series, _ := h.svc.Entries(ctx, MediaTypeSeries); len(series.Entries) != 0 {
		t.Fatalf("a movie is not a series, got %+v", series.Entries)
	}
}

func TestProgressStartsAndCompletesALocalEntry(t *testing.T) {
	h, _ := newLocalHarness(t)
	ctx := context.Background()

	one, three := 1, 3

	started, err := h.svc.UpdateEntry(ctx, "tmdb:tv:1396", EntryPatch{Progress: &one})
	if err != nil {
		t.Fatalf("progress 1: %v", err)
	}

	if started.Status != "CURRENT" || *started.StartedAt.Day != 8 || started.CompletedAt.Year != nil {
		t.Fatalf("the first episode starts the show, got %s %+v", started.Status, started.StartedAt)
	}

	done, err := h.svc.UpdateEntry(ctx, "tmdb:tv:1396", EntryPatch{Progress: &three})
	if err != nil {
		t.Fatalf("progress 3: %v", err)
	}

	if done.Status != "COMPLETED" || *done.CompletedAt.Year != 2026 || *done.StartedAt.Day != 8 {
		t.Fatalf("the last episode completes the show, got %s %+v", done.Status, done.CompletedAt)
	}

	paused, two := "PAUSED", 2
	kept, err := h.svc.UpdateEntry(ctx, "tmdb:tv:1396", EntryPatch{Progress: &two, Status: &paused})
	if err != nil {
		t.Fatalf("paused: %v", err)
	}

	if kept.Status != "PAUSED" || kept.Progress != 2 {
		t.Fatalf("a status the user set wins, got %s %d", kept.Status, kept.Progress)
	}
}

func TestThePlayerNeverLowersLocalProgress(t *testing.T) {
	h, _ := newLocalHarness(t)
	ctx := context.Background()

	if err := h.svc.MarkWatched(ctx, "tmdb:tv:7", 5); err != nil {
		t.Fatalf("watch 5: %v", err)
	}
	if err := h.svc.MarkWatched(ctx, "tmdb:tv:7", 3); err != nil {
		t.Fatalf("rewatch 3: %v", err)
	}

	collection, err := h.svc.Entries(ctx, MediaTypeDorama)
	if err != nil {
		t.Fatalf("entries: %v", err)
	}

	if len(collection.Entries) != 1 || collection.Entries[0].Progress != 5 || collection.Entries[0].Status != "CURRENT" {
		t.Fatalf("entries %+v", collection.Entries)
	}
}

func TestALocalEntryIsEditedOfflineButNotAdded(t *testing.T) {
	h, titles := newLocalHarness(t)
	ctx := context.Background()

	planning := "PLANNING"
	if _, err := h.svc.UpdateEntry(ctx, "tmdb:movie:603", EntryPatch{Status: &planning}); err != nil {
		t.Fatalf("add: %v", err)
	}

	titles.offline = true
	titles.cached = nil

	score := 90
	edited, err := h.svc.UpdateEntry(ctx, "tmdb:movie:603", EntryPatch{Score: &score})
	if err != nil || edited.Score != 90 {
		t.Fatalf("an edit works offline, got %+v, %v", edited, err)
	}

	if _, err := h.svc.UpdateEntry(ctx, "tmdb:tv:1396", EntryPatch{Status: &planning}); apperr.KindOf(err) != apperr.KindUnavailable {
		t.Fatalf("adding needs the title's type from TMDB, got %v", err)
	}

	before := titles.lookups
	if _, err := h.svc.Entries(ctx, MediaTypeMovie); err != nil {
		t.Fatalf("entries offline: %v", err)
	}
	if titles.lookups-before != 1 {
		t.Fatalf("offline, one failed lookup ends the asking, got %d", titles.lookups-before)
	}
}

func TestDeletingALocalEntryLeavesItsLists(t *testing.T) {
	h, _ := newLocalHarness(t)
	ctx := context.Background()

	if _, err := h.svc.CreateList(ctx, ListMediaTypeSeries, "Rewatch", ""); err != nil {
		t.Fatalf("create list: %v", err)
	}

	rewatch := []string{"Rewatch"}
	if _, err := h.svc.UpdateEntry(ctx, "tmdb:tv:1396", EntryPatch{CustomLists: &rewatch}); err != nil {
		t.Fatalf("add: %v", err)
	}

	if err := h.svc.DeleteEntry(ctx, "tmdb:tv:1396"); err != nil {
		t.Fatalf("delete: %v", err)
	}

	lists, err := h.svc.Lists(ctx)
	if err != nil {
		t.Fatalf("lists: %v", err)
	}
	if list := findList(lists, ListMediaTypeSeries, "Rewatch"); list == nil || list.Count != 0 {
		t.Fatalf("the list stays and is empty, got %+v", list)
	}

	if err := h.svc.DeleteEntry(ctx, "tmdb:tv:1396"); apperr.KindOf(err) != apperr.KindNotFound {
		t.Fatalf("second delete: %v", err)
	}

	if err := h.svc.DeleteEntry(ctx, "anilist:1"); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("anilist delete: %v", err)
	}
}

func TestLocalEntryRejectsWhatItCannotSave(t *testing.T) {
	h, _ := newLocalHarness(t)
	ctx := context.Background()

	missing := []string{"Nope"}
	if _, err := h.svc.UpdateEntry(ctx, "tmdb:movie:603", EntryPatch{CustomLists: &missing}); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("unknown list: %v", err)
	}

	if collection, _ := h.svc.Entries(ctx, MediaTypeMovie); len(collection.Entries) != 0 {
		t.Fatal("a rejected add must not leave an entry behind")
	}

	planning := "PLANNING"
	for _, ref := range []string{"tmdb:movie:0", "tmdb:person:1", "tmdb:tv:abc"} {
		if _, err := h.svc.UpdateEntry(ctx, ref, EntryPatch{Status: &planning}); apperr.KindOf(err) != apperr.KindInvalid {
			t.Errorf("%q: %v", ref, err)
		}
	}
}

func TestABookCountsPages(t *testing.T) {
	h, titles := newLocalHarness(t)
	ctx := context.Background()

	name, pages := "Dune", 608
	titles.source["openlibrary:OL893414W"] = LocalTitle{
		MediaType: MediaTypeBook,
		Media:     Media{Title: Title{UserPreferred: &name}, Pages: &pages},
	}

	hundred := 100
	reading, err := h.svc.UpdateEntry(ctx, "openlibrary:OL893414W", EntryPatch{Progress: &hundred})
	if err != nil {
		t.Fatalf("progress: %v", err)
	}
	if reading.Status != "CURRENT" || reading.MediaType != MediaTypeBook {
		t.Fatalf("page 100 starts the book, got %s %s", reading.Status, reading.MediaType)
	}

	if err := h.svc.MarkRead(ctx, "openlibrary:OL893414W", 608); err != nil {
		t.Fatalf("last page: %v", err)
	}

	collection, err := h.svc.Entries(ctx, MediaTypeBook)
	if err != nil {
		t.Fatalf("entries: %v", err)
	}

	if len(collection.Entries) != 1 || collection.Entries[0].Status != "COMPLETED" || collection.Entries[0].Progress != 608 {
		t.Fatalf("the last page completes the book, got %+v", collection.Entries)
	}

	planning := "PLANNING"
	if _, err := h.svc.UpdateEntry(ctx, "openlibrary:OL1M", EntryPatch{Status: &planning}); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("an edition is not a work: %v", err)
	}
}
