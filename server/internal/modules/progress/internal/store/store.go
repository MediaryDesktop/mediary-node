// Package store keeps where the user is in each episode, chapter and book.
package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/db/sqlc"
)

// WatchKey names one episode or film: a title and its episode number across
// seasons, or — for a file matched to nothing, or to a title without episode
// numbers — what the file holds. Exactly one of the two is set.
type WatchKey struct {
	MediaRef   string
	Episode    int
	ContentKey string
}

// ChapterKey names one chapter: a title and the chapter's number as the source
// writes it, or a source reference that means the same on any computer.
type ChapterKey struct {
	MediaRef  string
	Chapter   string
	SourceRef string
}

type Watch struct {
	ID  int64
	Key WatchKey

	Position float64
	Duration float64
	Watched  bool

	WatchCount    int
	PassCounted   bool
	LastWatchedAt *time.Time
	UpdatedAt     time.Time
}

type Chapter struct {
	ID  int64
	Key ChapterKey

	Page   int
	Pages  int
	Read   bool
	ReadAt *time.Time

	UpdatedAt time.Time
}

type Book struct {
	ContentKey string
	MediaRef   string
	Locator    string
	Fraction   float64
	UpdatedAt  time.Time
}

type Store struct {
	db *sql.DB
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
}

// Watch is nil for an episode never played.
func (s *Store) Watch(ctx context.Context, key WatchKey) (*Watch, error) {
	q := sqlc.New(s.db)

	var (
		row sqlc.WatchState
		err error
	)

	if key.ContentKey != "" {
		row, err = q.GetWatchStateByContent(ctx, text(key.ContentKey))
	} else {
		row, err = q.GetWatchStateByEpisode(ctx, sqlc.GetWatchStateByEpisodeParams{
			MediaRef: text(key.MediaRef),
			Episode:  number(int64(key.Episode)),
		})
	}

	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read watch state: %w", err)
	}

	return watchFrom(&row), nil
}

// SaveWatch writes a state read with Watch, or a new one when its ID is zero.
func (s *Store) SaveWatch(ctx context.Context, w *Watch) error {
	q := sqlc.New(s.db)

	var err error

	if w.ID == 0 {
		params := sqlc.InsertWatchStateParams{
			Position: w.Position, Duration: w.Duration, Watched: flag(w.Watched),
			WatchCount: int64(w.WatchCount), PassCounted: flag(w.PassCounted),
			LastWatchedAt: millis(w.LastWatchedAt), UpdatedAt: w.UpdatedAt.UnixMilli(),
		}

		if w.Key.ContentKey != "" {
			params.ContentKey = text(w.Key.ContentKey)
		} else {
			params.MediaRef = text(w.Key.MediaRef)
			params.Episode = number(int64(w.Key.Episode))
		}

		err = q.InsertWatchState(ctx, params)
	} else {
		err = q.UpdateWatchState(ctx, sqlc.UpdateWatchStateParams{
			Position: w.Position, Duration: w.Duration, Watched: flag(w.Watched),
			WatchCount: int64(w.WatchCount), PassCounted: flag(w.PassCounted),
			LastWatchedAt: millis(w.LastWatchedAt), UpdatedAt: w.UpdatedAt.UnixMilli(),
			ID: w.ID,
		})
	}

	if err != nil {
		return fmt.Errorf("save watch state: %w", err)
	}

	return nil
}

// TitleWatches is every episode of a title the user has played, in order.
func (s *Store) TitleWatches(ctx context.Context, mediaRef string) ([]Watch, error) {
	rows, err := sqlc.New(s.db).ListTitleWatchStates(ctx, text(mediaRef))
	if err != nil {
		return nil, fmt.Errorf("read watch states of %s: %w", mediaRef, err)
	}

	watches := make([]Watch, 0, len(rows))
	for i := range rows {
		watches = append(watches, *watchFrom(&rows[i]))
	}

	return watches, nil
}

// Unfinished is the episodes begun and not watched through, latest first.
func (s *Store) Unfinished(ctx context.Context, limit int) ([]Watch, error) {
	rows, err := sqlc.New(s.db).ListUnfinishedWatchStates(ctx, int64(limit))
	if err != nil {
		return nil, fmt.Errorf("read unfinished episodes: %w", err)
	}

	watches := make([]Watch, 0, len(rows))
	for i := range rows {
		watches = append(watches, *watchFrom(&rows[i]))
	}

	return watches, nil
}

// Chapter is nil for a chapter never opened.
func (s *Store) Chapter(ctx context.Context, key ChapterKey) (*Chapter, error) {
	q := sqlc.New(s.db)

	var (
		row sqlc.ChapterState
		err error
	)

	if key.SourceRef != "" {
		row, err = q.GetChapterStateBySource(ctx, text(key.SourceRef))
	} else {
		row, err = q.GetChapterStateByNumber(ctx, sqlc.GetChapterStateByNumberParams{
			MediaRef: text(key.MediaRef),
			Chapter:  text(key.Chapter),
		})
	}

	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read chapter state: %w", err)
	}

	return chapterFrom(&row), nil
}

// SaveChapter writes a state read with Chapter, or a new one when its ID is zero.
func (s *Store) SaveChapter(ctx context.Context, c *Chapter) error {
	q := sqlc.New(s.db)

	var err error

	if c.ID == 0 {
		params := sqlc.InsertChapterStateParams{
			Page: int64(c.Page), Pages: int64(c.Pages), Read: flag(c.Read),
			ReadAt: millis(c.ReadAt), UpdatedAt: c.UpdatedAt.UnixMilli(),
		}

		if c.Key.SourceRef != "" {
			params.SourceRef = text(c.Key.SourceRef)
		} else {
			params.MediaRef = text(c.Key.MediaRef)
			params.Chapter = text(c.Key.Chapter)
		}

		err = q.InsertChapterState(ctx, params)
	} else {
		err = q.UpdateChapterState(ctx, sqlc.UpdateChapterStateParams{
			Page: int64(c.Page), Pages: int64(c.Pages), Read: flag(c.Read),
			ReadAt: millis(c.ReadAt), UpdatedAt: c.UpdatedAt.UnixMilli(), ID: c.ID,
		})
	}

	if err != nil {
		return fmt.Errorf("save chapter state: %w", err)
	}

	return nil
}

// TitleChapters is every chapter of a title the user has opened.
func (s *Store) TitleChapters(ctx context.Context, mediaRef string) ([]Chapter, error) {
	rows, err := sqlc.New(s.db).ListTitleChapterStates(ctx, text(mediaRef))
	if err != nil {
		return nil, fmt.Errorf("read chapter states of %s: %w", mediaRef, err)
	}

	chapters := make([]Chapter, 0, len(rows))
	for i := range rows {
		chapters = append(chapters, *chapterFrom(&rows[i]))
	}

	return chapters, nil
}

// Book is nil for a book never opened.
func (s *Store) Book(ctx context.Context, contentKey string) (*Book, error) {
	row, err := sqlc.New(s.db).GetBookState(ctx, contentKey)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read book state: %w", err)
	}

	return &Book{
		ContentKey: row.ContentKey,
		MediaRef:   row.MediaRef.String,
		Locator:    row.Locator,
		Fraction:   row.Fraction,
		UpdatedAt:  time.UnixMilli(row.UpdatedAt).UTC(),
	}, nil
}

func (s *Store) SaveBook(ctx context.Context, b *Book) error {
	err := sqlc.New(s.db).UpsertBookState(ctx, sqlc.UpsertBookStateParams{
		ContentKey: b.ContentKey,
		MediaRef:   text(b.MediaRef),
		Locator:    b.Locator,
		Fraction:   b.Fraction,
		UpdatedAt:  b.UpdatedAt.UnixMilli(),
	})
	if err != nil {
		return fmt.Errorf("save book state: %w", err)
	}

	return nil
}

func watchFrom(row *sqlc.WatchState) *Watch {
	return &Watch{
		ID: row.ID,
		Key: WatchKey{
			MediaRef:   row.MediaRef.String,
			Episode:    int(row.Episode.Int64),
			ContentKey: row.ContentKey.String,
		},
		Position:      row.Position,
		Duration:      row.Duration,
		Watched:       row.Watched != 0,
		WatchCount:    int(row.WatchCount),
		PassCounted:   row.PassCounted != 0,
		LastWatchedAt: optionalTime(row.LastWatchedAt),
		UpdatedAt:     time.UnixMilli(row.UpdatedAt).UTC(),
	}
}

func chapterFrom(row *sqlc.ChapterState) *Chapter {
	return &Chapter{
		ID: row.ID,
		Key: ChapterKey{
			MediaRef:  row.MediaRef.String,
			Chapter:   row.Chapter.String,
			SourceRef: row.SourceRef.String,
		},
		Page:      int(row.Page),
		Pages:     int(row.Pages),
		Read:      row.Read != 0,
		ReadAt:    optionalTime(row.ReadAt),
		UpdatedAt: time.UnixMilli(row.UpdatedAt).UTC(),
	}
}

func text(value string) sql.NullString {
	return sql.NullString{String: value, Valid: value != ""}
}

func number(value int64) sql.NullInt64 {
	return sql.NullInt64{Int64: value, Valid: true}
}

func flag(value bool) int64 {
	if value {
		return 1
	}

	return 0
}

func millis(at *time.Time) sql.NullInt64 {
	if at == nil {
		return sql.NullInt64{}
	}

	return sql.NullInt64{Int64: at.UnixMilli(), Valid: true}
}

func optionalTime(value sql.NullInt64) *time.Time {
	if !value.Valid {
		return nil
	}

	at := time.UnixMilli(value.Int64).UTC()

	return &at
}
