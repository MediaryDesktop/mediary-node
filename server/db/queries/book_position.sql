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
