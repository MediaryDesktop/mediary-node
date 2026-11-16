-- +goose Up
-- +goose StatementBegin

-- What a file holds, independent of where it is: its size and a hash of its
-- first and last mebibyte. The same file on another computer has the same key,
-- which is what lets where the user stopped in it travel in a backup. Computed
-- when something first needs it, and cleared when a scan sees the file change.
ALTER TABLE library_file ADD COLUMN content_key TEXT;

CREATE INDEX library_file_by_content_key ON library_file (content_key);

-- Where the user is in each episode or film. A matched episode is keyed by its
-- title and its number across seasons; anything else by its content key. Exactly
-- one of the two is set. Owned by the progress module.
CREATE TABLE watch_state (
    id              INTEGER PRIMARY KEY,
    media_ref       TEXT,
    episode         INTEGER,
    content_key     TEXT,

    position        REAL    NOT NULL DEFAULT 0 CHECK (position >= 0),
    duration        REAL    NOT NULL DEFAULT 0 CHECK (duration >= 0),
    watched         INTEGER NOT NULL DEFAULT 0,
    -- How many times it was watched through, and whether the current pass has
    -- been counted yet: it resets once a report comes in from before the point
    -- that counts, so a rewatch counts again and a pause near the end does not.
    watch_count     INTEGER NOT NULL DEFAULT 0 CHECK (watch_count >= 0),
    pass_counted    INTEGER NOT NULL DEFAULT 0,
    last_watched_at INTEGER,
    updated_at      INTEGER NOT NULL,

    CHECK ((media_ref IS NOT NULL AND episode IS NOT NULL AND content_key IS NULL) OR
           (media_ref IS NULL AND episode IS NULL AND content_key IS NOT NULL))
) STRICT;

CREATE UNIQUE INDEX watch_state_episode ON watch_state (media_ref, episode) WHERE media_ref IS NOT NULL;
CREATE UNIQUE INDEX watch_state_file ON watch_state (content_key) WHERE content_key IS NOT NULL;
CREATE INDEX watch_state_recent ON watch_state (updated_at);

-- Where the user is in each chapter. A matched chapter is keyed by its title and
-- its number as the source writes it ("12", "12.5"); anything else by a source
-- reference that means the same on every computer: plugin:<id>:<key>,
-- opds-url:<server address>#<entry id> or file:<content key>.
CREATE TABLE chapter_state (
    id         INTEGER PRIMARY KEY,
    media_ref  TEXT,
    chapter    TEXT,
    source_ref TEXT,

    page       INTEGER NOT NULL DEFAULT 0 CHECK (page >= 0),
    pages      INTEGER NOT NULL DEFAULT 0 CHECK (pages >= 0),
    read       INTEGER NOT NULL DEFAULT 0,
    read_at    INTEGER,
    updated_at INTEGER NOT NULL,

    CHECK ((media_ref IS NOT NULL AND chapter IS NOT NULL AND source_ref IS NULL) OR
           (media_ref IS NULL AND chapter IS NULL AND source_ref IS NOT NULL))
) STRICT;

CREATE UNIQUE INDEX chapter_state_chapter ON chapter_state (media_ref, chapter) WHERE media_ref IS NOT NULL;
CREATE UNIQUE INDEX chapter_state_source ON chapter_state (source_ref) WHERE source_ref IS NOT NULL;

-- Where the reader left each book. Keyed by the file's content, not by title: an
-- EPUB CFI points into one edition's markup and means nothing in another. Takes
-- over from book_position, whose rows the reader moves here once it can read
-- their files' keys.
CREATE TABLE book_state (
    content_key TEXT    NOT NULL PRIMARY KEY,
    media_ref   TEXT,
    locator     TEXT    NOT NULL,
    fraction    REAL    NOT NULL CHECK (fraction >= 0 AND fraction <= 1),
    updated_at  INTEGER NOT NULL
) STRICT;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE book_state;
DROP INDEX chapter_state_source;
DROP INDEX chapter_state_chapter;
DROP TABLE chapter_state;
DROP INDEX watch_state_recent;
DROP INDEX watch_state_file;
DROP INDEX watch_state_episode;
DROP TABLE watch_state;
DROP INDEX library_file_by_content_key;
ALTER TABLE library_file DROP COLUMN content_key;

-- +goose StatementEnd
