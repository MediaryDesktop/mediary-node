-- +goose Up
-- +goose StatementBegin

-- The user's Torznab endpoints — Jackett, Prowlarr — searched for releases. The
-- API key is kept in the node's secrets file, not here.
CREATE TABLE torznab_source (
    id         INTEGER PRIMARY KEY,
    name       TEXT    NOT NULL,
    url        TEXT    NOT NULL,
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL
) STRICT;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE torznab_source;

-- +goose StatementEnd
