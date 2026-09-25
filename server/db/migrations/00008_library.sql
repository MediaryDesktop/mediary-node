-- +goose Up
-- +goose StatementBegin

-- The user's local files and what they were matched to. Everything here is
-- rebuildable from the filesystem except file_match.source = 'manual', which is
-- the one thing a rescan must never overwrite.
CREATE TABLE library_root (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    path         TEXT    NOT NULL UNIQUE,
    added_at     INTEGER NOT NULL,
    last_scan_at INTEGER
) STRICT;

-- Keyed by (root_id, rel_path) rather than the absolute path: a user who
-- remounts a drive under another letter moves the root, not the whole library.
CREATE TABLE library_file (
    id       INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    root_id  INTEGER NOT NULL REFERENCES library_root (id) ON DELETE CASCADE,
    rel_path TEXT    NOT NULL,

    -- The form the scanner recognized from the extension: a video file, a manga
    -- chapter archive, or a book document. Which title it belongs to is
    -- file_match's business, not this column's.
    kind TEXT NOT NULL CHECK (kind IN ('video', 'manga', 'book')),

    size_bytes INTEGER NOT NULL,

    -- Unix milliseconds. Seconds would make a rewrite within the same second
    -- look unchanged; nanoseconds differ between filesystems for the same file.
    mtime      INTEGER NOT NULL,
    scanned_at INTEGER NOT NULL,

    -- Set when a scan walked the root and did not find the file, cleared when it
    -- comes back. A row is never deleted just for being absent: an unplugged
    -- drive would take the user's manual matches with it.
    missing_since INTEGER,

    UNIQUE (root_id, rel_path)
) STRICT;

CREATE INDEX library_file_by_kind ON library_file (kind);
CREATE INDEX library_file_missing ON library_file (missing_since);

CREATE TABLE file_match (
    file_id   INTEGER NOT NULL PRIMARY KEY REFERENCES library_file (id) ON DELETE CASCADE,
    media_ref TEXT    NOT NULL,

    season  INTEGER,
    episode INTEGER,

    -- 0..1 similarity the matcher settled on. 'manual' rows carry 1.
    confidence REAL NOT NULL,

    -- 'manual' is a decision by the user and outranks any later 'auto' guess.
    -- Correcting the same mismatch after every scan is the most common
    -- complaint about media servers in general.
    source TEXT NOT NULL CHECK (source IN ('auto', 'manual')),

    matched_at INTEGER NOT NULL
) STRICT;

CREATE INDEX file_match_by_media ON file_match (media_ref, season, episode);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX file_match_by_media;
DROP TABLE file_match;
DROP INDEX library_file_missing;
DROP INDEX library_file_by_kind;
DROP TABLE library_file;
DROP TABLE library_root;

-- +goose StatementEnd
