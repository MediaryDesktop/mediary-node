package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/db/sqlc"
)

// Meta reads one of the module's settings from node_meta. It reports false when
// the setting was never saved.
func (s *Store) Meta(ctx context.Context, key string) (value string, found bool, err error) {
	row, err := sqlc.New(s.db).GetNodeMeta(ctx, key)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("read setting %s: %w", key, err)
	}

	return row.Value, true, nil
}

func (s *Store) SetMeta(ctx context.Context, key, value string) error {
	if _, err := sqlc.New(s.db).UpsertNodeMeta(ctx, sqlc.UpsertNodeMetaParams{Key: key, Value: value}); err != nil {
		return fmt.Errorf("save setting %s: %w", key, err)
	}

	return nil
}
