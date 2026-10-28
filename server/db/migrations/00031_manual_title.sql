-- +goose Up
-- +goose StatementBegin

-- Titles the user described themselves because no source knows them. Unlike
-- source_cache this is the user's own data: nothing ages it out.
--
-- details is the user's draft as JSON; the node builds the title page from it
-- on every read, so the shape it is shown in can change without a migration.
CREATE TABLE manual_title (
    id         TEXT    NOT NULL PRIMARY KEY,
    media_type TEXT    NOT NULL CHECK (media_type IN ('anime', 'manga', 'movie', 'series', 'dorama', 'book')),
    details    TEXT    NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
) STRICT;

CREATE INDEX manual_title_by_type ON manual_title (media_type, updated_at);

-- A manual anime or manga can be tracked on the node: it does not exist on
-- AniList, so keeping it here is not a copy of the user's AniList list. Every
-- other anime and manga still has to live there. SQLite cannot alter a CHECK
-- constraint, so the table is rebuilt; nothing references it by foreign key.
CREATE TABLE tracker_entry_rebuilt (
    media_ref  TEXT    NOT NULL PRIMARY KEY,
    media_type TEXT    NOT NULL CHECK (
        media_type IN ('movie', 'series', 'dorama', 'book')
        OR (media_type IN ('anime', 'manga') AND media_ref LIKE 'manual:%')
    ),
    status     TEXT    NOT NULL CHECK (status IN ('CURRENT', 'PLANNING', 'COMPLETED', 'DROPPED', 'PAUSED', 'REPEATING')),

    score    INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
    repeat   INTEGER NOT NULL DEFAULT 0 CHECK (repeat >= 0),
    private  INTEGER NOT NULL DEFAULT 0,
    notes    TEXT    NOT NULL DEFAULT '',

    started_year    INTEGER,
    started_month   INTEGER,
    started_day     INTEGER,
    completed_year  INTEGER,
    completed_month INTEGER,
    completed_day   INTEGER,

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
) STRICT;

INSERT INTO tracker_entry_rebuilt
SELECT media_ref, media_type, status, score, progress, repeat, private, notes,
       started_year, started_month, started_day,
       completed_year, completed_month, completed_day,
       created_at, updated_at
FROM tracker_entry;

DROP INDEX tracker_entry_by_type;
DROP TABLE tracker_entry;

ALTER TABLE tracker_entry_rebuilt RENAME TO tracker_entry;

CREATE INDEX tracker_entry_by_type ON tracker_entry (media_type, updated_at);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

CREATE TABLE tracker_entry_rebuilt (
    media_ref  TEXT    NOT NULL PRIMARY KEY,
    media_type TEXT    NOT NULL CHECK (media_type IN ('movie', 'series', 'dorama', 'book')),
    status     TEXT    NOT NULL CHECK (status IN ('CURRENT', 'PLANNING', 'COMPLETED', 'DROPPED', 'PAUSED', 'REPEATING')),

    score    INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
    repeat   INTEGER NOT NULL DEFAULT 0 CHECK (repeat >= 0),
    private  INTEGER NOT NULL DEFAULT 0,
    notes    TEXT    NOT NULL DEFAULT '',

    started_year    INTEGER,
    started_month   INTEGER,
    started_day     INTEGER,
    completed_year  INTEGER,
    completed_month INTEGER,
    completed_day   INTEGER,

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
) STRICT;

INSERT INTO tracker_entry_rebuilt
SELECT media_ref, media_type, status, score, progress, repeat, private, notes,
       started_year, started_month, started_day,
       completed_year, completed_month, completed_day,
       created_at, updated_at
FROM tracker_entry
WHERE media_type NOT IN ('anime', 'manga');

DROP INDEX tracker_entry_by_type;
DROP TABLE tracker_entry;

ALTER TABLE tracker_entry_rebuilt RENAME TO tracker_entry;

CREATE INDEX tracker_entry_by_type ON tracker_entry (media_type, updated_at);

DELETE FROM custom_list_item WHERE media_ref LIKE 'manual:%';

DROP INDEX manual_title_by_type;
DROP TABLE manual_title;

-- +goose StatementEnd
