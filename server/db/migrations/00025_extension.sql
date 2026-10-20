-- +goose Up
-- +goose StatementBegin

-- Plugins the user installed. The manifest is kept as the user agreed to it:
-- its hosts and settings are what the plugin may use until an update the user
-- agrees to again. The code is on disk, checked against the manifest's sum;
-- secret settings are in the node's secrets file, not here.
CREATE TABLE extension (
    id           TEXT    PRIMARY KEY,
    manifest_url TEXT    NOT NULL,
    manifest     TEXT    NOT NULL,
    enabled      INTEGER NOT NULL DEFAULT 1,
    config       TEXT    NOT NULL DEFAULT '{}',
    installed_at TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL
) STRICT;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE extension;

-- +goose StatementEnd
