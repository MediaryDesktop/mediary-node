package store

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/mediaryorg/mediary-node/server/internal/platform/backup"
)

// Store reads and replaces the user's data for a backup without knowing a
// single table: each module that owns some of it hands in its backup.Part, and
// the store only runs them all in one transaction.
type Store struct {
	db    *sql.DB
	parts []backup.Part
}

func New(db *sql.DB, parts ...backup.Part) *Store {
	return &Store{db: db, parts: parts}
}

func (s *Store) Ready() bool {
	return s != nil && s.db != nil
}

// Read takes the whole document in one transaction, so a list edited halfway
// through cannot appear with some of its items from before and some after.
func (s *Store) Read(ctx context.Context) (backup.Document, error) {
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return backup.Document{}, fmt.Errorf("begin snapshot read: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	var doc backup.Document

	for _, part := range s.parts {
		if err := part.Snapshot(ctx, tx, &doc); err != nil {
			return backup.Document{}, err
		}
	}

	return doc, tx.Commit()
}

// Replace swaps the user's data for the document's in one transaction: a
// restore that failed halfway must leave the old state, not a mix. Each part's
// finish runs once the outcome is known, to settle what it keeps outside the
// database.
func (s *Store) Replace(ctx context.Context, doc backup.Document) (err error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin restore: %w", err)
	}

	var finishers []func(bool)
	committed := false

	defer func() {
		if !committed {
			_ = tx.Rollback()
		}

		for _, finish := range finishers {
			finish(committed)
		}
	}()

	for _, part := range s.parts {
		finish, partErr := part.Restore(ctx, tx, &doc)
		if partErr != nil {
			return partErr
		}

		finishers = append(finishers, finish)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit restore: %w", err)
	}

	committed = true

	return nil
}
