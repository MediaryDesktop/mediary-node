package store

import (
	"database/sql"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/rs/zerolog"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/backup"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/db"
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

func execAll(t *testing.T, database *sql.DB, queries ...string) {
	t.Helper()

	for _, query := range queries {
		if _, err := database.ExecContext(t.Context(), query); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
	}
}

func snapshotOf(t *testing.T, database *sql.DB) backup.Document {
	t.Helper()

	tx, err := database.BeginTx(t.Context(), &sql.TxOptions{ReadOnly: true})
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback() }()

	var doc backup.Document
	if err := (BackupPart{}).Snapshot(t.Context(), tx, &doc); err != nil {
		t.Fatal(err)
	}

	return doc
}

func restoreInto(t *testing.T, database *sql.DB, doc backup.Document) error {
	t.Helper()

	tx, err := database.BeginTx(t.Context(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback() }()

	finish, err := (BackupPart{}).Restore(t.Context(), tx, &doc)
	if err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	finish(true)

	return nil
}

// Every kind of state goes to another node — an anime's episodes among them,
// which AniList knows only as one number — and replaces what that node held.
func TestTheProgressPartCarriesItsStateToAnotherNode(t *testing.T) {
	home := openDB(t)
	execAll(t, home,
		`INSERT INTO watch_state (media_ref, episode, position, duration, watched, watch_count, pass_counted,
			last_watched_at, updated_at) VALUES ('anilist:154587', 3, 1250.75, 1420.5, 1, 2, 1, 100, 200)`,
		`INSERT INTO watch_state (content_key, position, duration, updated_at)
			VALUES ('734003200:0f1e2d3c4b5a69788796a5b4c3d2e1f0', 600, 1400, 300)`,
		`INSERT INTO chapter_state (media_ref, chapter, page, pages, read, read_at, updated_at)
			VALUES ('anilist:30002', '12.5', 39, 40, 1, 400, 500)`,
		`INSERT INTO chapter_state (source_ref, page, pages, updated_at)
			VALUES ('opds-url:https://komga.example#urn:uuid:1', 7, 30, 600)`,
		`INSERT INTO book_state (content_key, media_ref, locator, fraction, updated_at)
			VALUES ('1048576:aa', 'openlibrary:OL1W', 'epubcfi(/6/4)', 0.25, 700)`,
	)

	laptop := openDB(t)
	execAll(t, laptop,
		`INSERT INTO watch_state (media_ref, episode, position, updated_at) VALUES ('tmdb:tv:1399', 1, 10, 1)`,
	)

	original := snapshotOf(t, home)
	if len(original.WatchStates) != 2 || len(original.ChapterStates) != 2 || len(original.BookStates) != 1 {
		t.Fatalf("snapshot missed something: %+v", original)
	}

	for _, state := range original.WatchStates {
		if state.Position != float64(int64(state.Position)) || state.Duration != float64(int64(state.Duration)) {
			t.Fatalf("positions are not whole seconds: %+v", original.WatchStates)
		}
	}

	if err := restoreInto(t, laptop, original); err != nil {
		t.Fatal(err)
	}

	if restored := snapshotOf(t, laptop); !reflect.DeepEqual(restored, original) {
		t.Fatalf("the restored state differs:\n got %+v\nwant %+v", restored, original)
	}
}

// The same state encodes to the same bytes, so the cloud can tell nothing changed.
func TestAnUnchangedStateEncodesTheSame(t *testing.T) {
	database := openDB(t)
	execAll(t, database,
		`INSERT INTO watch_state (media_ref, episode, position, updated_at) VALUES ('anilist:2', 1, 5, 1)`,
		`INSERT INTO watch_state (media_ref, episode, position, updated_at) VALUES ('anilist:1', 2, 5, 1)`,
		`INSERT INTO watch_state (media_ref, episode, position, updated_at) VALUES ('anilist:1', 1, 5, 1)`,
	)

	first, err := backup.Encode(snapshotOf(t, database))
	if err != nil {
		t.Fatal(err)
	}

	second, err := backup.Encode(snapshotOf(t, database))
	if err != nil {
		t.Fatal(err)
	}

	if first.Sha256 != second.Sha256 {
		t.Fatal("two snapshots of one state differ")
	}
}

// A document that names an episode both ways is refused rather than half-restored.
func TestARestoreRefusesAStateNamedTwice(t *testing.T) {
	episode := int64(1)
	doc := backup.Document{WatchStates: []backup.WatchState{{
		MediaRef: "anilist:1", Episode: &episode, ContentKey: "1:aa", UpdatedAt: 1,
	}}}

	if err := restoreInto(t, openDB(t), doc); err == nil {
		t.Fatal("a state named by both an episode and a file was restored")
	}
}
