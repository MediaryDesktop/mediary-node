-- +goose Up
-- +goose StatementBegin

-- Entries now carry genres and the global score, which mirrors written before
-- this release do not have. Dropping the list mirrors makes the next read
-- refetch them from AniList; the viewer row stays, so the account remains
-- connected, and pending edits live in the outbox rather than here.
DELETE FROM anilist_mirror WHERE kind IN ('anime', 'manga');

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

SELECT 1;

-- +goose StatementEnd
