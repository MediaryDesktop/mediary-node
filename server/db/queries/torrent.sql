-- name: InsertTorrentDownload :one
INSERT INTO torrent_download (info_hash, media_ref, title, root_id, rel_dir, source, state, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, 'downloading', ?, ?)
RETURNING *;

-- name: ListTorrentDownloads :many
SELECT * FROM torrent_download ORDER BY id DESC LIMIT ?;

-- name: ListUnfinishedTorrentDownloads :many
SELECT * FROM torrent_download WHERE state IN ('downloading', 'importing') ORDER BY id;

-- name: GetTorrentDownload :one
SELECT * FROM torrent_download WHERE id = ?;

-- name: GetTorrentDownloadByHash :one
SELECT * FROM torrent_download WHERE info_hash = ?;

-- name: SetTorrentDownloadState :exec
UPDATE torrent_download SET state = ?, error = ?, updated_at = ? WHERE id = ?;

-- name: SetTorrentDownloadName :exec
UPDATE torrent_download SET name = ?, updated_at = ? WHERE id = ?;

-- name: FinishTorrentDownload :exec
UPDATE torrent_download
SET state = 'done', error = '', imported = ?, completed_at = ?, updated_at = ?
WHERE id = ?;

-- name: DeleteTorrentDownload :execrows
DELETE FROM torrent_download WHERE id = ?;
