-- +goose Up
-- +goose StatementBegin

-- Metadata fetched from an external source on demand, such as a title page.
-- Unlike anilist_mirror this is not the user's own data: every row has a
-- maximum age set by the source's terms, and rows past it are deleted rather
-- than kept as a stale fallback.
CREATE TABLE source_cache (
    provider    TEXT    NOT NULL,
    external_id TEXT    NOT NULL,
    payload     TEXT    NOT NULL,
    fetched_at  INTEGER NOT NULL,
    PRIMARY KEY (provider, external_id)
) STRICT;

CREATE INDEX source_cache_fetched_at ON source_cache (fetched_at);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE source_cache;

-- +goose StatementEnd
