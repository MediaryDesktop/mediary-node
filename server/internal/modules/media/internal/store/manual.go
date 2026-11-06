package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/db/sqlc"
)

type ManualTitle struct {
	ID        string
	MediaType string
	Details   []byte
	CreatedAt time.Time
	UpdatedAt time.Time

	Cover ManualCover
}

// ManualCover is the poster file the node keeps for a manual title; an empty
// File means there is none.
type ManualCover struct {
	File    string
	Color   string
	Version int64
}

func manualFrom(row sqlc.ManualTitle) ManualTitle {
	return ManualTitle{
		ID:        row.ID,
		MediaType: row.MediaType,
		Details:   []byte(row.Details),
		CreatedAt: time.UnixMilli(row.CreatedAt),
		UpdatedAt: time.UnixMilli(row.UpdatedAt),
		Cover: ManualCover{
			File:    row.CoverFile.String,
			Color:   row.CoverColor.String,
			Version: row.CoverVersion,
		},
	}
}

// SetManualCover points the title at a new poster file, or at none when file is
// empty, and moves its version on. It reports whether the title existed.
func (s *Store) SetManualCover(ctx context.Context, id, file, color string, at time.Time) (bool, error) {
	updated, err := sqlc.New(s.db).SetManualTitleCover(ctx, sqlc.SetManualTitleCoverParams{
		CoverFile:  sql.NullString{String: file, Valid: file != ""},
		CoverColor: sql.NullString{String: color, Valid: color != ""},
		UpdatedAt:  at.UnixMilli(),
		ID:         id,
	})
	if err != nil {
		return false, fmt.Errorf("set manual title %s cover: %w", id, err)
	}

	return updated > 0, nil
}

func (s *Store) ManualTitle(ctx context.Context, id string) (*ManualTitle, error) {
	row, err := sqlc.New(s.db).GetManualTitle(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read manual title %s: %w", id, err)
	}

	title := manualFrom(row)

	return &title, nil
}

func (s *Store) ManualTitles(ctx context.Context, mediaType string) ([]ManualTitle, error) {
	rows, err := sqlc.New(s.db).ListManualTitles(ctx, mediaType)
	if err != nil {
		return nil, fmt.Errorf("list manual %s titles: %w", mediaType, err)
	}

	titles := make([]ManualTitle, 0, len(rows))
	for _, row := range rows {
		titles = append(titles, manualFrom(row))
	}

	return titles, nil
}

func (s *Store) InsertManualTitle(ctx context.Context, title ManualTitle) error {
	err := sqlc.New(s.db).InsertManualTitle(ctx, sqlc.InsertManualTitleParams{
		ID:        title.ID,
		MediaType: title.MediaType,
		Details:   string(title.Details),
		CreatedAt: title.CreatedAt.UnixMilli(),
		UpdatedAt: title.UpdatedAt.UnixMilli(),
	})
	if err != nil {
		return fmt.Errorf("insert manual title %s: %w", title.ID, err)
	}

	return nil
}

// UpdateManualTitle reports whether the title existed.
func (s *Store) UpdateManualTitle(ctx context.Context, title ManualTitle) (bool, error) {
	updated, err := sqlc.New(s.db).UpdateManualTitle(ctx, sqlc.UpdateManualTitleParams{
		MediaType: title.MediaType,
		Details:   string(title.Details),
		UpdatedAt: title.UpdatedAt.UnixMilli(),
		ID:        title.ID,
	})
	if err != nil {
		return false, fmt.Errorf("update manual title %s: %w", title.ID, err)
	}

	return updated > 0, nil
}

// DeleteManualTitle reports whether the title existed.
func (s *Store) DeleteManualTitle(ctx context.Context, id string) (bool, error) {
	deleted, err := sqlc.New(s.db).DeleteManualTitle(ctx, id)
	if err != nil {
		return false, fmt.Errorf("delete manual title %s: %w", id, err)
	}

	return deleted > 0, nil
}
