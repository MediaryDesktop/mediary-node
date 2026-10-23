-- +goose Up
-- +goose StatementBegin

-- Project Gutenberg's catalogue, as its weekly offline file has it, so a search
-- never asks the site: Gutenberg allows its catalogue to be downloaded and
-- forbids automated searches. A cache of the source, not the user's data — it
-- is not backed up and is downloaded again when the source is turned on.
CREATE TABLE gutenberg_book (
    -- The book's number, Text# in the catalogue.
    id       INTEGER PRIMARY KEY,
    title    TEXT    NOT NULL,
    -- Its authors as people read them ("Mary Wollstonecraft Shelley"), split by
    -- "; "; translators, illustrators and editors are left out.
    authors  TEXT    NOT NULL,
    -- Language codes as the catalogue has them: "en", "en; fr".
    language TEXT    NOT NULL
) STRICT;

-- The search: title and authors, accents folded so "Bronte" finds "Brontë".
CREATE VIRTUAL TABLE gutenberg_fts USING fts5(
    title,
    authors,
    content = 'gutenberg_book',
    content_rowid = 'id',
    tokenize = 'unicode61 remove_diacritics 2'
);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE gutenberg_fts;
DROP TABLE gutenberg_book;

-- +goose StatementEnd
