package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/db/sqlc"
)

const (
	StateDownloading = "downloading"
	StateImporting   = "importing"
	StateDone        = "done"
	StateFailed      = "failed"

	SourceMagnet = "magnet"
	SourceFile   = "file"
)

type Store struct {
	db *sql.DB
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
}

type Download struct {
	ID          int64
	InfoHash    string
	MediaRef    string
	Title       string
	Name        string
	RootID      int64
	RelDir      string
	Source      string
	State       string
	Imported    int
	Error       string
	CreatedAt   time.Time
	UpdatedAt   time.Time
	CompletedAt *time.Time
}

type NewDownload struct {
	InfoHash string
	MediaRef string
	Title    string
	RootID   int64
	RelDir   string
	Source   string
}

func (s *Store) Insert(ctx context.Context, in NewDownload, now time.Time) (*Download, error) {
	stamp := stampOf(now)

	row, err := sqlc.New(s.db).InsertTorrentDownload(ctx, sqlc.InsertTorrentDownloadParams{
		InfoHash:  in.InfoHash,
		MediaRef:  in.MediaRef,
		Title:     in.Title,
		RootID:    in.RootID,
		RelDir:    in.RelDir,
		Source:    in.Source,
		CreatedAt: stamp,
		UpdatedAt: stamp,
	})
	if err != nil {
		return nil, fmt.Errorf("save torrent download: %w", err)
	}

	download := downloadFrom(row)

	return &download, nil
}

func (s *Store) List(ctx context.Context, limit int) ([]Download, error) {
	rows, err := sqlc.New(s.db).ListTorrentDownloads(ctx, int64(limit))
	if err != nil {
		return nil, fmt.Errorf("list torrent downloads: %w", err)
	}

	return downloadsFrom(rows), nil
}

// Unfinished are the downloads the node still has to follow: the ones the client
// is working on and the ones whose files have not joined the library yet.
func (s *Store) Unfinished(ctx context.Context) ([]Download, error) {
	rows, err := sqlc.New(s.db).ListUnfinishedTorrentDownloads(ctx)
	if err != nil {
		return nil, fmt.Errorf("list unfinished torrent downloads: %w", err)
	}

	return downloadsFrom(rows), nil
}

// Get returns nil when there is no such download.
func (s *Store) Get(ctx context.Context, id int64) (*Download, error) {
	row, err := sqlc.New(s.db).GetTorrentDownload(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read torrent download: %w", err)
	}

	download := downloadFrom(row)

	return &download, nil
}

// ByHash returns nil when the node never added the torrent.
func (s *Store) ByHash(ctx context.Context, infoHash string) (*Download, error) {
	row, err := sqlc.New(s.db).GetTorrentDownloadByHash(ctx, infoHash)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read torrent download: %w", err)
	}

	download := downloadFrom(row)

	return &download, nil
}

func (s *Store) SetState(ctx context.Context, id int64, state, reason string, now time.Time) error {
	err := sqlc.New(s.db).SetTorrentDownloadState(ctx, sqlc.SetTorrentDownloadStateParams{
		State:     state,
		Error:     reason,
		UpdatedAt: stampOf(now),
		ID:        id,
	})
	if err != nil {
		return fmt.Errorf("save torrent download state: %w", err)
	}

	return nil
}

func (s *Store) SetName(ctx context.Context, id int64, name string, now time.Time) error {
	err := sqlc.New(s.db).SetTorrentDownloadName(ctx, sqlc.SetTorrentDownloadNameParams{
		Name:      name,
		UpdatedAt: stampOf(now),
		ID:        id,
	})
	if err != nil {
		return fmt.Errorf("save torrent name: %w", err)
	}

	return nil
}

func (s *Store) Finish(ctx context.Context, id int64, imported int, now time.Time) error {
	stamp := stampOf(now)

	err := sqlc.New(s.db).FinishTorrentDownload(ctx, sqlc.FinishTorrentDownloadParams{
		Imported:    int64(imported),
		CompletedAt: stamp,
		UpdatedAt:   stamp,
		ID:          id,
	})
	if err != nil {
		return fmt.Errorf("finish torrent download: %w", err)
	}

	return nil
}

// Delete reports false when there was no such download.
func (s *Store) Delete(ctx context.Context, id int64) (bool, error) {
	rows, err := sqlc.New(s.db).DeleteTorrentDownload(ctx, id)
	if err != nil {
		return false, fmt.Errorf("delete torrent download: %w", err)
	}

	return rows > 0, nil
}

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

func stampOf(t time.Time) string {
	return t.UTC().Format(time.RFC3339)
}

func downloadsFrom(rows []sqlc.TorrentDownload) []Download {
	downloads := make([]Download, 0, len(rows))
	for i := range rows {
		downloads = append(downloads, downloadFrom(rows[i]))
	}

	return downloads
}

func downloadFrom(row sqlc.TorrentDownload) Download {
	created, _ := time.Parse(time.RFC3339, row.CreatedAt)
	updated, _ := time.Parse(time.RFC3339, row.UpdatedAt)

	download := Download{
		ID:        row.ID,
		InfoHash:  row.InfoHash,
		MediaRef:  row.MediaRef,
		Title:     row.Title,
		Name:      row.Name,
		RootID:    row.RootID,
		RelDir:    row.RelDir,
		Source:    row.Source,
		State:     row.State,
		Imported:  int(row.Imported),
		Error:     row.Error,
		CreatedAt: created,
		UpdatedAt: updated,
	}

	if completed, err := time.Parse(time.RFC3339, row.CompletedAt); err == nil {
		download.CompletedAt = &completed
	}

	return download
}
