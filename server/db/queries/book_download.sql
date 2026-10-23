-- name: EnqueueBookDownload :one
-- A copy already queued, running or saved stays as it is; a failed or cancelled
-- one goes back in the queue.
INSERT INTO book_download (edition_ref, format, ext, location, media_ref, title, authors, source_name, root_id, bytes_total, state, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)
ON CONFLICT (edition_ref, format) DO UPDATE
SET state = CASE WHEN book_download.state IN ('failed', 'cancelled') THEN 'queued' ELSE book_download.state END,
    error = CASE WHEN book_download.state IN ('failed', 'cancelled') THEN '' ELSE book_download.error END,
    root_id = CASE WHEN book_download.state IN ('failed', 'cancelled') THEN excluded.root_id ELSE book_download.root_id END,
    location = CASE WHEN book_download.state IN ('failed', 'cancelled') THEN excluded.location ELSE book_download.location END,
    updated_at = excluded.updated_at
RETURNING *;

-- name: ListBookDownloads :many
SELECT * FROM book_download ORDER BY id DESC LIMIT ?;

-- name: GetBookDownload :one
SELECT * FROM book_download WHERE id = ?;

-- name: NextQueuedBookDownload :one
SELECT * FROM book_download WHERE state = 'queued' ORDER BY id LIMIT 1;

-- name: SetBookDownloadState :exec
UPDATE book_download SET state = ?, error = ?, updated_at = ? WHERE id = ?;

-- name: SetBookDownloadTarget :exec
UPDATE book_download SET rel_path = ?, bytes_total = ?, updated_at = ? WHERE id = ?;

-- name: SetBookDownloadProgress :exec
UPDATE book_download SET bytes_done = ?, updated_at = ? WHERE id = ?;

-- name: SetBookDownloadFile :exec
UPDATE book_download SET file_id = ?, updated_at = ? WHERE id = ?;

-- name: RequeueRunningBookDownloads :many
UPDATE book_download SET state = 'queued', bytes_done = 0, updated_at = ?
WHERE state = 'running'
RETURNING *;

-- name: DeleteBookDownload :execrows
DELETE FROM book_download WHERE id = ? AND state IN ('done', 'failed', 'cancelled');

-- name: RetryBookDownload :execrows
UPDATE book_download SET state = 'queued', error = '', bytes_done = 0, updated_at = ?
WHERE id = ? AND state IN ('failed', 'cancelled');
