-- name: GetBookPosition :one
SELECT file_id, locator, fraction, updated_at
FROM book_position
WHERE file_id = ?;

-- name: UpsertBookPosition :exec
INSERT INTO book_position (file_id, locator, fraction, updated_at)
VALUES (?, ?, ?, ?)
ON CONFLICT (file_id) DO UPDATE SET locator    = excluded.locator,
                                    fraction   = excluded.fraction,
                                    updated_at = excluded.updated_at;

-- The positions kept before book_state, which the reader moves there one by
-- one as it learns their files' content keys.
-- name: ListBookPositions :many
SELECT file_id, locator, fraction, updated_at
FROM book_position
ORDER BY file_id;

-- name: DeleteBookPosition :exec
DELETE FROM book_position
WHERE file_id = ?;
