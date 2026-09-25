-- +goose Up
-- +goose StatementBegin

-- What the file's name says, cached next to the file. Derived data, but a rescan
-- deliberately does not touch a file whose size and mtime are unchanged, so
-- re-parsing on every request would be the only alternative — and the unmatched
-- list needs a readable title for every file it shows.
ALTER TABLE library_file ADD COLUMN media_form TEXT
    CHECK (media_form IN ('series', 'movie', 'special', 'extra', 'manga', 'book'));

ALTER TABLE library_file ADD COLUMN parsed_title TEXT;
ALTER TABLE library_file ADD COLUMN parsed_year INTEGER;
ALTER TABLE library_file ADD COLUMN parsed_season INTEGER;
ALTER TABLE library_file ADD COLUMN parsed_episode INTEGER;
ALTER TABLE library_file ADD COLUMN parsed_chapter INTEGER;
ALTER TABLE library_file ADD COLUMN parsed_volume INTEGER;

-- Which build of the parser produced the row above. A scan re-parses rows left
-- by an older one without re-reading the files: an improved parser that never
-- reaches the existing library is worth nothing.
ALTER TABLE library_file ADD COLUMN parser_version INTEGER NOT NULL DEFAULT 0;

CREATE INDEX library_file_by_parsed_title ON library_file (parsed_title);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX library_file_by_parsed_title;

-- SQLite refuses to drop a column named in a CHECK constraint, so going back
-- means rebuilding the table.
CREATE TABLE library_file_rebuilt (
    id            INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    root_id       INTEGER NOT NULL REFERENCES library_root (id) ON DELETE CASCADE,
    rel_path      TEXT    NOT NULL,
    kind          TEXT    NOT NULL CHECK (kind IN ('video', 'manga', 'book')),
    size_bytes    INTEGER NOT NULL,
    mtime         INTEGER NOT NULL,
    scanned_at    INTEGER NOT NULL,
    missing_since INTEGER,
    UNIQUE (root_id, rel_path)
) STRICT;

INSERT INTO library_file_rebuilt (id, root_id, rel_path, kind, size_bytes, mtime, scanned_at, missing_since)
SELECT id, root_id, rel_path, kind, size_bytes, mtime, scanned_at, missing_since FROM library_file;

DROP INDEX library_file_missing;
DROP INDEX library_file_by_kind;
DROP TABLE library_file;

ALTER TABLE library_file_rebuilt RENAME TO library_file;

CREATE INDEX library_file_by_kind ON library_file (kind);
CREATE INDEX library_file_missing ON library_file (missing_since);

-- +goose StatementEnd
