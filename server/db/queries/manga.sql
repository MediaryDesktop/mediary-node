-- name: ListOPDSServers :many
SELECT * FROM opds_server ORDER BY name COLLATE NOCASE, id;

-- name: GetOPDSServer :one
SELECT * FROM opds_server WHERE id = ?;

-- name: CreateOPDSServer :one
INSERT INTO opds_server (name, url, username, created_at, updated_at)
VALUES (?, ?, ?, ?, ?)
RETURNING *;

-- name: UpdateOPDSServer :one
UPDATE opds_server
SET name = ?, url = ?, username = ?, updated_at = ?
WHERE id = ?
RETURNING *;

-- name: DeleteOPDSServer :execrows
DELETE FROM opds_server WHERE id = ?;

-- name: ListMangaSourceLinks :many
SELECT * FROM manga_source_link WHERE media_ref = ? ORDER BY source;

-- name: GetMangaSourceLinkBySeries :one
SELECT * FROM manga_source_link WHERE source = ? AND series_id = ? LIMIT 1;

-- name: UpsertMangaSourceLink :exec
INSERT INTO manga_source_link (media_ref, source, series_id, series_title, chosen_by, created_at)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT (media_ref, source) DO UPDATE
SET series_id = excluded.series_id,
    series_title = excluded.series_title,
    chosen_by = excluded.chosen_by,
    created_at = excluded.created_at;

-- name: DeleteMangaSourceLink :execrows
DELETE FROM manga_source_link WHERE media_ref = ? AND source = ?;

-- name: DeleteMangaSourceLinksBySource :exec
DELETE FROM manga_source_link WHERE source = ?;

-- name: EnqueueMangaDownload :one
-- A chapter already queued, running or done stays as it is; a failed or cancelled
-- one goes back in the queue.
INSERT INTO manga_download (chapter_ref, media_ref, series, title, number, source_name, root_id, state, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)
ON CONFLICT (chapter_ref) DO UPDATE
SET state = CASE WHEN manga_download.state IN ('failed', 'cancelled') THEN 'queued' ELSE manga_download.state END,
    error = CASE WHEN manga_download.state IN ('failed', 'cancelled') THEN '' ELSE manga_download.error END,
    root_id = CASE WHEN manga_download.state IN ('failed', 'cancelled') THEN excluded.root_id ELSE manga_download.root_id END,
    updated_at = excluded.updated_at
RETURNING *;

-- name: ListMangaDownloads :many
SELECT * FROM manga_download ORDER BY id DESC LIMIT ?;

-- name: GetMangaDownload :one
SELECT * FROM manga_download WHERE id = ?;

-- name: NextQueuedMangaDownload :one
SELECT * FROM manga_download WHERE state = 'queued' ORDER BY id LIMIT 1;

-- name: SetMangaDownloadState :exec
UPDATE manga_download SET state = ?, error = ?, updated_at = ? WHERE id = ?;

-- name: SetMangaDownloadTarget :exec
UPDATE manga_download SET rel_path = ?, pages_total = ?, updated_at = ? WHERE id = ?;

-- name: SetMangaDownloadProgress :exec
UPDATE manga_download SET pages_done = ?, updated_at = ? WHERE id = ?;

-- name: RequeueRunningMangaDownloads :many
UPDATE manga_download SET state = 'queued', pages_done = 0, updated_at = ?
WHERE state = 'running'
RETURNING *;

-- name: DeleteMangaDownload :execrows
DELETE FROM manga_download WHERE id = ? AND state IN ('done', 'failed', 'cancelled');

-- name: RetryMangaDownload :execrows
UPDATE manga_download SET state = 'queued', error = '', pages_done = 0, updated_at = ?
WHERE id = ? AND state IN ('failed', 'cancelled');
