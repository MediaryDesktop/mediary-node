-- +goose Up
-- +goose StatementBegin

-- What a book file says about itself — EPUB's package, FB2's header — read by the
-- prober like a video's duration. Far better evidence than the file's name: an
-- ISBN matches the book exactly, an author tells two books of one title apart.
-- Authors are kept one per line.
ALTER TABLE library_file ADD COLUMN book_title TEXT;
ALTER TABLE library_file ADD COLUMN book_authors TEXT;
ALTER TABLE library_file ADD COLUMN book_isbn TEXT;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE library_file DROP COLUMN book_isbn;
ALTER TABLE library_file DROP COLUMN book_authors;
ALTER TABLE library_file DROP COLUMN book_title;

-- +goose StatementEnd
