package service

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/db"
)

// bookService reads one library book, file 7, from a real database: the
// position's row hangs off the library's own.
func bookService(t *testing.T, name, mediaRef string, progress Progress) *Service {
	t.Helper()

	ctx := context.Background()
	dir := t.TempDir()

	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte("book"), 0o600); err != nil {
		t.Fatal(err)
	}

	database, err := db.Open(ctx, filepath.Join(dir, "node.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = database.Close() })

	if err := db.Migrate(ctx, database, zerolog.Nop()); err != nil {
		t.Fatal(err)
	}

	if _, err := database.ExecContext(ctx, `INSERT INTO library_root (id, path, added_at) VALUES (1, ?, 0)`, dir); err != nil {
		t.Fatal(err)
	}
	if _, err := database.ExecContext(ctx, `INSERT INTO library_file (id, root_id, rel_path, kind, size_bytes, mtime, scanned_at)
		VALUES (7, 1, ?, 'book', 4, 0, 0)`, name); err != nil {
		t.Fatal(err)
	}

	return New(Options{
		Library:  fakeLibrary{file: &PlayableFile{ID: 7, Path: path, MediaRef: mediaRef}},
		Progress: progress,
		Store:    store.New(database),
		Now:      func() time.Time { return time.Date(2026, 10, 9, 12, 0, 0, 0, time.UTC) },
	})
}

func TestABookIsServedAsItsFormat(t *testing.T) {
	cases := map[string]string{
		"Dune.epub":        "application/epub+zip",
		"Мастер.fb2.zip":   "application/x-zip-compressed-fb2",
		"Fahrenheit.PDF":   "application/pdf",
		"Neuromancer.azw3": "application/vnd.amazon.ebook",
	}

	for name, want := range cases {
		book, err := bookService(t, name, "", nil).Book(context.Background(), 7)
		if err != nil || book.ContentType != want {
			t.Errorf("%s: %+v %v, want %s", name, book, err, want)
		}
	}

	if _, err := bookService(t, "episode.mkv", "", nil).Book(context.Background(), 7); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Errorf("a video was offered as a book: %v", err)
	}
}

func TestThePlaceIsKeptAndTheListMovesAlong(t *testing.T) {
	progress := &fakeProgress{}
	svc := bookService(t, "Dune.epub", "openlibrary:OL893414W", progress)
	ctx := context.Background()

	if position, err := svc.Position(ctx, 7); err != nil || position != nil {
		t.Fatalf("a book never opened has a place: %+v %v", position, err)
	}

	if _, err := svc.SavePosition(ctx, 7, "epubcfi(/6/4!/4/2/1:0)", 0.25); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.SavePosition(ctx, 7, "epubcfi(/6/8!/4/2/1:0)", 1.5); err != nil {
		t.Fatal(err)
	}

	position, err := svc.Position(ctx, 7)
	if err != nil || position.Locator != "epubcfi(/6/8!/4/2/1:0)" || position.Fraction != 1 {
		t.Fatalf("position %+v %v", position, err)
	}

	if progress.mediaRef != "openlibrary:OL893414W" || len(progress.fractions) != 2 || progress.fractions[1] != 1 {
		t.Errorf("progress %+v", progress)
	}
}

func TestAnUnreachableListDoesNotCostThePlace(t *testing.T) {
	svc := bookService(t, "Dune.epub", "openlibrary:OL893414W", &fakeProgress{err: errors.New("offline")})

	if _, err := svc.SavePosition(context.Background(), 7, "epubcfi(/6/4!/4/2/1:0)", 0.5); err != nil {
		t.Fatalf("the place was lost with the list: %v", err)
	}

	// Unmatched, there is no list to move.
	unmatched := bookService(t, "Dune.epub", "", &fakeProgress{err: errors.New("must not be asked")})
	if _, err := unmatched.SavePosition(context.Background(), 7, "page:12", 0.5); err != nil {
		t.Fatal(err)
	}
}
