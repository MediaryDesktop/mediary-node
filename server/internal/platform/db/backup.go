package db

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/rs/zerolog"
)

// backupBeforeMigration copies the database to a file beside it before its
// schema changes, named after the version it is leaving. A migration that
// turns out to be wrong — in this build or the next one down — then has
// something to restore from; VACUUM INTO also leaves the copy compact and
// consistent, unlike copying the file while something might still be
// writing to it.
//
// A database with no file of its own (:memory:, or a test given one that was
// never opened from disk) has nothing to copy; that is not an error.
func backupBeforeMigration(ctx context.Context, database *sql.DB, logger zerolog.Logger, before int64) error {
	path, err := mainDatabaseFile(ctx, database)
	if err != nil {
		return fmt.Errorf("find the database file: %w", err)
	}

	if path == "" {
		return nil
	}

	backup := fmt.Sprintf("%s.pre-v%d", path, before)

	if _, err := database.ExecContext(ctx, "VACUUM INTO ?", backup); err != nil {
		return fmt.Errorf("copy %s to %s: %w", path, backup, err)
	}

	logger.Info().Str("path", backup).Msg("copied the database before migrating")

	prunePreMigrationBackups(path, logger)

	return nil
}

// mainDatabaseFile is the path SQLite itself has the main database open at, or
// "" for one with no file (an in-memory database).
func mainDatabaseFile(ctx context.Context, database *sql.DB) (string, error) {
	rows, err := database.QueryContext(ctx, "PRAGMA database_list")
	if err != nil {
		return "", err
	}
	defer func() { _ = rows.Close() }()

	for rows.Next() {
		var seq int
		var name, file string

		if err := rows.Scan(&seq, &name, &file); err != nil {
			return "", err
		}

		if name == "main" {
			return file, rows.Err()
		}
	}

	return "", rows.Err()
}

// prunePreMigrationBackups keeps the backupsKept most recent pre-migration
// copies of path and removes the rest. A copy it cannot remove is left for
// next time rather than treated as a failure: an old backup lying around
// costs disk space, nothing else.
func prunePreMigrationBackups(path string, logger zerolog.Logger) {
	matches, err := filepath.Glob(path + ".pre-v*")
	if err != nil || len(matches) <= backupsKept {
		return
	}

	sort.Slice(matches, func(i, j int) bool {
		return backupVersion(matches[i]) < backupVersion(matches[j])
	})

	for _, old := range matches[:len(matches)-backupsKept] {
		if err := os.Remove(old); err != nil {
			logger.Warn().Err(err).Str("path", old).Msg("could not remove an old pre-migration backup")
		}
	}
}

func backupVersion(path string) int64 {
	_, suffix, found := strings.Cut(filepath.Base(path), ".pre-v")
	if !found {
		return 0
	}

	version, err := strconv.ParseInt(suffix, 10, 64)
	if err != nil {
		return 0
	}

	return version
}
