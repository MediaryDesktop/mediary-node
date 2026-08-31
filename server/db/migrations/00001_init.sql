-- +goose Up
-- +goose StatementBegin

-- Phase 0 migration: proves the goose → sqlc → database/sql chain works.
-- Not the real schema — see docs/node-implementation-plan.md for the local
-- model (scanned files, catalog matches, download and progress queues).

CREATE TABLE node_meta (
    key        TEXT    PRIMARY KEY,
    value      TEXT    NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
) STRICT;

INSERT INTO node_meta (key, value) VALUES ('schema_bootstrapped_at', unixepoch());

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE node_meta;

-- +goose StatementEnd
