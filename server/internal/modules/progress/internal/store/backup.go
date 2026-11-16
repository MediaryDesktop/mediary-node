package store

import (
	"context"
	"database/sql"
	"fmt"
	"math"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/backup"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/db/sqlc"
)

// BackupPart is the progress module's share of a backup: the state of every
// episode, chapter and book. It works only through the transaction it is
// handed, like every other part.
type BackupPart struct{}

var _ backup.Part = BackupPart{}

func (BackupPart) Snapshot(ctx context.Context, tx *sql.Tx, doc *backup.Document) error {
	q := sqlc.New(tx)

	watches, err := q.SnapshotWatchStates(ctx)
	if err != nil {
		return fmt.Errorf("read watch states: %w", err)
	}

	chapters, err := q.SnapshotChapterStates(ctx)
	if err != nil {
		return fmt.Errorf("read chapter states: %w", err)
	}

	books, err := q.SnapshotBookStates(ctx)
	if err != nil {
		return fmt.Errorf("read book states: %w", err)
	}

	doc.WatchStates = make([]backup.WatchState, 0, len(watches))
	doc.ChapterStates = make([]backup.ChapterState, 0, len(chapters))
	doc.BookStates = make([]backup.BookState, 0, len(books))

	for i := range watches {
		w := &watches[i]
		doc.WatchStates = append(doc.WatchStates, backup.WatchState{
			MediaRef: w.MediaRef.String, Episode: ptr(w.Episode), ContentKey: w.ContentKey.String,
			// Whole seconds: a fraction of one is noise the user cannot feel,
			// and it would make every snapshot differ from the last.
			Position: math.Floor(w.Position), Duration: math.Floor(w.Duration),
			Watched: w.Watched != 0, WatchCount: w.WatchCount, PassCounted: w.PassCounted != 0,
			LastWatchedAt: ptr(w.LastWatchedAt), UpdatedAt: w.UpdatedAt,
		})
	}

	for i := range chapters {
		c := &chapters[i]
		doc.ChapterStates = append(doc.ChapterStates, backup.ChapterState{
			MediaRef: c.MediaRef.String, Chapter: c.Chapter.String, SourceRef: c.SourceRef.String,
			Page: c.Page, Pages: c.Pages, Read: c.Read != 0, ReadAt: ptr(c.ReadAt), UpdatedAt: c.UpdatedAt,
		})
	}

	for _, b := range books {
		doc.BookStates = append(doc.BookStates, backup.BookState{
			ContentKey: b.ContentKey, MediaRef: b.MediaRef.String,
			Locator: b.Locator, Fraction: b.Fraction, UpdatedAt: b.UpdatedAt,
		})
	}

	return nil
}

// Restore swaps the module's state for the document's. A document older than
// format 3 has none, and restoring it clears the state as it clears everything
// else the document does not hold.
func (BackupPart) Restore(ctx context.Context, tx *sql.Tx, doc *backup.Document) (func(bool), error) {
	q := sqlc.New(tx)

	for _, clear := range []func(context.Context) error{q.ClearWatchStates, q.ClearChapterStates, q.ClearBookStates} {
		if err := clear(ctx); err != nil {
			return nil, fmt.Errorf("clear current state: %w", err)
		}
	}

	for i := range doc.WatchStates {
		w := &doc.WatchStates[i]

		if (w.ContentKey == "") == (w.MediaRef == "" || w.Episode == nil) {
			return nil, fmt.Errorf("watch state %d names its episode neither way or both", i)
		}

		params := sqlc.InsertWatchStateParams{
			Position: math.Max(w.Position, 0), Duration: math.Max(w.Duration, 0),
			Watched: flag(w.Watched), WatchCount: max(w.WatchCount, 0), PassCounted: flag(w.PassCounted),
			LastWatchedAt: null(w.LastWatchedAt), UpdatedAt: w.UpdatedAt,
		}

		if w.ContentKey != "" {
			params.ContentKey = text(w.ContentKey)
		} else {
			params.MediaRef = text(w.MediaRef)
			params.Episode = null(w.Episode)
		}

		if err := q.InsertWatchState(ctx, params); err != nil {
			return nil, fmt.Errorf("restore watch state %d: %w", i, err)
		}
	}

	for i := range doc.ChapterStates {
		c := &doc.ChapterStates[i]

		if (c.SourceRef == "") == (c.MediaRef == "" || c.Chapter == "") {
			return nil, fmt.Errorf("chapter state %d names its chapter neither way or both", i)
		}

		params := sqlc.InsertChapterStateParams{
			Page: max(c.Page, 0), Pages: max(c.Pages, 0), Read: flag(c.Read),
			ReadAt: null(c.ReadAt), UpdatedAt: c.UpdatedAt,
		}

		if c.SourceRef != "" {
			params.SourceRef = text(c.SourceRef)
		} else {
			params.MediaRef = text(c.MediaRef)
			params.Chapter = text(c.Chapter)
		}

		if err := q.InsertChapterState(ctx, params); err != nil {
			return nil, fmt.Errorf("restore chapter state %d: %w", i, err)
		}
	}

	for i := range doc.BookStates {
		b := &doc.BookStates[i]

		if err := q.UpsertBookState(ctx, sqlc.UpsertBookStateParams{
			ContentKey: b.ContentKey, MediaRef: text(b.MediaRef), Locator: b.Locator,
			Fraction: min(max(b.Fraction, 0), 1), UpdatedAt: b.UpdatedAt,
		}); err != nil {
			return nil, fmt.Errorf("restore book state %d: %w", i, err)
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
