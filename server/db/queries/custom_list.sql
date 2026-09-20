-- name: ListCustomLists :many
SELECT l.id, l.media_type, l.name, l.position, l.created_at,
       (SELECT COUNT(*) FROM custom_list_item i WHERE i.list_id = l.id) AS item_count
FROM custom_list l
ORDER BY l.media_type, l.position, l.id;

-- name: GetCustomList :one
SELECT id, media_type, name, position, created_at
FROM custom_list
WHERE id = ?;

-- name: NextCustomListPosition :one
SELECT CAST(COALESCE(MAX(position) + 1, 0) AS INTEGER) AS next_position
FROM custom_list
WHERE media_type = ?;

-- name: InsertCustomList :one
INSERT INTO custom_list (media_type, name, position, created_at)
VALUES (?, ?, ?, ?)
RETURNING id, media_type, name, position, created_at;

-- name: RenameCustomList :execrows
UPDATE custom_list
SET name = ?
WHERE id = ?;

-- name: DeleteCustomList :execrows
DELETE FROM custom_list
WHERE id = ?;

-- name: ListCustomListItems :many
SELECT list_id, media_ref, position, added_at
FROM custom_list_item
WHERE list_id = ?
ORDER BY position;
