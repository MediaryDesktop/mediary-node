package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/db/sqlc"
)

type DateParts struct {
	Year, Month, Day *int
}

// LocalEntry is one title on the user's own list for a media type the node owns.
type LocalEntry struct {
	MediaRef  string
	MediaType string
	Status    string
	Score     int
	Progress  int
	Repeat    int
	Private   bool
	Notes     string
	Started   DateParts
	Completed DateParts
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (s *Store) LocalEntries(ctx context.Context, mediaType string) ([]LocalEntry, error) {
	rows, err := sqlc.New(s.db).ListTrackerEntries(ctx, mediaType)
	if err != nil {
		return nil, fmt.Errorf("list %s entries: %w", mediaType, err)
	}

	entries := make([]LocalEntry, 0, len(rows))
	for i := range rows {
		entries = append(entries, localEntryFromRow(&rows[i]))
	}

	return entries, nil
}

func (s *Store) LocalEntry(ctx context.Context, mediaRef string) (*LocalEntry, error) {
	row, err := sqlc.New(s.db).GetTrackerEntry(ctx, mediaRef)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read entry %s: %w", mediaRef, err)
	}

	entry := localEntryFromRow(&row)

	return &entry, nil
}

// SaveLocalEntry writes the entry and, when lists is not nil, makes those lists
// the only ones the title sits in.
func (s *Store) SaveLocalEntry(ctx context.Context, entry *LocalEntry, lists []int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin entry write: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	queries := sqlc.New(s.db).WithTx(tx)

	private := int64(0)
	if entry.Private {
		private = 1
	}

	err = queries.UpsertTrackerEntry(ctx, sqlc.UpsertTrackerEntryParams{
		MediaRef:       entry.MediaRef,
		MediaType:      entry.MediaType,
		Status:         entry.Status,
		Score:          int64(entry.Score),
		Progress:       int64(entry.Progress),
		Repeat:         int64(entry.Repeat),
		Private:        private,
		Notes:          entry.Notes,
		StartedYear:    nullInt(entry.Started.Year),
		StartedMonth:   nullInt(entry.Started.Month),
		StartedDay:     nullInt(entry.Started.Day),
		CompletedYear:  nullInt(entry.Completed.Year),
		CompletedMonth: nullInt(entry.Completed.Month),
		CompletedDay:   nullInt(entry.Completed.Day),
		CreatedAt:      entry.CreatedAt.UnixMilli(),
		UpdatedAt:      entry.UpdatedAt.UnixMilli(),
	})
	if err != nil {
		return fmt.Errorf("write entry %s: %w", entry.MediaRef, err)
	}

	if lists != nil {
		if err = queries.DeleteCustomListItemsForRef(ctx, entry.MediaRef); err != nil {
			return fmt.Errorf("clear lists of %s: %w", entry.MediaRef, err)
		}

		for _, listID := range lists {
			err = queries.InsertCustomListItem(ctx, sqlc.InsertCustomListItemParams{
				ListID:   listID,
				MediaRef: entry.MediaRef,
				AddedAt:  entry.UpdatedAt.UnixMilli(),
			})
			if err != nil {
				return fmt.Errorf("add %s to list %d: %w", entry.MediaRef, listID, err)
			}
		}
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit entry write: %w", err)
	}

	return nil
}

// DeleteLocalEntry takes the title off the user's list and out of every custom
// list: a list holding a title the user removed would show it again.
func (s *Store) DeleteLocalEntry(ctx context.Context, mediaRef string) (bool, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return false, fmt.Errorf("begin entry delete: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	queries := sqlc.New(s.db).WithTx(tx)

	deleted, err := queries.DeleteTrackerEntry(ctx, mediaRef)
	if err != nil {
		return false, fmt.Errorf("delete entry %s: %w", mediaRef, err)
	}

	if err = queries.DeleteCustomListItemsForRef(ctx, mediaRef); err != nil {
		return false, fmt.Errorf("clear lists of %s: %w", mediaRef, err)
	}

	if err = tx.Commit(); err != nil {
		return false, fmt.Errorf("commit entry delete: %w", err)
	}

	return deleted > 0, nil
}

type Membership struct {
	ListID   int64
	Name     string
	MediaRef string
}

func (s *Store) ListMembership(ctx context.Context, mediaType string) ([]Membership, error) {
	rows, err := sqlc.New(s.db).ListCustomListMembership(ctx, mediaType)
	if err != nil {
		return nil, fmt.Errorf("list %s list membership: %w", mediaType, err)
	}

	members := make([]Membership, 0, len(rows))
	for _, row := range rows {
		members = append(members, Membership{ListID: row.ListID, Name: row.Name, MediaRef: row.MediaRef})
	}

	return members, nil
}

func localEntryFromRow(row *sqlc.TrackerEntry) LocalEntry {
	return LocalEntry{
		MediaRef:  row.MediaRef,
		MediaType: row.MediaType,
		Status:    row.Status,
		Score:     int(row.Score),
		Progress:  int(row.Progress),
		Repeat:    int(row.Repeat),
		Private:   row.Private != 0,
		Notes:     row.Notes,
		Started:   DateParts{Year: intOf(row.StartedYear), Month: intOf(row.StartedMonth), Day: intOf(row.StartedDay)},
		Completed: DateParts{Year: intOf(row.CompletedYear), Month: intOf(row.CompletedMonth), Day: intOf(row.CompletedDay)},
		CreatedAt: time.UnixMilli(row.CreatedAt),
		UpdatedAt: time.UnixMilli(row.UpdatedAt),
	}
}

func nullInt(value *int) sql.NullInt64 {
	if value == nil {
		return sql.NullInt64{}
	}

	return sql.NullInt64{Int64: int64(*value), Valid: true}
}

func intOf(value sql.NullInt64) *int {
	if !value.Valid {
		return nil
	}

	n := int(value.Int64)

	return &n
}
