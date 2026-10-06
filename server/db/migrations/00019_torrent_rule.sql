-- +goose Up
-- +goose StatementBegin

-- Titles whose new episodes the node downloads by itself, found by searching the
-- user's Torznab sources and picked by the release profile.
CREATE TABLE torrent_rule (
    id              INTEGER PRIMARY KEY,
    media_ref       TEXT    NOT NULL UNIQUE,
    title           TEXT    NOT NULL,
    -- Searched for instead of the title's names when not empty.
    query           TEXT    NOT NULL DEFAULT '',
    -- Episodes before this one are never downloaded by the rule.
    from_episode    INTEGER NOT NULL,
    enabled         INTEGER NOT NULL DEFAULT 1,
    last_checked_at TEXT    NOT NULL DEFAULT '',
    last_added      INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT    NOT NULL DEFAULT '',
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL
) STRICT;

-- The episodes a download was added for, as a JSON array, when it was added for
-- some: a rule must not add an episode again while the first copy is still on its
-- way, and a batch held for them gets only their files.
ALTER TABLE torrent_download ADD COLUMN episodes TEXT;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE torrent_download DROP COLUMN episodes;
DROP TABLE torrent_rule;

-- +goose StatementEnd
