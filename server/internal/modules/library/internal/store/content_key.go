package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/db/sqlc"
)

// ContentFile is what computing a file's content key needs: where it is, how
// big the scan found it, and the key if one is already kept.
type ContentFile struct {
	RootPath string
	RelPath  string
	Size     int64
	Key      string
	Missing  bool
}

// ContentFile is nil for a file the library does not have.
func (s *Store) ContentFile(ctx context.Context, id int64) (*ContentFile, error) {
	row, err := sqlc.New(s.db).GetLibraryFileContentKey(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read content key of file %d: %w", id, err)
	}

	return &ContentFile{
		RootPath: row.RootPath,
		RelPath:  row.RelPath,
		Size:     row.SizeBytes,
		Key:      row.ContentKey.String,
		Missing:  row.MissingSince.Valid,
	}, nil
}

// SetContentKey keeps a computed key — unless the file's row changed size in
// the meantime, when the key belongs to a file that is no longer there.
func (s *Store) SetContentKey(ctx context.Context, id, size int64, key string) error {
	err := sqlc.New(s.db).SetLibraryFileContentKey(ctx, sqlc.SetLibraryFileContentKeyParams{
		ContentKey: sql.NullString{String: key, Valid: key != ""},
		ID:         id,
		SizeBytes:  size,
	})
	if err != nil {
		return fmt.Errorf("store content key of file %d: %w", id, err)
	}

	return nil
}
