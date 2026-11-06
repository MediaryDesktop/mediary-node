package store

import (
	"context"
	"database/sql"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/rs/zerolog"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/backup"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/db"
)

func openBackupDB(t *testing.T) *sql.DB {
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

func restoreInto(ctx context.Context, t *testing.T, database *sql.DB, doc backup.Document) {
	t.Helper()

	tx, err := database.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback() }()

	finish, err := (BackupPart{}).Restore(ctx, tx, &doc)
	if err != nil {
		t.Fatal(err)
	}

	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	finish(true)
}

// The tracker's part carries every local entry, list, item and icon to another
// node, a manual anime among them, and replaces what that node held.
func TestTheTrackerPartCarriesItsDataToAnotherNode(t *testing.T) {
	home := openBackupDB(t)
	execAll(t, home,
		`INSERT INTO tracker_entry (media_ref, media_type, status, score, progress, notes,
			completed_year, created_at, updated_at) VALUES ('tmdb:movie:438631', 'movie', 'COMPLETED', 90, 1,
			'rewatch', 2026, 1, 2)`,
		`INSERT INTO tracker_entry (media_ref, media_type, status, created_at, updated_at)
			VALUES ('manual:0123456789abcdef0123', 'anime', 'CURRENT', 3, 4)`,
		`INSERT INTO custom_list (id, media_type, name, position, created_at) VALUES (7, 'movie', 'Rewatch', 0, 5)`,
		`INSERT INTO custom_list_item (list_id, media_ref, position, added_at) VALUES (7, 'tmdb:movie:438631', 0, 6)`,
		`INSERT INTO list_icon (list_id, icon) VALUES ('local:7', 'rocket')`,
	)

	laptop := openBackupDB(t)
	execAll(t, laptop,
		`INSERT INTO tracker_entry (media_ref, media_type, status, created_at, updated_at)
			VALUES ('tmdb:tv:1399', 'series', 'PLANNING', 1, 1)`,
	)

	original := snapshotOf(t, home)
	if len(original.TrackerEntries) != 2 || len(original.CustomLists) != 1 ||
		len(original.CustomListItems) != 1 || len(original.ListIcons) != 1 {
		t.Fatalf("snapshot missed something: %+v", original)
	}

	restoreInto(t.Context(), t, laptop, original)

	if restored := snapshotOf(t, laptop); !reflect.DeepEqual(restored, original) {
		t.Fatalf("the restored state differs:\n got %+v\nwant %+v", restored, original)
	}
}
