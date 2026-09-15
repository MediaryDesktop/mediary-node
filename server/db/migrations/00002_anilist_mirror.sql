-- +goose Up
-- +goose StatementBegin

-- The user's own AniList account, mirrored for offline use. AniList stays the
-- source of truth: every successful fetch overwrites the row, and signing out
-- deletes all of them. One row per kind keeps a refresh a single atomic write
-- instead of thousands of per-entry upserts that could half-apply.
CREATE TABLE anilist_mirror (
    kind       TEXT    PRIMARY KEY CHECK (kind IN ('viewer', 'anime', 'manga')),
    payload    TEXT    NOT NULL,
    fetched_at INTEGER NOT NULL
) STRICT;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE anilist_mirror;

-- +goose StatementEnd
