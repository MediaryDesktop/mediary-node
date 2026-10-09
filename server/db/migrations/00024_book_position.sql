-- +goose Up
-- +goose StatementBegin

-- Where the reader left a book file: a locator only the renderer understands — an
-- EPUB CFI, a PDF page — and how far through the book that is. Kept per file, not
-- per title: a CFI points into one file's markup and means nothing in another
-- edition of the same book.
CREATE TABLE book_position
(
    file_id    INTEGER PRIMARY KEY REFERENCES library_file (id) ON DELETE CASCADE,
    locator    TEXT    NOT NULL,
    fraction   REAL    NOT NULL CHECK (fraction >= 0 AND fraction <= 1),
    updated_at TEXT    NOT NULL
);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE book_position;

-- +goose StatementEnd
