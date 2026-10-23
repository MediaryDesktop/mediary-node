-- name: ClearGutenbergBooks :exec
DELETE FROM gutenberg_book;

-- name: InsertGutenbergBook :exec
INSERT INTO gutenberg_book (id, title, authors, language)
VALUES (?, ?, ?, ?);

-- name: CountGutenbergBooks :one
SELECT COUNT(*) FROM gutenberg_book;

-- The search index follows the table only when rebuilt: rows are replaced all
-- at once, a catalogue at a time.
-- name: RebuildGutenbergIndex :exec
INSERT INTO gutenberg_fts (gutenberg_fts) VALUES ('rebuild');
