package store

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/backup"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/db/sqlc"
)

// BackupPart is the tracker's share of a backup: the local entries, the local
// lists, their items and their icons. It works only through the transaction
// it is handed, so the snapshot and the restore see one consistent state
// together with every other module's part.
type BackupPart struct{}

var _ backup.Part = BackupPart{}

func (BackupPart) Snapshot(ctx context.Context, tx *sql.Tx, doc *backup.Document) error {
	q := sqlc.New(tx)

	entries, err := q.SnapshotTrackerEntries(ctx)
	if err != nil {
		return fmt.Errorf("read tracker: %w", err)
	}

	lists, err := q.SnapshotCustomLists(ctx)
	if err != nil {
		return fmt.Errorf("read lists: %w", err)
	}

	items, err := q.SnapshotCustomListItems(ctx)
	if err != nil {
		return fmt.Errorf("read list items: %w", err)
	}

	icons, err := q.SnapshotListIcons(ctx)
	if err != nil {
		return fmt.Errorf("read list icons: %w", err)
	}

	doc.TrackerEntries = make([]backup.TrackerEntry, 0, len(entries))
	doc.CustomLists = make([]backup.CustomList, 0, len(lists))
	doc.CustomListItems = make([]backup.CustomListItem, 0, len(items))
	doc.ListIcons = make([]backup.ListIcon, 0, len(icons))

	for i := range entries {
		e := &entries[i]
		doc.TrackerEntries = append(doc.TrackerEntries, backup.TrackerEntry{
			MediaRef: e.MediaRef, MediaType: e.MediaType, Status: e.Status,
			Score: e.Score, Progress: e.Progress, Repeat: e.Repeat,
			Private: e.Private != 0, Notes: e.Notes,
			StartedYear: ptr(e.StartedYear), StartedMonth: ptr(e.StartedMonth), StartedDay: ptr(e.StartedDay),
			CompletedYear: ptr(e.CompletedYear), CompletedMonth: ptr(e.CompletedMonth), CompletedDay: ptr(e.CompletedDay),
			CreatedAt: e.CreatedAt, UpdatedAt: e.UpdatedAt,
		})
	}

	for _, l := range lists {
		doc.CustomLists = append(doc.CustomLists, backup.CustomList{
			ID: l.ID, MediaType: l.MediaType, Name: l.Name, Position: l.Position, CreatedAt: l.CreatedAt,
		})
	}

	for _, item := range items {
		doc.CustomListItems = append(doc.CustomListItems, backup.CustomListItem{
			ListID: item.ListID, MediaRef: item.MediaRef, Position: item.Position, AddedAt: item.AddedAt,
		})
	}

	for _, icon := range icons {
		doc.ListIcons = append(doc.ListIcons, backup.ListIcon{ListID: icon.ListID, Icon: icon.Icon})
	}

	return nil
}

// Restore swaps the tracker's data for the document's. Everything stays in
// the database, so there is nothing for finish to do.
func (BackupPart) Restore(ctx context.Context, tx *sql.Tx, doc *backup.Document) (func(bool), error) {
	q := sqlc.New(tx)

	for _, clear := range []func(context.Context) error{
		q.ClearCustomListItems, q.ClearCustomLists, q.ClearListIcons, q.ClearTrackerEntries,
	} {
		if err := clear(ctx); err != nil {
			return nil, fmt.Errorf("clear current state: %w", err)
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
			return nil, fmt.Errorf("restore tracker entry %s: %w", e.MediaRef, err)
		}
	}

	for _, l := range doc.CustomLists {
		if err := q.RestoreCustomList(ctx, sqlc.RestoreCustomListParams{
			ID: l.ID, MediaType: l.MediaType, Name: l.Name, Position: l.Position, CreatedAt: l.CreatedAt,
		}); err != nil {
			return nil, fmt.Errorf("restore list %q: %w", l.Name, err)
		}
	}

	for _, item := range doc.CustomListItems {
		if err := q.RestoreCustomListItem(ctx, sqlc.RestoreCustomListItemParams{
			ListID: item.ListID, MediaRef: item.MediaRef, Position: item.Position, AddedAt: item.AddedAt,
		}); err != nil {
			return nil, fmt.Errorf("restore list item %s: %w", item.MediaRef, err)
		}
	}

	for _, icon := range doc.ListIcons {
		if err := q.RestoreListIcon(ctx, sqlc.RestoreListIconParams{ListID: icon.ListID, Icon: icon.Icon}); err != nil {
			return nil, fmt.Errorf("restore list icon: %w", err)
		}
	}

	return func(bool) {}, nil
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
