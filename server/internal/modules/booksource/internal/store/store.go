// Package store keeps the module's book downloads and the folder they go to.
package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/db/sqlc"
)

const (
	DownloadQueued    = "queued"
	DownloadRunning   = "running"
	DownloadDone      = "done"
	DownloadFailed    = "failed"
	DownloadCancelled = "cancelled"

	downloadRootKey = "books.download_root"
)

type Store struct {
	db *sql.DB
}

func New(database *sql.DB) *Store {
	return &Store{db: database}
}

type Download struct {
	ID         int64
	EditionRef string
	Format     string
	Ext        string
	Location   string
	MediaRef   string
	Title      string
	Authors    string
	SourceName string
	RootID     int64
	State      string
	BytesDone  int64
	BytesTotal int64
	RelPath    string
	FileID     int64
	Error      string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

type NewDownload struct {
	EditionRef string
	Format     string
	Ext        string
	Location   string
	MediaRef   string
	Title      string
	Authors    string
	SourceName string
	RootID     int64
	// Size is the file's size in bytes, when the source says.
	Size int64
}

func (s *Store) Enqueue(ctx context.Context, in NewDownload, now time.Time) (*Download, error) {
	stamp := stampOf(now)

	row, err := sqlc.New(s.db).EnqueueBookDownload(ctx, sqlc.EnqueueBookDownloadParams{
		EditionRef: in.EditionRef,
		Format:     in.Format,
		Ext:        in.Ext,
		Location:   in.Location,
		MediaRef:   in.MediaRef,
		Title:      in.Title,
		Authors:    in.Authors,
		SourceName: in.SourceName,
		RootID:     in.RootID,
		BytesTotal: in.Size,
		CreatedAt:  stamp,
		UpdatedAt:  stamp,
	})
	if err != nil {
		return nil, fmt.Errorf("queue %s: %w", in.EditionRef, err)
	}

	out := download(&row)

	return &out, nil
}

func (s *Store) Downloads(ctx context.Context, limit int) ([]Download, error) {
	rows, err := sqlc.New(s.db).ListBookDownloads(ctx, int64(limit))
	if err != nil {
		return nil, fmt.Errorf("list downloads: %w", err)
	}

	out := make([]Download, 0, len(rows))
	for i := range rows {
		out = append(out, download(&rows[i]))
	}

	return out, nil
}

// Download returns nil when there is no download with the id.
func (s *Store) Download(ctx context.Context, id int64) (*Download, error) {
	row, err := sqlc.New(s.db).GetBookDownload(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read download %d: %w", id, err)
	}

	out := download(&row)

	return &out, nil
}

// NextQueued returns nil when the queue is empty.
func (s *Store) NextQueued(ctx context.Context) (*Download, error) {
	row, err := sqlc.New(s.db).NextQueuedBookDownload(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read the download queue: %w", err)
	}

	out := download(&row)

	return &out, nil
}

func (s *Store) SetState(ctx context.Context, id int64, state, reason string, now time.Time) error {
	err := sqlc.New(s.db).SetBookDownloadState(ctx, sqlc.SetBookDownloadStateParams{
		State: state, Error: reason, UpdatedAt: stampOf(now), ID: id,
	})
	if err != nil {
		return fmt.Errorf("set download %d %s: %w", id, state, err)
	}

	return nil
}

func (s *Store) SetTarget(ctx context.Context, id int64, relPath string, total int64, now time.Time) error {
	err := sqlc.New(s.db).SetBookDownloadTarget(ctx, sqlc.SetBookDownloadTargetParams{
		RelPath: relPath, BytesTotal: total, UpdatedAt: stampOf(now), ID: id,
	})
	if err != nil {
		return fmt.Errorf("set download %d target: %w", id, err)
	}

	return nil
}

func (s *Store) SetProgress(ctx context.Context, id, done int64, now time.Time) error {
	err := sqlc.New(s.db).SetBookDownloadProgress(ctx, sqlc.SetBookDownloadProgressParams{
		BytesDone: done, UpdatedAt: stampOf(now), ID: id,
	})
	if err != nil {
		return fmt.Errorf("set download %d progress: %w", id, err)
	}

	return nil
}

func (s *Store) SetFile(ctx context.Context, id, fileID int64, now time.Time) error {
	err := sqlc.New(s.db).SetBookDownloadFile(ctx, sqlc.SetBookDownloadFileParams{
		FileID: fileID, UpdatedAt: stampOf(now), ID: id,
	})
	if err != nil {
		return fmt.Errorf("set download %d file: %w", id, err)
	}

	return nil
}

// RequeueRunning puts back in the queue what a stopped node left half done, and
// returns it so the caller can clear the partial files.
func (s *Store) RequeueRunning(ctx context.Context, now time.Time) ([]Download, error) {
	rows, err := sqlc.New(s.db).RequeueRunningBookDownloads(ctx, stampOf(now))
	if err != nil {
		return nil, fmt.Errorf("requeue downloads: %w", err)
	}

	out := make([]Download, 0, len(rows))
	for i := range rows {
		out = append(out, download(&rows[i]))
	}

	return out, nil
}

// DeleteFinished removes a download that is no longer queued or running.
func (s *Store) DeleteFinished(ctx context.Context, id int64) (bool, error) {
	deleted, err := sqlc.New(s.db).DeleteBookDownload(ctx, id)
	if err != nil {
		return false, fmt.Errorf("delete download %d: %w", id, err)
	}

	return deleted > 0, nil
}

// Retry puts a failed or cancelled download back in the queue.
func (s *Store) Retry(ctx context.Context, id int64, now time.Time) (bool, error) {
	retried, err := sqlc.New(s.db).RetryBookDownload(ctx, sqlc.RetryBookDownloadParams{UpdatedAt: stampOf(now), ID: id})
	if err != nil {
		return false, fmt.Errorf("retry download %d: %w", id, err)
	}

	return retried > 0, nil
}

// DownloadRoot is the library folder books go to, or 0 while none is chosen.
func (s *Store) DownloadRoot(ctx context.Context) (int64, error) {
	row, err := sqlc.New(s.db).GetNodeMeta(ctx, downloadRootKey)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("read the folder for books: %w", err)
	}

	id, err := strconv.ParseInt(row.Value, 10, 64)
	if err != nil {
		return 0, nil //nolint:nilerr // a value this node did not write means none is chosen
	}

	return id, nil
}

func (s *Store) SetDownloadRoot(ctx context.Context, rootID int64) error {
	_, err := sqlc.New(s.db).UpsertNodeMeta(ctx, sqlc.UpsertNodeMetaParams{
		Key: downloadRootKey, Value: strconv.FormatInt(rootID, 10),
	})
	if err != nil {
		return fmt.Errorf("save the folder for books: %w", err)
	}

	return nil
}

func stampOf(t time.Time) string {
	return t.UTC().Format(time.RFC3339)
}

func download(row *sqlc.BookDownload) Download {
	created, _ := time.Parse(time.RFC3339, row.CreatedAt)
	updated, _ := time.Parse(time.RFC3339, row.UpdatedAt)

	return Download{
		ID:         row.ID,
		EditionRef: row.EditionRef,
		Format:     row.Format,
		Ext:        row.Ext,
		Location:   row.Location,
		MediaRef:   row.MediaRef,
		Title:      row.Title,
		Authors:    row.Authors,
		SourceName: row.SourceName,
		RootID:     row.RootID,
		State:      row.State,
		BytesDone:  row.BytesDone,
		BytesTotal: row.BytesTotal,
		RelPath:    row.RelPath,
		FileID:     row.FileID,
		Error:      row.Error,
		CreatedAt:  created,
		UpdatedAt:  updated,
	}
}
