package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/db/sqlc"
)

// The manual titles' share of a backup works only through the transaction it
// is handed: the backup reads and replaces every module's data in one.

// SnapshotManualTitles reads every manual title, ordered by id.
func SnapshotManualTitles(ctx context.Context, tx *sql.Tx) ([]ManualTitle, error) {
	rows, err := sqlc.New(tx).SnapshotManualTitles(ctx)
	if err != nil {
		return nil, fmt.Errorf("read manual titles: %w", err)
	}

	titles := make([]ManualTitle, 0, len(rows))
	for i := range rows {
		titles = append(titles, manualFrom(rows[i]))
	}

	return titles, nil
}

// ReplaceManualTitles removes every manual title and writes titles in their
// place, poster file names included.
func ReplaceManualTitles(ctx context.Context, tx *sql.Tx, titles []ManualTitle) error {
	q := sqlc.New(tx)

	if err := q.ClearManualTitles(ctx); err != nil {
		return fmt.Errorf("clear manual titles: %w", err)
	}

	for i := range titles {
		t := &titles[i]

		if err := q.RestoreManualTitle(ctx, sqlc.RestoreManualTitleParams{
			ID:           t.ID,
			MediaType:    t.MediaType,
			Details:      string(t.Details),
			CreatedAt:    t.CreatedAt.UnixMilli(),
			UpdatedAt:    t.UpdatedAt.UnixMilli(),
			CoverFile:    nullString(t.Cover.File),
			CoverColor:   nullString(t.Cover.Color),
			CoverVersion: t.Cover.Version,
		}); err != nil {
			return fmt.Errorf("restore manual title %s: %w", t.ID, err)
		}
	}

	return nil
}

// ManualTitleAt is the store's form of a title read from somewhere else — a
// backup — whose times are milliseconds since the epoch.
func ManualTitleAt(id, mediaType string, details []byte, createdAt, updatedAt int64, cover ManualCover) ManualTitle {
	return ManualTitle{
		ID:        id,
		MediaType: mediaType,
		Details:   details,
		CreatedAt: time.UnixMilli(createdAt),
		UpdatedAt: time.UnixMilli(updatedAt),
		Cover:     cover,
	}
}

func nullString(s string) sql.NullString {
	return sql.NullString{String: s, Valid: s != ""}
}
