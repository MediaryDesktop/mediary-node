package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/db/sqlc"
)

// Repository is an address the user added to look for plugins at.
type Repository struct {
	ID      int64
	URL     string
	Name    string
	AddedAt time.Time
}

// ErrRepositoryExists is an address already added.
var ErrRepositoryExists = errors.New("the repository is already added")

func (s *Store) Repositories(ctx context.Context) ([]Repository, error) {
	rows, err := sqlc.New(s.db).ListExtensionRepositories(ctx)
	if err != nil {
		return nil, fmt.Errorf("list repositories: %w", err)
	}

	out := make([]Repository, 0, len(rows))
	for _, row := range rows {
		out = append(out, repositoryFrom(row))
	}

	return out, nil
}

func (s *Store) InsertRepository(ctx context.Context, url, name string, now time.Time) (*Repository, error) {
	row, err := sqlc.New(s.db).InsertExtensionRepository(ctx, sqlc.InsertExtensionRepositoryParams{
		Url:     url,
		Name:    name,
		AddedAt: stamp(now),
	})
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return nil, ErrRepositoryExists
		}
		return nil, fmt.Errorf("save repository: %w", err)
	}

	repo := repositoryFrom(row)

	return &repo, nil
}

func (s *Store) RenameRepository(ctx context.Context, id int64, name string) error {
	if err := sqlc.New(s.db).RenameExtensionRepository(ctx, sqlc.RenameExtensionRepositoryParams{Name: name, ID: id}); err != nil {
		return fmt.Errorf("rename repository: %w", err)
	}

	return nil
}

// DeleteRepository reports false when there was nothing to delete.
func (s *Store) DeleteRepository(ctx context.Context, id int64) (bool, error) {
	n, err := sqlc.New(s.db).DeleteExtensionRepository(ctx, id)
	if err != nil {
		return false, fmt.Errorf("delete repository: %w", err)
	}

	return n > 0, nil
}

func repositoryFrom(row sqlc.ExtensionRepository) Repository {
	added, _ := time.Parse(time.RFC3339, row.AddedAt)

	return Repository{ID: row.ID, URL: row.Url, Name: row.Name, AddedAt: added}
}
