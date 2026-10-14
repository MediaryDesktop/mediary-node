package store

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/mediaryorg/mediary-node/server/internal/modules/sync/internal/snapshot"
	"github.com/mediaryorg/mediary-node/server/internal/platform/db/sqlc"
)

type Store struct {
	db *sql.DB
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) Ready() bool {
	return s != nil && s.db != nil
}

// Read takes the whole document in one transaction, so a list edited halfway
// through cannot appear with some of its items from before and some after.
func (s *Store) Read(ctx context.Context) (snapshot.Document, error) {
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return snapshot.Document{}, fmt.Errorf("begin snapshot read: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	q := sqlc.New(tx)

	entries, err := q.SnapshotTrackerEntries(ctx)
	if err != nil {
		return snapshot.Document{}, fmt.Errorf("read tracker: %w", err)
	}

	lists, err := q.SnapshotCustomLists(ctx)
	if err != nil {
		return snapshot.Document{}, fmt.Errorf("read lists: %w", err)
	}

	items, err := q.SnapshotCustomListItems(ctx)
	if err != nil {
		return snapshot.Document{}, fmt.Errorf("read list items: %w", err)
	}

	icons, err := q.SnapshotListIcons(ctx)
	if err != nil {
		return snapshot.Document{}, fmt.Errorf("read list icons: %w", err)
	}

	doc := snapshot.Document{
		TrackerEntries:  make([]snapshot.TrackerEntry, 0, len(entries)),
		CustomLists:     make([]snapshot.CustomList, 0, len(lists)),
		CustomListItems: make([]snapshot.CustomListItem, 0, len(items)),
		ListIcons:       make([]snapshot.ListIcon, 0, len(icons)),
	}

	for i := range entries {
		e := &entries[i]
		doc.TrackerEntries = append(doc.TrackerEntries, snapshot.TrackerEntry{
			MediaRef: e.MediaRef, MediaType: e.MediaType, Status: e.Status,
			Score: e.Score, Progress: e.Progress, Repeat: e.Repeat,
			Private: e.Private != 0, Notes: e.Notes,
			StartedYear: ptr(e.StartedYear), StartedMonth: ptr(e.StartedMonth), StartedDay: ptr(e.StartedDay),
			CompletedYear: ptr(e.CompletedYear), CompletedMonth: ptr(e.CompletedMonth), CompletedDay: ptr(e.CompletedDay),
			CreatedAt: e.CreatedAt, UpdatedAt: e.UpdatedAt,
		})
	}

	for _, l := range lists {
		doc.CustomLists = append(doc.CustomLists, snapshot.CustomList{
			ID: l.ID, MediaType: l.MediaType, Name: l.Name, Position: l.Position, CreatedAt: l.CreatedAt,
		})
	}

	for _, item := range items {
		doc.CustomListItems = append(doc.CustomListItems, snapshot.CustomListItem{
			ListID: item.ListID, MediaRef: item.MediaRef, Position: item.Position, AddedAt: item.AddedAt,
		})
	}

	for _, icon := range icons {
		doc.ListIcons = append(doc.ListIcons, snapshot.ListIcon{ListID: icon.ListID, Icon: icon.Icon})
	}

	return doc, tx.Commit()
}

// Replace swaps the user's data for the document's in one transaction: a
// restore that failed halfway must leave the old state, not a mix.
func (s *Store) Replace(ctx context.Context, doc snapshot.Document) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin restore: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	q := sqlc.New(tx)

	for _, clear := range []func(context.Context) error{
		q.ClearCustomListItems, q.ClearCustomLists, q.ClearListIcons, q.ClearTrackerEntries,
	} {
		if err := clear(ctx); err != nil {
			return fmt.Errorf("clear current state: %w", err)
		}
	}

	for i := range doc.TrackerEntries {
		e := &doc.TrackerEntries[i]

		var private int64
		if e.Private {
			private = 1
		}

		if err := q.RestoreTrackerEntry(ctx, sqlc.RestoreTrackerEntryParams{
			MediaRef: e.MediaRef, MediaType: e.MediaType, Status: e.Status,
			Score: e.Score, Progress: e.Progress, Repeat: e.Repeat, Private: private, Notes: e.Notes,
			StartedYear: null(e.StartedYear), StartedMonth: null(e.StartedMonth), StartedDay: null(e.StartedDay),
			CompletedYear: null(e.CompletedYear), CompletedMonth: null(e.CompletedMonth), CompletedDay: null(e.CompletedDay),
			CreatedAt: e.CreatedAt, UpdatedAt: e.UpdatedAt,
		}); err != nil {
			return fmt.Errorf("restore tracker entry %s: %w", e.MediaRef, err)
		}
	}

	for _, l := range doc.CustomLists {
		if err := q.RestoreCustomList(ctx, sqlc.RestoreCustomListParams{
			ID: l.ID, MediaType: l.MediaType, Name: l.Name, Position: l.Position, CreatedAt: l.CreatedAt,
		}); err != nil {
			return fmt.Errorf("restore list %q: %w", l.Name, err)
		}
	}

	for _, item := range doc.CustomListItems {
		if err := q.RestoreCustomListItem(ctx, sqlc.RestoreCustomListItemParams{
			ListID: item.ListID, MediaRef: item.MediaRef, Position: item.Position, AddedAt: item.AddedAt,
		}); err != nil {
			return fmt.Errorf("restore list item %s: %w", item.MediaRef, err)
		}
	}

	for _, icon := range doc.ListIcons {
		if err := q.RestoreListIcon(ctx, sqlc.RestoreListIconParams{ListID: icon.ListID, Icon: icon.Icon}); err != nil {
			return fmt.Errorf("restore list icon: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit restore: %w", err)
	}

	return nil
}

func ptr(v sql.NullInt64) *int64 {
	if !v.Valid {
		return nil
	}

	return &v.Int64
}

func null(v *int64) sql.NullInt64 {
	if v == nil {
		return sql.NullInt64{}
	}

	return sql.NullInt64{Int64: *v, Valid: true}
}
