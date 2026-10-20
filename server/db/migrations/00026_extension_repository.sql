-- +goose Up
-- +goose StatementBegin

-- Plugin repositories the user added: lists of plugins someone publishes. Only
-- the address is the user's; the name is the repository's own, kept from the
-- last time it was read. There is no repository the node starts with.
CREATE TABLE extension_repository (
    id       INTEGER PRIMARY KEY,
    url      TEXT    NOT NULL UNIQUE,
    name     TEXT    NOT NULL DEFAULT '',
    added_at TEXT    NOT NULL
) STRICT;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE extension_repository;

-- +goose StatementEnd
