-- name: ListTrackerEntries :many
SELECT media_ref, media_type, status, score, progress, repeat, private, notes,
       started_year, started_month, started_day,
       completed_year, completed_month, completed_day,
       created_at, updated_at
FROM tracker_entry
WHERE media_type = ?
ORDER BY updated_at DESC, media_ref;

-- name: GetTrackerEntry :one
SELECT media_ref, media_type, status, score, progress, repeat, private, notes,
       started_year, started_month, started_day,
       completed_year, completed_month, completed_day,
       created_at, updated_at
FROM tracker_entry
WHERE media_ref = ?;

-- name: UpsertTrackerEntry :exec
INSERT INTO tracker_entry (
    media_ref, media_type, status, score, progress, repeat, private, notes,
    started_year, started_month, started_day,
    completed_year, completed_month, completed_day,
    created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (media_ref) DO UPDATE SET
    media_type = excluded.media_type,
    status = excluded.status,
    score = excluded.score,
    progress = excluded.progress,
    repeat = excluded.repeat,
    private = excluded.private,
    notes = excluded.notes,
    started_year = excluded.started_year,
    started_month = excluded.started_month,
    started_day = excluded.started_day,
    completed_year = excluded.completed_year,
    completed_month = excluded.completed_month,
    completed_day = excluded.completed_day,
    updated_at = excluded.updated_at;

-- name: DeleteTrackerEntry :execrows
DELETE FROM tracker_entry
WHERE media_ref = ?;

-- name: ListCustomListMembership :many
SELECT l.id AS list_id, l.name, i.media_ref
FROM custom_list_item i
JOIN custom_list l ON l.id = i.list_id
WHERE l.media_type = ?
ORDER BY l.position, l.id, i.position;

-- name: DeleteCustomListItemsForRef :exec
DELETE FROM custom_list_item
WHERE media_ref = ?;

-- name: InsertCustomListItem :exec
INSERT INTO custom_list_item (list_id, media_ref, position, added_at)
VALUES (
    sqlc.arg(list_id),
    sqlc.arg(media_ref),
    (SELECT CAST(COALESCE(MAX(position) + 1, 0) AS INTEGER) FROM custom_list_item WHERE list_id = sqlc.arg(list_id)),
    sqlc.arg(added_at)
)
ON CONFLICT (list_id, media_ref) DO NOTHING;
