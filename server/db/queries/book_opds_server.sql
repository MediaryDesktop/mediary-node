-- name: ListBookOPDSServers :many
SELECT * FROM book_opds_server ORDER BY name COLLATE NOCASE, id;

-- name: GetBookOPDSServer :one
SELECT * FROM book_opds_server WHERE id = ?;

-- name: CreateBookOPDSServer :one
INSERT INTO book_opds_server (name, url, username, created_at, updated_at)
VALUES (?, ?, ?, ?, ?)
RETURNING *;

-- name: UpdateBookOPDSServer :one
UPDATE book_opds_server
SET name = ?, url = ?, username = ?, updated_at = ?
WHERE id = ?
RETURNING *;

-- name: DeleteBookOPDSServer :execrows
DELETE FROM book_opds_server WHERE id = ?;
