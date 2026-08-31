-- Phase 0 queries, proving `task sqlc` produces compiling Go. Module queries
-- go in db/queries/<module>.sql.

-- name: GetNodeMeta :one
SELECT key, value, updated_at
FROM node_meta
WHERE key = ?;

-- name: ListNodeMeta :many
SELECT key, value, updated_at
FROM node_meta
ORDER BY key;

-- name: UpsertNodeMeta :one
INSERT INTO node_meta (key, value, updated_at)
VALUES (?, ?, unixepoch())
ON CONFLICT (key) DO UPDATE
    SET value = excluded.value,
        updated_at = unixepoch()
RETURNING key, value, updated_at;
