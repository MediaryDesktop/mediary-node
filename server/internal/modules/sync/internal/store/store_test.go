package store

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"testing"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/platform/backup"
	"github.com/mediaryorg/mediary-node/server/internal/platform/db"
)

// writingPart writes a row of its own inside the restore's transaction, so a
// test can see whether that transaction was committed or rolled back. It may
// fail after writing, as a part that breaks halfway would.
type writingPart struct {
	key      string
	fail     bool
	finished []bool
}

func (p *writingPart) Snapshot(context.Context, *sql.Tx, *backup.Document) error { return nil }

func (p *writingPart) Restore(ctx context.Context, tx *sql.Tx, _ *backup.Document) (func(bool), error) {
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO node_meta (key, value, updated_at) VALUES (?, 'restored', 0)`, p.key); err != nil {
		return nil, err
	}

	if p.fail {
		return nil, errors.New("this part breaks halfway")
	}

	return func(committed bool) { p.finished = append(p.finished, committed) }, nil
}

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

func written(t *testing.T, database *sql.DB, key string) bool {
	t.Helper()

	var n int
	if err := database.QueryRowContext(t.Context(),
		`SELECT COUNT(*) FROM node_meta WHERE key = ?`, key).Scan(&n); err != nil {
		t.Fatal(err)
	}

	return n > 0
}

// One part failing undoes what the parts before it wrote and tells them so:
// a restore that breaks in one module leaves every module as it was.
func TestAFailingPartRollsBackEveryPart(t *testing.T) {
	database := openDB(t)

	first := &writingPart{key: "test.first"}
	second := &writingPart{key: "test.second", fail: true}

	if err := New(database, first, second).Replace(t.Context(), backup.Document{}); err == nil {
		t.Fatal("a restore with a failing part reported success")
	}

	if written(t, database, "test.first") || written(t, database, "test.second") {
		t.Error("a part's writes survived a restore that failed")
	}

	if len(first.finished) != 1 || first.finished[0] {
		t.Errorf("the first part was finished with %v, want one call with committed=false", first.finished)
	}
}

func TestASuccessfulRestoreCommitsEveryPart(t *testing.T) {
	database := openDB(t)

	first := &writingPart{key: "test.first"}
	second := &writingPart{key: "test.second"}

	if err := New(database, first, second).Replace(t.Context(), backup.Document{}); err != nil {
		t.Fatal(err)
	}

	if !written(t, database, "test.first") || !written(t, database, "test.second") {
		t.Error("a committed restore lost a part's writes")
	}

	for name, part := range map[string]*writingPart{"first": first, "second": second} {
		if len(part.finished) != 1 || !part.finished[0] {
			t.Errorf("the %s part was finished with %v, want one call with committed=true", name, part.finished)
		}
	}
}
