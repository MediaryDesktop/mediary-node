-- +goose Up
-- +goose StatementBegin

-- The user's own list for the media types this node owns: movies, series,
-- doramas and later books. Anime and manga are absent on purpose — they live in
-- the AniList account, and a copy here would be the competing tracker AniList's
-- terms forbid. The shape is AniList's, so the client edits both alike.
--
-- Only the user's data and the title's reference: names and posters stay in
-- source_cache, under the source's age limit.
CREATE TABLE tracker_entry (
    media_ref  TEXT    NOT NULL PRIMARY KEY,
    media_type TEXT    NOT NULL CHECK (media_type IN ('movie', 'series', 'dorama', 'book')),
    status     TEXT    NOT NULL CHECK (status IN ('CURRENT', 'PLANNING', 'COMPLETED', 'DROPPED', 'PAUSED', 'REPEATING')),

    -- 0 means unscored, as on AniList; otherwise 1..100.
    score    INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
    repeat   INTEGER NOT NULL DEFAULT 0 CHECK (repeat >= 0),
    private  INTEGER NOT NULL DEFAULT 0,
    notes    TEXT    NOT NULL DEFAULT '',

    -- A date may be known only to the year or the month, as on AniList.
    started_year    INTEGER,
    started_month   INTEGER,
    started_day     INTEGER,
    completed_year  INTEGER,
    completed_month INTEGER,
    completed_day   INTEGER,

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
) STRICT;

CREATE INDEX tracker_entry_by_type ON tracker_entry (media_type, updated_at);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX tracker_entry_by_type;
DROP TABLE tracker_entry;

-- +goose StatementEnd
