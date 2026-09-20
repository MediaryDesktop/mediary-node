-- +goose Up
-- +goose StatementBegin

-- Adds 'dorama' to the media types a local list may hold. SQLite cannot alter a
-- CHECK constraint, so both tables are rebuilt. The child is recreated and
-- pointed at the new parent before the old parent is dropped, so the implicit
-- cascade that DROP TABLE performs while foreign keys are on finds nothing left
-- to delete.

CREATE TABLE custom_list_rebuilt (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    media_type TEXT    NOT NULL CHECK (media_type IN ('movie', 'series', 'dorama', 'book')),
    name       TEXT    NOT NULL,
    position   INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (media_type, name)
) STRICT;

INSERT INTO custom_list_rebuilt (id, media_type, name, position, created_at)
SELECT id, media_type, name, position, created_at FROM custom_list;

CREATE TABLE custom_list_item_rebuilt (
    list_id   INTEGER NOT NULL REFERENCES custom_list_rebuilt (id) ON DELETE CASCADE,
    media_ref TEXT    NOT NULL,
    position  INTEGER NOT NULL,
    added_at  INTEGER NOT NULL,
    PRIMARY KEY (list_id, media_ref)
) STRICT;

INSERT INTO custom_list_item_rebuilt (list_id, media_ref, position, added_at)
SELECT list_id, media_ref, position, added_at FROM custom_list_item;

DROP INDEX custom_list_item_by_position;
DROP TABLE custom_list_item;
DROP TABLE custom_list;

ALTER TABLE custom_list_rebuilt RENAME TO custom_list;
ALTER TABLE custom_list_item_rebuilt RENAME TO custom_list_item;

CREATE INDEX custom_list_item_by_position ON custom_list_item (list_id, position);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

CREATE TABLE custom_list_rebuilt (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    media_type TEXT    NOT NULL CHECK (media_type IN ('movie', 'series', 'book')),
    name       TEXT    NOT NULL,
    position   INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (media_type, name)
) STRICT;

INSERT INTO custom_list_rebuilt (id, media_type, name, position, created_at)
SELECT id, media_type, name, position, created_at FROM custom_list
WHERE media_type <> 'dorama';

CREATE TABLE custom_list_item_rebuilt (
    list_id   INTEGER NOT NULL REFERENCES custom_list_rebuilt (id) ON DELETE CASCADE,
    media_ref TEXT    NOT NULL,
    position  INTEGER NOT NULL,
    added_at  INTEGER NOT NULL,
    PRIMARY KEY (list_id, media_ref)
) STRICT;

INSERT INTO custom_list_item_rebuilt (list_id, media_ref, position, added_at)
SELECT i.list_id, i.media_ref, i.position, i.added_at
FROM custom_list_item i
JOIN custom_list_rebuilt l ON l.id = i.list_id;

DROP INDEX custom_list_item_by_position;
DROP TABLE custom_list_item;
DROP TABLE custom_list;

ALTER TABLE custom_list_rebuilt RENAME TO custom_list;
ALTER TABLE custom_list_item_rebuilt RENAME TO custom_list_item;

CREATE INDEX custom_list_item_by_position ON custom_list_item (list_id, position);

-- +goose StatementEnd
