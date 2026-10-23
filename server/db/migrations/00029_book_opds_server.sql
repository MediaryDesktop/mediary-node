-- +goose Up
-- +goose StatementBegin

-- An OPDS catalogue the user takes books from: their own Calibre-Web or Kavita,
-- or Standard Ebooks with a Patrons Circle login. Kept apart from the manga
-- servers: a catalogue of comics and one of books are set up for different
-- things. The password lives in a file of its own in the data directory, like
-- the manga servers', so a copy of the database never carries it.
CREATE TABLE book_opds_server (
    id          INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL,
    url         TEXT    NOT NULL,
    username    TEXT    NOT NULL DEFAULT '',
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
) STRICT;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE book_opds_server;

-- +goose StatementEnd
