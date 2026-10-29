-- +goose Up
-- +goose StatementBegin

-- A manual title's poster is a file the node keeps itself, under the data
-- directory: a picture found on the web would otherwise vanish with the page it
-- came from. The version moves on every change, so a client that caches the
-- poster by its address asks again once it is replaced.
ALTER TABLE manual_title ADD COLUMN cover_file TEXT;
ALTER TABLE manual_title ADD COLUMN cover_color TEXT;
ALTER TABLE manual_title ADD COLUMN cover_version INTEGER NOT NULL DEFAULT 0;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE manual_title DROP COLUMN cover_version;
ALTER TABLE manual_title DROP COLUMN cover_color;
ALTER TABLE manual_title DROP COLUMN cover_file;

-- +goose StatementEnd
