-- +goose Up
-- +goose StatementBegin

-- Project Gutenberg is no longer a built-in source: its catalogue was only
-- ever a cache, never backed up, and nothing reads its settings any more.
DROP TABLE IF EXISTS gutenberg_fts;
DROP TABLE IF EXISTS gutenberg_book;
DELETE FROM node_meta WHERE key IN ('books.gutenberg.enabled', 'books.gutenberg.catalog');

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

-- What was deleted is gone; there is nothing to put back.
SELECT 1;

-- +goose StatementEnd
