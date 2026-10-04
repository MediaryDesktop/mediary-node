-- +goose Up
-- +goose StatementBegin

-- A list's icon, keyed by the list's identifier rather than living on
-- custom_list: anime and manga lists are AniList's, which has nowhere to put one.
CREATE TABLE list_icon (
    list_id TEXT NOT NULL PRIMARY KEY,
    icon    TEXT NOT NULL
) STRICT;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE list_icon;

-- +goose StatementEnd
