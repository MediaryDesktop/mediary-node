-- +goose Up
-- +goose StatementBegin

-- A torrent added to pick its files first: the client holds it until the user has
-- chosen which episodes to download.
ALTER TABLE torrent_download ADD COLUMN choosing INTEGER NOT NULL DEFAULT 0;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE torrent_download DROP COLUMN choosing;

-- +goose StatementEnd
