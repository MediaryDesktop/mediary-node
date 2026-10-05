-- +goose Up
-- +goose StatementBegin

-- An OPDS catalogue the user reads from: their own Komga, Kavita or Calibre-Web.
-- The password is not here. It lives in a file of its own in the data directory,
-- like the AniList token, so a copy of the database never carries it.
CREATE TABLE opds_server (
    id          INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL,
    url         TEXT    NOT NULL,
    username    TEXT    NOT NULL DEFAULT '',
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
) STRICT;

-- Which series in a source a title is read from. Only identifiers: names and
-- chapter lists stay with the source.
CREATE TABLE manga_source_link (
    media_ref     TEXT NOT NULL,
    source        TEXT NOT NULL,
    series_id     TEXT NOT NULL,
    series_title  TEXT NOT NULL DEFAULT '',
    chosen_by     TEXT NOT NULL CHECK (chosen_by IN ('auto', 'user')),
    created_at    TEXT NOT NULL,
    PRIMARY KEY (media_ref, source)
) STRICT;

CREATE INDEX manga_source_link_series ON manga_source_link (source, series_id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX manga_source_link_series;
DROP TABLE manga_source_link;
DROP TABLE opds_server;

-- +goose StatementEnd
