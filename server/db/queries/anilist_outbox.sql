-- name: GetAniListOutboxEntry :one
SELECT account_id, media_id, media_type, patch, allow_decrease, created_at, updated_at, attempts, last_error
FROM anilist_outbox
WHERE account_id = ? AND media_id = ?;

-- name: ListAniListOutbox :many
SELECT account_id, media_id, media_type, patch, allow_decrease, created_at, updated_at, attempts, last_error
FROM anilist_outbox
WHERE account_id = ?
ORDER BY updated_at;

-- name: UpsertAniListOutboxEntry :exec
INSERT INTO anilist_outbox (account_id, media_id, media_type, patch, allow_decrease, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (account_id, media_id) DO UPDATE
    SET media_type = excluded.media_type,
        patch = excluded.patch,
        allow_decrease = excluded.allow_decrease,
        updated_at = excluded.updated_at,
        attempts = 0,
        last_error = NULL;

-- name: DeleteAniListOutboxEntryIfUnchanged :execrows
DELETE FROM anilist_outbox
WHERE account_id = ? AND media_id = ? AND updated_at = ?;

-- name: RecordAniListOutboxFailure :exec
UPDATE anilist_outbox
SET attempts = attempts + 1,
    last_error = ?
WHERE account_id = ? AND media_id = ? AND updated_at = ?;

-- name: DeleteAniListOutboxForOtherAccounts :exec
DELETE FROM anilist_outbox
WHERE account_id <> ?;

-- name: DeleteAniListOutbox :exec
DELETE FROM anilist_outbox;
