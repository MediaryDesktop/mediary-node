-- name: GetManualTitle :one
SELECT id, media_type, details, created_at, updated_at, cover_file, cover_color, cover_version
FROM manual_title
WHERE id = ?;

-- name: ListManualTitles :many
SELECT id, media_type, details, created_at, updated_at, cover_file, cover_color, cover_version
FROM manual_title
WHERE media_type = ?
ORDER BY updated_at DESC, id;

-- name: InsertManualTitle :exec
INSERT INTO manual_title (id, media_type, details, created_at, updated_at)
VALUES (?, ?, ?, ?, ?);

-- name: UpdateManualTitle :execrows
UPDATE manual_title
SET media_type = ?, details = ?, updated_at = ?
WHERE id = ?;

-- name: SetManualTitleCover :execrows
UPDATE manual_title
SET cover_file = ?, cover_color = ?, cover_version = cover_version + 1, updated_at = ?
WHERE id = ?;

-- name: DeleteManualTitle :execrows
DELETE FROM manual_title
WHERE id = ?;
