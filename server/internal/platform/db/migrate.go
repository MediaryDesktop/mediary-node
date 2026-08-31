package db

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/pressly/goose/v3"
	"github.com/rs/zerolog"

	migrations "github.com/mediaryorg/mediary-node/server/db"
)

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

type gooseLogger struct {
	logger zerolog.Logger
}

func (g gooseLogger) Fatalf(format string, v ...any) {
	g.logger.Error().Msgf(format, v...)
}

func (g gooseLogger) Printf(format string, v ...any) {
	g.logger.Debug().Msgf(format, v...)
}
