package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/db/sqlc"
)

const KindViewer = "viewer"

type Mirror struct {
	Payload   []byte
	FetchedAt time.Time
}

type Store struct {
	db *sql.DB
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) Mirror(ctx context.Context, kind string) (*Mirror, error) {
	row, err := sqlc.New(s.db).GetAniListMirror(ctx, kind)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read anilist mirror %s: %w", kind, err)
	}

	return &Mirror{Payload: []byte(row.Payload), FetchedAt: time.Unix(row.FetchedAt, 0)}, nil
}

func (s *Store) PutMirror(ctx context.Context, kind string, payload []byte, fetchedAt time.Time) error {
	err := sqlc.New(s.db).UpsertAniListMirror(ctx, sqlc.UpsertAniListMirrorParams{
		Kind:      kind,
		Payload:   string(payload),
		FetchedAt: fetchedAt.Unix(),
	})
	if err != nil {
		return fmt.Errorf("write anilist mirror %s: %w", kind, err)
	}

	return nil
}

func (s *Store) ReplaceAccount(ctx context.Context, viewer []byte, fetchedAt time.Time) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin anilist mirror reset: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	queries := sqlc.New(s.db).WithTx(tx)

	if err = queries.DeleteAniListMirror(ctx); err != nil {
		return fmt.Errorf("clear anilist mirror: %w", err)
	}

	err = queries.UpsertAniListMirror(ctx, sqlc.UpsertAniListMirrorParams{
		Kind:      KindViewer,
		Payload:   string(viewer),
		FetchedAt: fetchedAt.Unix(),
	})
	if err != nil {
		return fmt.Errorf("write anilist viewer: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit anilist mirror reset: %w", err)
	}

	return nil
}

func (s *Store) ClearMirror(ctx context.Context) error {
	if err := sqlc.New(s.db).DeleteAniListMirror(ctx); err != nil {
		return fmt.Errorf("clear anilist mirror: %w", err)
	}

	return nil
}
