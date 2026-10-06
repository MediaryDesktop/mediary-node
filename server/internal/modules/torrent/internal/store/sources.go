package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/db/sqlc"
)

// Source is one of the user's Torznab endpoints.
type Source struct {
	ID        int64
	Name      string
	URL       string
	CreatedAt time.Time
}

func (s *Store) Sources(ctx context.Context) ([]Source, error) {
	rows, err := sqlc.New(s.db).ListTorznabSources(ctx)
	if err != nil {
		return nil, fmt.Errorf("list torznab sources: %w", err)
	}

	sources := make([]Source, 0, len(rows))
	for _, row := range rows {
		sources = append(sources, sourceFrom(row))
	}

	return sources, nil
}

// Source returns nil when there is no such source.
func (s *Store) Source(ctx context.Context, id int64) (*Source, error) {
	row, err := sqlc.New(s.db).GetTorznabSource(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read torznab source: %w", err)
	}

	source := sourceFrom(row)

	return &source, nil
}

func (s *Store) InsertSource(ctx context.Context, name, url string, now time.Time) (*Source, error) {
	stamp := stampOf(now)

	row, err := sqlc.New(s.db).InsertTorznabSource(ctx, sqlc.InsertTorznabSourceParams{
		Name:      name,
		Url:       url,
		CreatedAt: stamp,
		UpdatedAt: stamp,
	})
	if err != nil {
		return nil, fmt.Errorf("save torznab source: %w", err)
	}

	source := sourceFrom(row)

	return &source, nil
}

// UpdateSource returns nil when there is no such source.
func (s *Store) UpdateSource(ctx context.Context, id int64, name, url string, now time.Time) (*Source, error) {
	row, err := sqlc.New(s.db).UpdateTorznabSource(ctx, sqlc.UpdateTorznabSourceParams{
		Name:      name,
		Url:       url,
		UpdatedAt: stampOf(now),
		ID:        id,
	})
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("save torznab source: %w", err)
	}

	source := sourceFrom(row)

	return &source, nil
}

// DeleteSource reports false when there was no such source.
func (s *Store) DeleteSource(ctx context.Context, id int64) (bool, error) {
	rows, err := sqlc.New(s.db).DeleteTorznabSource(ctx, id)
	if err != nil {
		return false, fmt.Errorf("delete torznab source: %w", err)
	}

	return rows > 0, nil
}

func sourceFrom(row sqlc.TorznabSource) Source {
	created, _ := time.Parse(time.RFC3339, row.CreatedAt)

	return Source{ID: row.ID, Name: row.Name, URL: row.Url, CreatedAt: created}
}
