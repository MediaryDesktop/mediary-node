-- name: GetSourceCache :one
SELECT provider, external_id, payload, fetched_at
FROM source_cache
WHERE provider = ? AND external_id = ?;

-- name: UpsertSourceCache :exec
INSERT INTO source_cache (provider, external_id, payload, fetched_at)
VALUES (?, ?, ?, ?)
ON CONFLICT (provider, external_id) DO UPDATE
    SET payload = excluded.payload,
        fetched_at = excluded.fetched_at;

-- name: DeleteSourceCacheOlderThan :exec
DELETE FROM source_cache
WHERE provider = ? AND fetched_at < ?;
