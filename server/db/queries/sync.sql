-- Queries owned by the sync module: reading the user's own data into a backup
-- snapshot and writing a snapshot back. Ordered everywhere, so an unchanged
-- state always encodes to the same bytes and the cloud can tell it is unchanged.

-- name: SnapshotTrackerEntries :many
SELECT media_ref, media_type, status, score, progress, repeat, private, notes,
       started_year, started_month, started_day,
       completed_year, completed_month, completed_day,
       created_at, updated_at
FROM tracker_entry
ORDER BY media_ref;

-- name: SnapshotCustomLists :many
SELECT id, media_type, name, position, created_at
FROM custom_list
ORDER BY id;

-- name: SnapshotCustomListItems :many
SELECT list_id, media_ref, position, added_at
FROM custom_list_item
ORDER BY list_id, position, media_ref;

-- name: SnapshotListIcons :many
SELECT list_id, icon
FROM list_icon
ORDER BY list_id;

-- name: ClearTrackerEntries :exec
DELETE FROM tracker_entry;

-- name: ClearCustomListItems :exec
DELETE FROM custom_list_item;

-- name: ClearCustomLists :exec
DELETE FROM custom_list;

-- name: ClearListIcons :exec
DELETE FROM list_icon;

-- name: RestoreTrackerEntry :exec
INSERT INTO tracker_entry (
    media_ref, media_type, status, score, progress, repeat, private, notes,
    started_year, started_month, started_day,
    completed_year, completed_month, completed_day,
    created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: RestoreCustomList :exec
-- The id is kept: items refer to it.
INSERT INTO custom_list (id, media_type, name, position, created_at)
VALUES (?, ?, ?, ?, ?);

-- name: RestoreCustomListItem :exec
INSERT INTO custom_list_item (list_id, media_ref, position, added_at)
VALUES (?, ?, ?, ?);

-- name: RestoreListIcon :exec
INSERT INTO list_icon (list_id, icon)
VALUES (?, ?);
