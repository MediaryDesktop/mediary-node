-- name: InsertTorrentDownload :one
INSERT INTO torrent_download (info_hash, media_ref, title, root_id, rel_dir, source, choosing, episodes, state, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'downloading', ?, ?)
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

-- name: SetTorrentDownloadChoosing :exec
UPDATE torrent_download SET choosing = ?, updated_at = ? WHERE id = ?;

-- name: ListTorznabSources :many
SELECT * FROM torznab_source ORDER BY id;

-- name: GetTorznabSource :one
SELECT * FROM torznab_source WHERE id = ?;

-- name: InsertTorznabSource :one
INSERT INTO torznab_source (name, url, created_at, updated_at)
VALUES (?, ?, ?, ?)
RETURNING *;

-- name: UpdateTorznabSource :one
UPDATE torznab_source SET name = ?, url = ?, updated_at = ? WHERE id = ?
RETURNING *;

-- name: DeleteTorznabSource :execrows
DELETE FROM torznab_source WHERE id = ?;

-- name: ListTorrentDownloadEpisodes :many
SELECT episodes FROM torrent_download
WHERE media_ref = ? AND episodes IS NOT NULL AND state != 'failed';

-- name: ListTorrentRules :many
SELECT * FROM torrent_rule ORDER BY id;

-- name: GetTorrentRuleByMedia :one
SELECT * FROM torrent_rule WHERE media_ref = ?;

-- name: UpsertTorrentRule :one
INSERT INTO torrent_rule (media_ref, title, query, from_episode, enabled, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (media_ref) DO UPDATE
SET title = excluded.title,
    query = excluded.query,
    from_episode = excluded.from_episode,
    enabled = excluded.enabled,
    updated_at = excluded.updated_at
RETURNING *;

-- name: SetTorrentRuleChecked :exec
UPDATE torrent_rule SET last_checked_at = ?, last_added = ?, last_error = ? WHERE id = ?;

-- name: DeleteTorrentRule :execrows
DELETE FROM torrent_rule WHERE media_ref = ?;
