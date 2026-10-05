-- +goose Up
-- +goose StatementBegin

-- Chapters the user asked to keep on disk, and how far each one got. A row
-- outlives the node: a download interrupted by a restart resumes from the queue.
CREATE TABLE manga_download (
    id           INTEGER PRIMARY KEY,
    chapter_ref  TEXT    NOT NULL UNIQUE,
    media_ref    TEXT    NOT NULL,
    series       TEXT    NOT NULL,
    title        TEXT    NOT NULL,
    number       TEXT    NOT NULL DEFAULT '',
    source_name  TEXT    NOT NULL DEFAULT '',
    root_id      INTEGER NOT NULL,
    state        TEXT    NOT NULL CHECK (state IN ('queued', 'running', 'done', 'failed', 'cancelled')),
    pages_done   INTEGER NOT NULL DEFAULT 0,
    pages_total  INTEGER NOT NULL DEFAULT 0,
    -- The file inside the root, with forward slashes, once the name is known.
    rel_path     TEXT    NOT NULL DEFAULT '',
    error        TEXT    NOT NULL DEFAULT '',
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL
) STRICT;

CREATE INDEX manga_download_state ON manga_download (state, id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX manga_download_state;
DROP TABLE manga_download;

-- +goose StatementEnd
