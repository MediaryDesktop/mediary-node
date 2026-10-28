-- name: GetManualTitle :one
SELECT id, media_type, details, created_at, updated_at
FROM manual_title
WHERE id = ?;

-- name: ListManualTitles :many
SELECT id, media_type, details, created_at, updated_at
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

-- name: DeleteManualTitle :execrows
DELETE FROM manual_title
WHERE id = ?;
