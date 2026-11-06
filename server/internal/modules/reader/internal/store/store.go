package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/db/sqlc"
)

// Position is where the reader left a book file.
type Position struct {
	Locator   string
	Fraction  float64
	UpdatedAt time.Time
}

type Store struct {
	db *sql.DB
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
}

// Position is nil for a book never opened.
func (s *Store) Position(ctx context.Context, fileID int64) (*Position, error) {
	row, err := sqlc.New(s.db).GetBookPosition(ctx, fileID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read book position %d: %w", fileID, err)
	}

	updated, _ := time.Parse(time.RFC3339, row.UpdatedAt)

	return &Position{Locator: row.Locator, Fraction: row.Fraction, UpdatedAt: updated}, nil
}

func (s *Store) SetPosition(ctx context.Context, fileID int64, position Position) error {
	err := sqlc.New(s.db).UpsertBookPosition(ctx, sqlc.UpsertBookPositionParams{
		FileID:    fileID,
		Locator:   position.Locator,
		Fraction:  position.Fraction,
		UpdatedAt: position.UpdatedAt.UTC().Format(time.RFC3339),
	})
	if err != nil {
		return fmt.Errorf("store book position %d: %w", fileID, err)
	}

	return nil
}
