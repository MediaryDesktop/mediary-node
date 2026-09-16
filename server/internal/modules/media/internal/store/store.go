package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/db/sqlc"
)

type Cached struct {
	Payload   []byte
	FetchedAt time.Time
}

type Store struct {
	db *sql.DB
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) Get(ctx context.Context, provider, externalID string) (*Cached, error) {
	row, err := sqlc.New(s.db).GetSourceCache(ctx, sqlc.GetSourceCacheParams{
		Provider:   provider,
		ExternalID: externalID,
	})
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read %s cache %s: %w", provider, externalID, err)
	}

	return &Cached{Payload: []byte(row.Payload), FetchedAt: time.UnixMilli(row.FetchedAt)}, nil
}

func (s *Store) Put(ctx context.Context, provider, externalID string, payload []byte, fetchedAt time.Time) error {
	err := sqlc.New(s.db).UpsertSourceCache(ctx, sqlc.UpsertSourceCacheParams{
		Provider:   provider,
		ExternalID: externalID,
		Payload:    string(payload),
		FetchedAt:  fetchedAt.UnixMilli(),
	})
	if err != nil {
		return fmt.Errorf("write %s cache %s: %w", provider, externalID, err)
	}

	return nil
}

func (s *Store) PurgeOlderThan(ctx context.Context, provider string, cutoff time.Time) error {
	err := sqlc.New(s.db).DeleteSourceCacheOlderThan(ctx, sqlc.DeleteSourceCacheOlderThanParams{
		Provider:  provider,
		FetchedAt: cutoff.UnixMilli(),
	})
	if err != nil {
		return fmt.Errorf("purge %s cache: %w", provider, err)
	}

	return nil
}
