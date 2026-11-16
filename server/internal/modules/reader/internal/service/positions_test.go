package service

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/reader/internal/archive"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/reader/internal/ref"
)

type savedPage struct {
	page int
	read bool
}

// fakePositions keeps places in memory, the way the progress module would.
type fakePositions struct {
	mu      sync.Mutex
	books   map[int64]BookPosition
	pages   []savedPage
	resume  int
	bookErr error
}

func (f *fakePositions) Book(_ context.Context, book *BookFile) (*BookPosition, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	position, ok := f.books[book.FileID]
	if !ok {
		return nil, nil
	}

	return &position, nil
}

func (f *fakePositions) SaveBook(_ context.Context, book *BookFile, position BookPosition) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	if f.bookErr != nil {
		return f.bookErr
	}

	if f.books == nil {
		f.books = map[int64]BookPosition{}
	}

	f.books[book.FileID] = position

	return nil
}

func (f *fakePositions) ResumePage(context.Context, *Chapter) (int, error) {
	return f.resume, nil
}

func (f *fakePositions) SavePage(_ context.Context, _ *Chapter, page int, read bool) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.pages = append(f.pages, savedPage{page, read})

	return nil
}

func chapterService(positions *fakePositions) (*Service, ref.ChapterRef) {
	chapterRef := ref.ChapterRef{Source: ref.SourcePlugin, Key: "demo:abc"}
	pages := make([]archive.Page, 10)

	svc := New(Options{Progress: &fakeProgress{}, Positions: positions})
	svc.sources[ref.SourcePlugin] = fakeSource{chapter: &Chapter{Ref: chapterRef, MediaRef: "anilist:9", Number: "4", Pages: pages}}

	return svc, chapterRef
}

func TestEveryPageIsKeptAndTheLastOneIsRead(t *testing.T) {
	positions := &fakePositions{}
	svc, chapterRef := chapterService(positions)

	for _, page := range []int{3, 9} {
		if _, err := svc.ReportPage(context.Background(), chapterRef, page); err != nil {
			t.Fatal(err)
		}
	}

	if len(positions.pages) != 2 || positions.pages[0] != (savedPage{3, false}) || positions.pages[1] != (savedPage{9, true}) {
		t.Fatalf("pages kept: %+v", positions.pages)
	}
}

func TestAChapterOpensWhereTheUserStopped(t *testing.T) {
	svc, chapterRef := chapterService(&fakePositions{resume: 6})

	chapter, err := svc.Chapter(context.Background(), chapterRef)
	if err != nil || chapter.ResumePage != 6 {
		t.Fatalf("opens at %d, %v; want 6", chapter.ResumePage, err)
	}

	// A page past the chapter's end — it was replaced by a shorter one — opens at the start.
	svc, chapterRef = chapterService(&fakePositions{resume: 40})
	if chapter, _ := svc.Chapter(context.Background(), chapterRef); chapter.ResumePage != 0 {
		t.Fatalf("opens at %d past the end", chapter.ResumePage)
	}
}

func TestABookPlaceMovesOutOfTheOldTable(t *testing.T) {
	ctx := context.Background()
	positions := &fakePositions{}

	// A place saved before Positions existed.
	svc := bookService(t, "Dune.epub", "openlibrary:OL893414W", nil)
	if _, _, err := svc.SavePosition(ctx, 7, "epubcfi(/6/4)", 0.4); err != nil {
		t.Fatal(err)
	}

	svc.opts.Positions = positions

	// Still found before it is moved.
	if _, position, err := svc.Position(ctx, 7); err != nil || position == nil || position.Locator != "epubcfi(/6/4)" {
		t.Fatalf("the old place is not found: %+v %v", position, err)
	}

	moved, err := svc.MoveLegacyPositions(ctx)
	if err != nil || moved != 1 {
		t.Fatalf("moved %d, %v", moved, err)
	}

	if kept := positions.books[7]; kept.Locator != "epubcfi(/6/4)" ||
		!kept.UpdatedAt.Equal(time.Date(2026, 10, 9, 12, 0, 0, 0, time.UTC)) {
		t.Fatalf("moved %+v, want the place and when it was saved", kept)
	}

	if left, _ := svc.opts.Store.Positions(ctx); len(left) != 0 {
		t.Fatalf("the old table still holds %+v", left)
	}
}

// A book whose file cannot be read for its key keeps its place in the old table.
func TestAPlaceIsNeverLostWhenItCannotMove(t *testing.T) {
	ctx := context.Background()
	positions := &fakePositions{bookErr: errors.New("file locked")}

	svc := bookService(t, "Dune.epub", "", nil)
	svc.opts.Positions = positions

	if _, _, err := svc.SavePosition(ctx, 7, "page:12", 0.5); err != nil {
		t.Fatal(err)
	}

	if _, position, _ := svc.Position(ctx, 7); position == nil || position.Locator != "page:12" {
		t.Fatalf("the place was lost: %+v", position)
	}
}
