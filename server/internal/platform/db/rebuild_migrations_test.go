package db

import (
	"database/sql"
	"fmt"
	"testing"

	"github.com/pressly/goose/v3"
	"github.com/rs/zerolog"

	migrations "github.com/MediaryDesktop/mediary-node/server/db"
)

// SQLite cannot alter a CHECK constraint, so a migration that needs to
// rebuilds the table it belongs to: create the new shape, copy the rows
// across, drop the old table, rename the new one into its place. These tests
// migrate a database up to just before such a migration, seed it with rows in
// the old shape, run only that one migration, and check the rows are still
// there — unlike the tests in service packages, which always start from an
// empty, fully migrated database and would not notice a rebuild that drops
// what it was supposed to carry over.

// TestRebuild00006KeepsExistingListsAndItems covers the custom_list rebuild
// that added 'dorama' to the CHECK constraint.
func TestRebuild00006KeepsExistingListsAndItems(t *testing.T) {
	database := openTestDB(t)

	migrateUpToVersion(t, database, 6, 5) // up to 00005, the migration before the rebuild

	exec(t, database,
		`INSERT INTO custom_list (id, media_type, name, position, created_at) VALUES (1, 'series', 'Favourites', 0, 1000)`)
	exec(t, database,
		`INSERT INTO custom_list_item (list_id, media_ref, position, added_at) VALUES (1, 'tmdb:tv:1', 0, 1000)`)

	migrateUpToVersion(t, database, 6, 6) // run exactly 00006

	rows := queryRows(t, database,
		`SELECT id, media_type, name, position, created_at FROM custom_list`)
	if len(rows) != 1 || rows[0][1] != "series" || rows[0][2] != "Favourites" {
		t.Fatalf("custom_list after rebuild = %v, want the row from before the rebuild", rows)
	}

	items := queryRows(t, database,
		`SELECT list_id, media_ref, position, added_at FROM custom_list_item`)
	if len(items) != 1 || items[0][1] != "tmdb:tv:1" {
		t.Fatalf("custom_list_item after rebuild = %v, want the row from before the rebuild", items)
	}

	// The column the migration exists for actually took: a dorama list can
	// now be created, which the old CHECK constraint refused.
	exec(t, database,
		`INSERT INTO custom_list (media_type, name, position, created_at) VALUES ('dorama', 'K-Dramas', 1, 2000)`)
}

// TestRebuild00031KeepsExistingTrackerEntries covers the tracker_entry
// rebuild that let a manual anime or manga be tracked.
func TestRebuild00031KeepsExistingTrackerEntries(t *testing.T) {
	database := openTestDB(t)

	migrateUpToVersion(t, database, 31, 30) // up to 00030, the migration before the rebuild

	exec(t, database, `INSERT INTO tracker_entry (
		media_ref, media_type, status, score, progress, repeat, private, notes,
		created_at, updated_at
	) VALUES (
		'tmdb:tv:1396', 'series', 'CURRENT', 85, 3, 0, 0, 'rewatching',
		1000, 1000
	)`)

	migrateUpToVersion(t, database, 31, 31) // run exactly 00031

	rows := queryRows(t, database,
		`SELECT media_ref, media_type, status, score, notes FROM tracker_entry`)
	if len(rows) != 1 || rows[0][0] != "tmdb:tv:1396" || rows[0][4] != "rewatching" {
		t.Fatalf("tracker_entry after rebuild = %v, want the row from before the rebuild", rows)
	}

	// What the migration exists for: a manual anime can now be tracked, which
	// the old CHECK constraint refused outright.
	exec(t, database, `INSERT INTO tracker_entry (
		media_ref, media_type, status, score, progress, repeat, private, notes,
		created_at, updated_at
	) VALUES (
		'manual:abc', 'anime', 'PLANNING', 0, 0, 0, 0, '',
		2000, 2000
	)`)
}

// migrateUpToVersion runs the embedded migrations up to the one numbered
// through, asserting it exists at all — this suite breaks loudly if the
// migration it targets is ever renumbered or removed, rather than silently
// testing nothing.
func migrateUpToVersion(t *testing.T, database *sql.DB, exists, through int64) {
	t.Helper()

	goose.SetBaseFS(migrations.Migrations)
	goose.SetLogger(gooseLogger{logger: zerolog.Nop()})

	if err := goose.SetDialect("sqlite3"); err != nil {
		t.Fatalf("set dialect: %v", err)
	}

	if _, err := goose.CollectMigrations(migrations.MigrationsDir, exists-1, exists); err != nil {
		t.Fatalf("migration %d is not embedded: %v", exists, err)
	}

	if err := goose.UpToContext(t.Context(), database, migrations.MigrationsDir, through); err != nil {
		t.Fatalf("migrate to %d: %v", through, err)
	}
}

func exec(t *testing.T, database *sql.DB, query string, args ...any) {
	t.Helper()

	if _, err := database.ExecContext(t.Context(), query, args...); err != nil {
		t.Fatalf("exec %q: %v", query, err)
	}
}

// queryRows reads every row of query as strings, for a test that only needs to
// see the values survived a migration, not their exact SQLite types.
func queryRows(t *testing.T, database *sql.DB, query string) [][]string {
	t.Helper()

	rows, err := database.QueryContext(t.Context(), query)
	if err != nil {
		t.Fatalf("query %q: %v", query, err)
	}
	defer func() { _ = rows.Close() }()

	columns, err := rows.Columns()
	if err != nil {
		t.Fatalf("columns: %v", err)
	}

	var out [][]string

	for rows.Next() {
		raw := make([]any, len(columns))
		pointers := make([]any, len(columns))
		for i := range raw {
			pointers[i] = &raw[i]
		}

		if err := rows.Scan(pointers...); err != nil {
			t.Fatalf("scan: %v", err)
		}

		row := make([]string, len(columns))
		for i, v := range raw {
			row[i] = fmt.Sprint(v)
		}

		out = append(out, row)
	}

	if err := rows.Err(); err != nil {
		t.Fatalf("rows: %v", err)
	}

	return out
}
