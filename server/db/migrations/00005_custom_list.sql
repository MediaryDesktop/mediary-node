-- +goose Up
-- +goose StatementBegin

-- Custom lists for the media types this node owns. Anime and manga are absent
-- on purpose: their custom lists live in the user's AniList account, and a copy
-- here would be the competing tracker AniList's terms forbid.
CREATE TABLE custom_list (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    media_type TEXT    NOT NULL CHECK (media_type IN ('movie', 'series', 'book')),
    name       TEXT    NOT NULL,
    position   INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (media_type, name)
) STRICT;

CREATE TABLE custom_list_item (
    list_id   INTEGER NOT NULL REFERENCES custom_list (id) ON DELETE CASCADE,
    media_ref TEXT    NOT NULL,
    position  INTEGER NOT NULL,
    added_at  INTEGER NOT NULL,
    PRIMARY KEY (list_id, media_ref)
) STRICT;

CREATE INDEX custom_list_item_by_position ON custom_list_item (list_id, position);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX custom_list_item_by_position;
DROP TABLE custom_list_item;
DROP TABLE custom_list;

-- +goose StatementEnd
