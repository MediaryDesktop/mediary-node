-- +goose Up
-- +goose StatementBegin

-- Torrents the node added to the user's client, and what each was for. The client
-- knows the progress; only the node knows the title and the library folder, and
-- without them a finished download could not join the library without a guess.
CREATE TABLE torrent_download (
    id           INTEGER PRIMARY KEY,
    info_hash    TEXT    NOT NULL UNIQUE,
    media_ref    TEXT    NOT NULL,
    -- The title as the user saw it; it also names the folder inside the root.
    title        TEXT    NOT NULL,
    -- The torrent's own name, once the client has the metadata.
    name         TEXT    NOT NULL DEFAULT '',
    root_id      INTEGER NOT NULL,
    -- The folder inside the root the client saves into, with forward slashes.
    rel_dir      TEXT    NOT NULL,
    source       TEXT    NOT NULL CHECK (source IN ('magnet', 'file')),
    state        TEXT    NOT NULL CHECK (state IN ('downloading', 'importing', 'done', 'failed')),
    imported     INTEGER NOT NULL DEFAULT 0,
    error        TEXT    NOT NULL DEFAULT '',
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL,
    completed_at TEXT    NOT NULL DEFAULT ''
) STRICT;

CREATE INDEX torrent_download_state ON torrent_download (state, id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX torrent_download_state;
DROP TABLE torrent_download;

-- +goose StatementEnd
