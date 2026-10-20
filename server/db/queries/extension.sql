-- name: ListExtensions :many
SELECT * FROM extension ORDER BY id;

-- name: GetExtension :one
SELECT * FROM extension WHERE id = ?;

-- name: InsertExtension :one
INSERT INTO extension (id, manifest_url, manifest, enabled, config, installed_at, updated_at)
VALUES (?, ?, ?, 1, ?, ?, ?)
RETURNING *;

-- name: UpdateExtensionManifest :one
UPDATE extension SET manifest = ?, config = ?, updated_at = ? WHERE id = ?
RETURNING *;

-- name: UpdateExtensionSettings :one
UPDATE extension SET enabled = ?, config = ?, updated_at = ? WHERE id = ?
RETURNING *;

-- name: DeleteExtension :execrows
DELETE FROM extension WHERE id = ?;

-- name: ListExtensionRepositories :many
SELECT * FROM extension_repository ORDER BY id;

-- name: InsertExtensionRepository :one
INSERT INTO extension_repository (url, name, added_at)
VALUES (?, ?, ?)
RETURNING *;

-- name: RenameExtensionRepository :exec
UPDATE extension_repository SET name = ? WHERE id = ?;

-- name: DeleteExtensionRepository :execrows
DELETE FROM extension_repository WHERE id = ?;
