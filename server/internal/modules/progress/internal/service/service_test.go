package service

import (
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/progress/internal/store"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/db"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/events"
)

func openDB(t *testing.T) *sql.DB {
	t.Helper()

	database, err := db.Open(t.Context(), filepath.Join(t.TempDir(), "node.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = database.Close() })

	if err := db.Migrate(t.Context(), database, zerolog.Nop()); err != nil {
		t.Fatal(err)
	}

	return database
}

type clock struct{ at time.Time }

func (c *clock) now() time.Time { return c.at }

func newService(t *testing.T) (*Service, *clock, *events.Hub) {
	t.Helper()

	c := &clock{at: time.Date(2026, 11, 16, 20, 0, 0, 0, time.UTC)}
	hub := events.NewHub(16)

	return New(store.New(openDB(t)), hub, zerolog.Nop(), c.now), c, hub
}

var episode3 = WatchKey{MediaRef: "anilist:154587", Episode: 3}

func TestResumeAtWhereTheUserStopped(t *testing.T) {
	svc, _, _ := newService(t)
	ctx := t.Context()

	if at, err := svc.ResumeAt(ctx, episode3); err != nil || at != 0 {
		t.Fatalf("an episode never played resumes at %v, %v", at, err)
	}

	if err := svc.SaveWatch(ctx, episode3, 842, 1420, false); err != nil {
		t.Fatal(err)
	}

	if at, _ := svc.ResumeAt(ctx, episode3); at != 842 {
		t.Fatalf("resumes at %v, want 842", at)
	}
}

func TestResumeStartsOverNearEitherEnd(t *testing.T) {
	svc, _, _ := newService(t)
	ctx := t.Context()

	for _, tc := range []struct {
		name     string
		position float64
		want     float64
	}{
		{"in the first half minute", 12, 0},
		{"in the last tenth", 1300, 0},
		{"in the middle", 600, 600},
	} {
		if err := svc.SaveWatch(ctx, episode3, tc.position, 1420, false); err != nil {
			t.Fatal(err)
		}

		if at, _ := svc.ResumeAt(ctx, episode3); at != tc.want {
			t.Errorf("%s: resumes at %v, want %v", tc.name, at, tc.want)
		}
	}
}

func TestAWatchedPassStartsOverAndARewatchCountsAgain(t *testing.T) {
	svc, _, _ := newService(t)
	ctx := t.Context()

	// Watched through: the player says so past its threshold, more than once.
	for _, position := range []float64{1210, 1220, 1230} {
		if err := svc.SaveWatch(ctx, episode3, position, 1420, true); err != nil {
			t.Fatal(err)
		}
	}

	title, _ := svc.Title(ctx, episode3.MediaRef)
	if len(title.Episodes) != 1 || !title.Episodes[0].Watched || title.Episodes[0].WatchCount != 1 {
		t.Fatalf("after one pass: %+v", title.Episodes)
	}

	// Paused at the credits, it is still a finished pass: the next play starts over.
	if at, _ := svc.ResumeAt(ctx, episode3); at != 0 {
		t.Fatalf("a watched pass resumes at %v", at)
	}

	// Watched again from the start.
	for _, report := range []struct {
		position float64
		reached  bool
	}{{10, false}, {700, false}, {1250, true}} {
		if err := svc.SaveWatch(ctx, episode3, report.position, 1420, report.reached); err != nil {
			t.Fatal(err)
		}
	}

	title, _ = svc.Title(ctx, episode3.MediaRef)
	if title.Episodes[0].WatchCount != 2 {
		t.Fatalf("a rewatch counted %d passes, want 2", title.Episodes[0].WatchCount)
	}
}

func TestOnlyNewlyWatchedEpisodesAreAnnounced(t *testing.T) {
	svc, _, hub := newService(t)
	ctx := t.Context()

	stream, unsubscribe := hub.Subscribe(events.TopicProgress)
	defer unsubscribe()

	for _, report := range []struct {
		position float64
		reached  bool
	}{{100, false}, {200, false}, {1250, true}, {1260, true}} {
		if err := svc.SaveWatch(ctx, episode3, report.position, 1420, report.reached); err != nil {
			t.Fatal(err)
		}
	}

	announced := 0

	for {
		select {
		case <-stream:
			announced++
			continue
		default:
		}

		break
	}

	if announced != 1 {
		t.Fatalf("%d announcements, want 1: positions are not, the episode being watched is", announced)
	}
}

func TestUnmarkingForgetsTheEpisode(t *testing.T) {
	svc, _, _ := newService(t)
	ctx := t.Context()

	if err := svc.SaveWatch(ctx, episode3, 600, 1420, false); err != nil {
		t.Fatal(err)
	}

	marked, err := svc.SetEpisodeWatched(ctx, episode3.MediaRef, 3, true)
	if err != nil || !marked.Watched || marked.WatchCount != 1 {
		t.Fatalf("marked: %+v, %v", marked, err)
	}

	unmarked, err := svc.SetEpisodeWatched(ctx, episode3.MediaRef, 3, false)
	if err != nil || unmarked.Watched || unmarked.WatchCount != 0 || unmarked.Position != 0 {
		t.Fatalf("unmarked: %+v, %v", unmarked, err)
	}
}

func TestAFileWithoutATitleIsKeptByItsContent(t *testing.T) {
	svc, _, _ := newService(t)
	ctx := t.Context()
	file := WatchKey{ContentKey: "734003200:0f1e2d3c4b5a69788796a5b4c3d2e1f0"}

	if err := svc.SaveWatch(ctx, file, 300, 1400, false); err != nil {
		t.Fatal(err)
	}

	if at, _ := svc.ResumeAt(ctx, file); at != 300 {
		t.Fatalf("resumes at %v, want 300", at)
	}

	if err := svc.SaveWatch(ctx, WatchKey{ContentKey: "x", MediaRef: "anilist:1", Episode: 1}, 1, 1, false); err == nil {
		t.Fatal("a key naming both a file and an episode was accepted")
	}
}

func TestAChapterStaysReadWhenPagedBack(t *testing.T) {
	svc, _, _ := newService(t)
	ctx := t.Context()
	key := ChapterKey{MediaRef: "anilist:30002", Chapter: "12.5"}

	if err := svc.SaveChapter(ctx, key, 19, 40, false); err != nil {
		t.Fatal(err)
	}
	if page, _ := svc.ResumePage(ctx, key); page != 19 {
		t.Fatalf("opens at page %d, want 19", page)
	}

	if err := svc.SaveChapter(ctx, key, 39, 40, true); err != nil {
		t.Fatal(err)
	}
	if err := svc.SaveChapter(ctx, key, 5, 40, false); err != nil {
		t.Fatal(err)
	}

	title, _ := svc.Title(ctx, key.MediaRef)
	if len(title.Chapters) != 1 || !title.Chapters[0].Read || title.Chapters[0].Chapter != "12.5" {
		t.Fatalf("chapters: %+v", title.Chapters)
	}

	// A chapter finished opens at its start again.
	if err := svc.SaveChapter(ctx, key, 39, 40, true); err != nil {
		t.Fatal(err)
	}
	if page, _ := svc.ResumePage(ctx, key); page != 0 {
		t.Fatalf("a finished chapter opens at page %d", page)
	}
}

func TestContinueOffersTheLatestEpisodeOfEachTitle(t *testing.T) {
	svc, c, _ := newService(t)
	ctx := t.Context()

	steps := []struct {
		key      WatchKey
		position float64
	}{
		{WatchKey{MediaRef: "anilist:1", Episode: 1}, 400},
		{WatchKey{MediaRef: "anilist:2", Episode: 5}, 500},
		{WatchKey{MediaRef: "anilist:1", Episode: 2}, 600},
		{WatchKey{ContentKey: "1:aa"}, 700}, // not a title: not offered
	}

	for _, step := range steps {
		c.at = c.at.Add(time.Minute)

		if err := svc.SaveWatch(ctx, step.key, step.position, 1400, false); err != nil {
			t.Fatal(err)
		}
	}

	items, err := svc.Continue(ctx, 0)
	if err != nil {
		t.Fatal(err)
	}

	if len(items) != 2 || items[0].MediaRef != "anilist:1" || items[0].Episode != 2 || items[1].MediaRef != "anilist:2" {
		t.Fatalf("continue: %+v", items)
	}
}

func TestABookKeepsItsPlace(t *testing.T) {
	svc, _, _ := newService(t)
	ctx := t.Context()

	if book, err := svc.Book(ctx, "1:bb"); err != nil || book != nil {
		t.Fatalf("a book never opened: %+v, %v", book, err)
	}

	if err := svc.SaveBook(ctx, Book{ContentKey: "1:bb", MediaRef: "openlibrary:OL1W", Locator: "epubcfi(/6/4)", Fraction: 1.5}); err != nil {
		t.Fatal(err)
	}

	book, err := svc.Book(ctx, "1:bb")
	if err != nil || book == nil || book.Locator != "epubcfi(/6/4)" || book.Fraction != 1 {
		t.Fatalf("book: %+v, %v", book, err)
	}
}
