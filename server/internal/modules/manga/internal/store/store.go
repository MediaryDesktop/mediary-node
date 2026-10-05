package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/db/sqlc"
)

type Server struct {
	ID       int64
	Name     string
	URL      string
	Username string
}

type Link struct {
	MediaRef    string
	Source      string
	SeriesID    string
	SeriesTitle string
	ChosenBy    string
	CreatedAt   time.Time
}

type Store struct {
	db *sql.DB
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) Servers(ctx context.Context) ([]Server, error) {
	rows, err := sqlc.New(s.db).ListOPDSServers(ctx)
	if err != nil {
		return nil, fmt.Errorf("list opds servers: %w", err)
	}

	servers := make([]Server, 0, len(rows))
	for _, row := range rows {
		servers = append(servers, server(row))
	}

	return servers, nil
}

// Server returns nil when there is no server with the id.
func (s *Store) Server(ctx context.Context, id int64) (*Server, error) {
	row, err := sqlc.New(s.db).GetOPDSServer(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read opds server %d: %w", id, err)
	}

	out := server(row)

	return &out, nil
}

func (s *Store) CreateServer(ctx context.Context, in Server, now time.Time) (*Server, error) {
	stamp := now.UTC().Format(time.RFC3339)

	row, err := sqlc.New(s.db).CreateOPDSServer(ctx, sqlc.CreateOPDSServerParams{
		Name:      in.Name,
		Url:       in.URL,
		Username:  in.Username,
		CreatedAt: stamp,
		UpdatedAt: stamp,
	})
	if err != nil {
		return nil, fmt.Errorf("create opds server: %w", err)
	}

	out := server(row)

	return &out, nil
}

func (s *Store) UpdateServer(ctx context.Context, in Server, now time.Time) (*Server, error) {
	row, err := sqlc.New(s.db).UpdateOPDSServer(ctx, sqlc.UpdateOPDSServerParams{
		Name:      in.Name,
		Url:       in.URL,
		Username:  in.Username,
		UpdatedAt: now.UTC().Format(time.RFC3339),
		ID:        in.ID,
	})
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("update opds server %d: %w", in.ID, err)
	}

	out := server(row)

	return &out, nil
}

// DeleteServer removes the server and every title's link to it, in one go.
func (s *Store) DeleteServer(ctx context.Context, id int64, source string) (bool, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return false, fmt.Errorf("begin: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	queries := sqlc.New(tx)

	if err = queries.DeleteMangaSourceLinksBySource(ctx, source); err != nil {
		return false, fmt.Errorf("delete links to %s: %w", source, err)
	}

	deleted, err := queries.DeleteOPDSServer(ctx, id)
	if err != nil {
		return false, fmt.Errorf("delete opds server %d: %w", id, err)
	}

	if err := tx.Commit(); err != nil {
		return false, fmt.Errorf("commit: %w", err)
	}

	return deleted > 0, nil
}

func (s *Store) Links(ctx context.Context, mediaRef string) ([]Link, error) {
	rows, err := sqlc.New(s.db).ListMangaSourceLinks(ctx, mediaRef)
	if err != nil {
		return nil, fmt.Errorf("list links of %s: %w", mediaRef, err)
	}

	links := make([]Link, 0, len(rows))
	for _, row := range rows {
		links = append(links, link(row))
	}

	return links, nil
}

// LinkBySeries returns nil when no title is linked to the series.
func (s *Store) LinkBySeries(ctx context.Context, source, seriesID string) (*Link, error) {
	row, err := sqlc.New(s.db).GetMangaSourceLinkBySeries(ctx, sqlc.GetMangaSourceLinkBySeriesParams{
		Source:   source,
		SeriesID: seriesID,
	})
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read link to %s %s: %w", source, seriesID, err)
	}

	out := link(row)

	return &out, nil
}

func (s *Store) PutLink(ctx context.Context, in Link) error {
	err := sqlc.New(s.db).UpsertMangaSourceLink(ctx, sqlc.UpsertMangaSourceLinkParams{
		MediaRef:    in.MediaRef,
		Source:      in.Source,
		SeriesID:    in.SeriesID,
		SeriesTitle: in.SeriesTitle,
		ChosenBy:    in.ChosenBy,
		CreatedAt:   in.CreatedAt.UTC().Format(time.RFC3339),
	})
	if err != nil {
		return fmt.Errorf("link %s to %s: %w", in.MediaRef, in.Source, err)
	}

	return nil
}

func (s *Store) DeleteLink(ctx context.Context, mediaRef, source string) (bool, error) {
	deleted, err := sqlc.New(s.db).DeleteMangaSourceLink(ctx, sqlc.DeleteMangaSourceLinkParams{
		MediaRef: mediaRef,
		Source:   source,
	})
	if err != nil {
		return false, fmt.Errorf("unlink %s from %s: %w", mediaRef, source, err)
	}

	return deleted > 0, nil
}

func server(row sqlc.OpdsServer) Server {
	return Server{ID: row.ID, Name: row.Name, URL: row.Url, Username: row.Username}
}

func link(row sqlc.MangaSourceLink) Link {
	created, _ := time.Parse(time.RFC3339, row.CreatedAt)

	return Link{
		MediaRef:    row.MediaRef,
		Source:      row.Source,
		SeriesID:    row.SeriesID,
		SeriesTitle: row.SeriesTitle,
		ChosenBy:    row.ChosenBy,
		CreatedAt:   created,
	}
}
