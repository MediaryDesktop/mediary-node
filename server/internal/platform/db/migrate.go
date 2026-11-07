package db

import (
	"context"
	"database/sql"
	"fmt"
	"math"

	"github.com/pressly/goose/v3"
	"github.com/rs/zerolog"

	migrations "github.com/MediaryDesktop/mediary-node/server/db"
)

// backupsKept is how many pre-migration copies of the database stay on disk.
// One lets a botched migration be rolled back to; a second survives an
// interrupted migration immediately followed by another one.
const backupsKept = 2

func Migrate(ctx context.Context, database *sql.DB, logger zerolog.Logger) error {
	goose.SetBaseFS(migrations.Migrations)
	goose.SetLogger(gooseLogger{logger: logger})

	if err := goose.SetDialect("sqlite3"); err != nil {
		return fmt.Errorf("set goose dialect: %w", err)
	}

	before, err := goose.GetDBVersionContext(ctx, database)
	if err != nil {
		return fmt.Errorf("read schema version: %w", err)
	}

	latest, err := latestMigrationVersion(migrations.MigrationsDir)
	if err != nil {
		return fmt.Errorf("list migrations: %w", err)
	}

	// goose.Up finds nothing to apply above a database version it does not
	// know and returns cleanly — it does not refuse. A database this new was
	// migrated by a newer node; running an older one on it, rather than
	// updating, would write a schema that build has never seen.
	if before > latest {
		return fmt.Errorf(
			"the database is on schema version %d, newer than this build of the node knows (%d): "+
				"it was migrated by a newer version of Mediary. Update the node instead of running "+
				"an older build against it",
			before, latest,
		)
	}

	// A database at version 0 has never been migrated: it was created a moment
	// ago and holds nothing to protect.
	if before > 0 && before < latest {
		if backupErr := backupBeforeMigration(ctx, database, logger, before); backupErr != nil {
			// Losing the safety copy is not a reason to refuse an otherwise
			// legitimate migration — only to log loudly that it is unprotected.
			logger.Warn().Err(backupErr).Msg("could not copy the database before migrating; migrating anyway")
		}
	}

	if upErr := goose.UpContext(ctx, database, migrations.MigrationsDir); upErr != nil {
		return fmt.Errorf("apply migrations: %w", upErr)
	}

	after, err := goose.GetDBVersionContext(ctx, database)
	if err != nil {
		return fmt.Errorf("read schema version: %w", err)
	}

	if before != after {
		logger.Info().Int64("from", before).Int64("to", after).Msg("schema migrated")
	}

	return nil
}

// latestMigrationVersion is the highest version this build carries, whether or
// not the database has reached it yet.
func latestMigrationVersion(dir string) (int64, error) {
	found, err := goose.CollectMigrations(dir, 0, math.MaxInt64)
	if err != nil {
		return 0, err
	}

	var latest int64
	for _, m := range found {
		if m.Version > latest {
			latest = m.Version
		}
	}

	return latest, nil
}

type gooseLogger struct {
	logger zerolog.Logger
}

func (g gooseLogger) Fatalf(format string, v ...any) {
	g.logger.Error().Msgf(format, v...)
}

func (g gooseLogger) Printf(format string, v ...any) {
	g.logger.Debug().Msgf(format, v...)
}
