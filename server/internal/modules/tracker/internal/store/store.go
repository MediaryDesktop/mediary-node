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

func (s *Store) ReplaceAccount(ctx context.Context, accountID int, viewer []byte, fetchedAt time.Time) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin anilist mirror reset: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	queries := sqlc.New(s.db).WithTx(tx)

	if err = queries.DeleteAniListMirror(ctx); err != nil {
		return fmt.Errorf("clear anilist mirror: %w", err)
	}

	if err = queries.DeleteAniListOutboxForOtherAccounts(ctx, int64(accountID)); err != nil {
		return fmt.Errorf("drop other accounts' pending changes: %w", err)
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

type OutboxEntry struct {
	AccountID     int
	MediaID       int
	MediaType     string
	Patch         []byte
	AllowDecrease bool
	UpdatedAt     int64
	Attempts      int
	LastError     string
}

func outboxEntryFromRow(row sqlc.AnilistOutbox) OutboxEntry {
	return OutboxEntry{
		AccountID:     int(row.AccountID),
		MediaID:       int(row.MediaID),
		MediaType:     row.MediaType,
		Patch:         []byte(row.Patch),
		AllowDecrease: row.AllowDecrease == 1,
		UpdatedAt:     row.UpdatedAt,
		Attempts:      int(row.Attempts),
		LastError:     row.LastError.String,
	}
}

func (s *Store) OutboxEntry(ctx context.Context, accountID, mediaID int) (*OutboxEntry, error) {
	row, err := sqlc.New(s.db).GetAniListOutboxEntry(ctx, sqlc.GetAniListOutboxEntryParams{
		AccountID: int64(accountID),
		MediaID:   int64(mediaID),
	})
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read pending anilist change: %w", err)
	}

	entry := outboxEntryFromRow(row)

	return &entry, nil
}

func (s *Store) Outbox(ctx context.Context, accountID int) ([]OutboxEntry, error) {
	rows, err := sqlc.New(s.db).ListAniListOutbox(ctx, int64(accountID))
	if err != nil {
		return nil, fmt.Errorf("list pending anilist changes: %w", err)
	}

	entries := make([]OutboxEntry, 0, len(rows))
	for _, row := range rows {
		entries = append(entries, outboxEntryFromRow(row))
	}

	return entries, nil
}

func (s *Store) PutOutboxEntry(ctx context.Context, entry OutboxEntry, now time.Time) error {
	allowDecrease := int64(0)
	if entry.AllowDecrease {
		allowDecrease = 1
	}

	err := sqlc.New(s.db).UpsertAniListOutboxEntry(ctx, sqlc.UpsertAniListOutboxEntryParams{
		AccountID:     int64(entry.AccountID),
		MediaID:       int64(entry.MediaID),
		MediaType:     entry.MediaType,
		Patch:         string(entry.Patch),
		AllowDecrease: allowDecrease,
		CreatedAt:     now.UnixMilli(),
		UpdatedAt:     now.UnixMilli(),
	})
	if err != nil {
		return fmt.Errorf("queue anilist change: %w", err)
	}

	return nil
}

func (s *Store) CompleteOutboxEntry(ctx context.Context, entry OutboxEntry) (bool, error) {
	deleted, err := sqlc.New(s.db).DeleteAniListOutboxEntryIfUnchanged(ctx, sqlc.DeleteAniListOutboxEntryIfUnchangedParams{
		AccountID: int64(entry.AccountID),
		MediaID:   int64(entry.MediaID),
		UpdatedAt: entry.UpdatedAt,
	})
	if err != nil {
		return false, fmt.Errorf("complete anilist change: %w", err)
	}

	return deleted > 0, nil
}

func (s *Store) FailOutboxEntry(ctx context.Context, entry OutboxEntry, reason string) error {
	err := sqlc.New(s.db).RecordAniListOutboxFailure(ctx, sqlc.RecordAniListOutboxFailureParams{
		LastError: sql.NullString{String: reason, Valid: true},
		AccountID: int64(entry.AccountID),
		MediaID:   int64(entry.MediaID),
		UpdatedAt: entry.UpdatedAt,
	})
	if err != nil {
		return fmt.Errorf("record failed anilist change: %w", err)
	}

	return nil
}

func (s *Store) ClearOutbox(ctx context.Context) error {
	if err := sqlc.New(s.db).DeleteAniListOutbox(ctx); err != nil {
		return fmt.Errorf("clear pending anilist changes: %w", err)
	}

	return nil
}
