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
