package db

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

func Open(ctx context.Context, path string) (*sql.DB, error) {
	database, err := sql.Open("sqlite", dsn(path))
	if err != nil {
		return nil, fmt.Errorf("open sqlite %s: %w", path, err)
	}

	database.SetMaxOpenConns(4)
	database.SetMaxIdleConns(4)
	database.SetConnMaxLifetime(time.Hour)

	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if err := database.PingContext(pingCtx); err != nil {
		_ = database.Close()
		return nil, fmt.Errorf("ping sqlite %s: %w", path, err)
	}

	return database, nil
}

func dsn(path string) string {
	query := url.Values{}

	query.Add("_pragma", "journal_mode(WAL)")

	query.Add("_pragma", "busy_timeout(5000)")

	query.Add("_pragma", "foreign_keys(1)")

	query.Add("_pragma", "synchronous(NORMAL)")

	return "file:" + filepath.ToSlash(path) + "?" + query.Encode()
}
