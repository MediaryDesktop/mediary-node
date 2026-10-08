-- +goose Up
-- +goose StatementBegin

-- What the videos in a folder are, as the user said when adding it: anime is
-- matched against AniList, movies and shows against TMDB. A file's name cannot
-- tell the two apart once the folder is named in the user's own language.
-- Validated by the node rather than a CHECK, so the column can be dropped again.
ALTER TABLE library_root ADD COLUMN content TEXT NOT NULL DEFAULT 'anime';

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE library_root DROP COLUMN content;

-- +goose StatementEnd
