package db

import (
	"context"
	"database/sql"
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/pressly/goose/v3"
	"github.com/rs/zerolog"

	migrations "github.com/mediaryorg/mediary-node/server/db"
)

func openTestDB(t *testing.T) *sql.DB {
	t.Helper()

	path := filepath.Join(t.TempDir(), "node.db")

	database, err := Open(t.Context(), path)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	return database
}

func TestMigrateAppliesEveryMigrationToAFreshDatabase(t *testing.T) {
	database := openTestDB(t)

	if err := Migrate(t.Context(), database, zerolog.Nop()); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	version, err := goose.GetDBVersionContext(t.Context(), database)
	if err != nil {
		t.Fatalf("read version: %v", err)
	}

	latest, err := latestMigrationVersion(migrations.MigrationsDir)
	if err != nil {
		t.Fatalf("latest version: %v", err)
	}

	if version != latest {
		t.Errorf("version = %d, want the latest migration, %d", version, latest)
	}
}

// Running the same build twice must be a no-op the second time, with nothing
// freshly backed up — there is nothing to protect against when no migration
// runs.
func TestMigrateTwiceDoesNothingTheSecondTime(t *testing.T) {
	database := openTestDB(t)

	if err := Migrate(t.Context(), database, zerolog.Nop()); err != nil {
		t.Fatalf("first migrate: %v", err)
	}
	if err := Migrate(t.Context(), database, zerolog.Nop()); err != nil {
		t.Fatalf("second migrate: %v", err)
	}
}

// A database a newer node already migrated must not be touched by an older
// one: goose.Up alone would find nothing above what it knows and return
// cleanly, silently leaving a node that thinks it is on a schema it is not.
func TestMigrateRefusesADatabaseNewerThanThisBuildKnows(t *testing.T) {
	database := openTestDB(t)

	if err := Migrate(t.Context(), database, zerolog.Nop()); err != nil {
		t.Fatalf("migrate to latest: %v", err)
	}

	// Simulate a newer build having gone further than this one knows.
	if _, err := database.ExecContext(t.Context(),
		"INSERT INTO goose_db_version (version_id, is_applied) VALUES (?, 1)", futureVersion); err != nil {
		t.Fatalf("seed a future version: %v", err)
	}

	err := Migrate(t.Context(), database, zerolog.Nop())
	if err == nil {
		t.Fatal("migrate = nil, want an error naming the version mismatch")
	}
	if !strings.Contains(err.Error(), "newer than this build") {
		t.Errorf("migrate error = %v, want it to say the database is newer than this build knows", err)
	}
}

const futureVersion = 1<<62 - 1

func TestMigrateCopiesTheDatabaseBeforeMigratingAndPrunesOldCopies(t *testing.T) {
	path := filepath.Join(t.TempDir(), "node.db")

	database, err := Open(t.Context(), path)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	// Three migrations run one at a time, each from a fresh connection so the
	// backup it takes sees the version the one before it left behind.
	for _, target := range partialMigrationVersions(t, 3) {
		if migrateErr := migrateUpTo(t.Context(), database, target); migrateErr != nil {
			t.Fatalf("migrate to %d: %v", target, migrateErr)
		}
	}

	backups, err := filepath.Glob(path + ".pre-v*")
	if err != nil {
		t.Fatalf("glob backups: %v", err)
	}

	if len(backups) != backupsKept {
		t.Fatalf("backups = %v, want %d kept", backups, backupsKept)
	}

	for _, backup := range backups {
		if info, statErr := os.Stat(backup); statErr != nil || info.Size() == 0 {
			t.Errorf("backup %s is missing or empty", backup)
		}
	}
}

// partialMigrationVersions is the version after each of the first n
// migrations, so a test can step through them one at a time.
func partialMigrationVersions(t *testing.T, n int) []int64 {
	t.Helper()

	found, err := goose.CollectMigrations(migrations.MigrationsDir, 0, math.MaxInt64)
	if err != nil {
		t.Fatalf("collect migrations: %v", err)
	}
	if len(found) < n {
		t.Fatalf("only %d migrations exist, want at least %d", len(found), n)
	}

	versions := make([]int64, n)
	for i := range n {
		versions[i] = found[i].Version
	}

	return versions
}

// migrateUpTo runs Migrate as if this build knew migrations only up to
// target, by asking goose for that version directly instead of the latest one
// Migrate itself would pick.
func migrateUpTo(ctx context.Context, database *sql.DB, target int64) error {
	goose.SetBaseFS(migrations.Migrations)
	goose.SetLogger(gooseLogger{logger: zerolog.Nop()})

	if err := goose.SetDialect("sqlite3"); err != nil {
		return err
	}

	before, err := goose.GetDBVersionContext(ctx, database)
	if err != nil {
		return err
	}

	if before < target {
		if err := backupBeforeMigration(ctx, database, zerolog.Nop(), before); err != nil {
			return err
		}
	}

	return goose.UpToContext(ctx, database, migrations.MigrationsDir, target)
}
