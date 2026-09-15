-- name: GetAniListMirror :one
SELECT kind, payload, fetched_at
FROM anilist_mirror
WHERE kind = ?;

-- name: UpsertAniListMirror :exec
INSERT INTO anilist_mirror (kind, payload, fetched_at)
VALUES (?, ?, ?)
ON CONFLICT (kind) DO UPDATE
    SET payload = excluded.payload,
        fetched_at = excluded.fetched_at;

-- name: DeleteAniListMirror :exec
DELETE FROM anilist_mirror;
