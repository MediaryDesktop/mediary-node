-- +goose Up
-- +goose StatementBegin

-- MangaDex is no longer a built-in source: its links would name a source the
-- node cannot read, and its settings nothing reads any more.
DELETE FROM manga_source_link WHERE source = 'mangadex';
DELETE FROM node_meta WHERE key IN ('mangadex.enabled', 'mangadex.languages');

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

-- What was deleted is gone; there is nothing to put back.
SELECT 1;

-- +goose StatementEnd
