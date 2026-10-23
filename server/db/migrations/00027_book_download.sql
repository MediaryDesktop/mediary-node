-- +goose Up
-- +goose StatementBegin

-- Books the user asked to keep on disk, from a source of free copies, and how far
-- each one got. A row outlives the node: a download interrupted by a restart
-- resumes from the queue.
CREATE TABLE book_download (
    id           INTEGER PRIMARY KEY,
    -- The copy in its source ("gutenberg:84") and the format taken from it.
    edition_ref  TEXT    NOT NULL,
    format       TEXT    NOT NULL,
    -- The extension the file is saved with, and where the source fetches it
    -- from: written by the node from its own search, never sent by a client.
    ext          TEXT    NOT NULL,
    location     TEXT    NOT NULL DEFAULT '',
    media_ref    TEXT    NOT NULL,
    title        TEXT    NOT NULL,
    authors      TEXT    NOT NULL DEFAULT '',
    source_name  TEXT    NOT NULL DEFAULT '',
    root_id      INTEGER NOT NULL,
    state        TEXT    NOT NULL CHECK (state IN ('queued', 'running', 'done', 'failed', 'cancelled')),
    bytes_done   INTEGER NOT NULL DEFAULT 0,
    bytes_total  INTEGER NOT NULL DEFAULT 0,
    -- The file inside the root, with forward slashes, once the name is known.
    rel_path     TEXT    NOT NULL DEFAULT '',
    file_id      INTEGER NOT NULL DEFAULT 0,
    error        TEXT    NOT NULL DEFAULT '',
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL,
    UNIQUE (edition_ref, format)
) STRICT;

CREATE INDEX book_download_state ON book_download (state, id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX book_download_state;
DROP TABLE book_download;

-- +goose StatementEnd
