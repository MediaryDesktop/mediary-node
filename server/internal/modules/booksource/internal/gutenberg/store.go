package gutenberg

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/db/sqlc"
)

const (
	enabledKey = "books.gutenberg.enabled"
	stateKey   = "books.gutenberg.catalog"
)

// The search is the one query sqlc cannot check: MATCH goes on the hidden column
// named after the FTS5 table, which sqlc's schema does not have.
const searchQuery = `
SELECT b.id, b.title, b.authors, b.language
FROM gutenberg_fts AS f
JOIN gutenberg_book AS b ON b.id = f.rowid
WHERE gutenberg_fts MATCH ?
ORDER BY f.rank
LIMIT ?`

type store struct {
	db *sql.DB
}

// replace swaps the whole catalogue for books in one transaction: a search sees
// the old catalogue or the new one, never half of each.
func (s *store) replace(ctx context.Context, books []Book) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("start replacing the catalogue: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	queries := sqlc.New(s.db).WithTx(tx)

	if err = queries.ClearGutenbergBooks(ctx); err != nil {
		return fmt.Errorf("clear the catalogue: %w", err)
	}

	for i := range books {
		book := &books[i]

		err = queries.InsertGutenbergBook(ctx, sqlc.InsertGutenbergBookParams{
			ID:       book.ID,
			Title:    book.Title,
			Authors:  cut(strings.Join(book.Authors, "; "), maxAuthorsRunes),
			Language: book.Language,
		})
		if err != nil {
			return fmt.Errorf("save book %d of the catalogue: %w", book.ID, err)
		}
	}

	if err = queries.RebuildGutenbergIndex(ctx); err != nil {
		return fmt.Errorf("index the catalogue: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("save the catalogue: %w", err)
	}

	return nil
}

func (s *store) clear(ctx context.Context) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("start removing the catalogue: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	queries := sqlc.New(s.db).WithTx(tx)

	if err = queries.ClearGutenbergBooks(ctx); err != nil {
		return fmt.Errorf("remove the catalogue: %w", err)
	}
	if err = queries.RebuildGutenbergIndex(ctx); err != nil {
		return fmt.Errorf("remove the catalogue's index: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("remove the catalogue: %w", err)
	}

	return nil
}

func (s *store) count(ctx context.Context) (int64, error) {
	count, err := sqlc.New(s.db).CountGutenbergBooks(ctx)
	if err != nil {
		return 0, fmt.Errorf("count the catalogue: %w", err)
	}

	return count, nil
}

func (s *store) search(ctx context.Context, match string, limit int) ([]Book, error) {
	rows, err := s.db.QueryContext(ctx, searchQuery, match, limit)
	if err != nil {
		return nil, fmt.Errorf("search the catalogue: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var books []Book
	for rows.Next() {
		var (
			book    Book
			authors string
		)
		if err = rows.Scan(&book.ID, &book.Title, &authors, &book.Language); err != nil {
			return nil, fmt.Errorf("read the catalogue: %w", err)
		}

		if authors != "" {
			book.Authors = strings.Split(authors, "; ")
		}
		books = append(books, book)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("search the catalogue: %w", err)
	}

	return books, nil
}

func (s *store) enabled(ctx context.Context) (bool, error) {
	value, err := s.meta(ctx, enabledKey)
	if err != nil {
		return false, err
	}

	return value == "1", nil
}

func (s *store) setEnabled(ctx context.Context, enabled bool) error {
	value := "0"
	if enabled {
		value = "1"
	}

	return s.setMeta(ctx, enabledKey, value)
}

// syncState is what the node remembers of the catalogue between starts.
type syncState struct {
	// LastModified is the catalogue's, sent back to ask whether it changed.
	LastModified string `json:"last_modified,omitempty"`
	// UpdatedAt is when the node last took a new catalogue; CheckedAt, when it
	// last asked, whatever the answer.
	UpdatedAt time.Time `json:"updated_at,omitzero"`
	CheckedAt time.Time `json:"checked_at,omitzero"`
	// AttemptedAt and Error are the last try and why it failed, if it did.
	AttemptedAt time.Time `json:"attempted_at,omitzero"`
	Error       string    `json:"error,omitempty"`
}

func (s *store) syncState(ctx context.Context) (syncState, error) {
	var state syncState

	value, err := s.meta(ctx, stateKey)
	if err != nil || value == "" {
		return state, err
	}

	// A state this node cannot read is one it starts over from.
	_ = json.Unmarshal([]byte(value), &state)

	return state, nil
}

func (s *store) setSyncState(ctx context.Context, state syncState) error {
	raw, err := json.Marshal(state)
	if err != nil {
		return fmt.Errorf("encode the catalogue's state: %w", err)
	}

	return s.setMeta(ctx, stateKey, string(raw))
}

func (s *store) meta(ctx context.Context, key string) (string, error) {
	row, err := sqlc.New(s.db).GetNodeMeta(ctx, key)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("read %s: %w", key, err)
	}

	return row.Value, nil
}

func (s *store) setMeta(ctx context.Context, key, value string) error {
	if _, err := sqlc.New(s.db).UpsertNodeMeta(ctx, sqlc.UpsertNodeMetaParams{Key: key, Value: value}); err != nil {
		return fmt.Errorf("save %s: %w", key, err)
	}

	return nil
}
