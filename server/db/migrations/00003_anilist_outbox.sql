-- +goose Up
-- +goose StatementBegin

-- Changes the user made to their AniList list that have not reached AniList
-- yet. One row per title: a second edit merges into the first, so a week of
-- offline +1 clicks is one request, not hundreds. Rows are scoped to the account
-- that made them, so signing in as someone else never replays a stranger's
-- edits, while signing back in as the same person still delivers them.
CREATE TABLE anilist_outbox (
    account_id     INTEGER NOT NULL,
    media_id       INTEGER NOT NULL,
    media_type     TEXT    NOT NULL CHECK (media_type IN ('anime', 'manga')),
    patch          TEXT    NOT NULL,
    allow_decrease INTEGER NOT NULL DEFAULT 0 CHECK (allow_decrease IN (0, 1)),
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL,
    attempts       INTEGER NOT NULL DEFAULT 0,
    last_error     TEXT,
    PRIMARY KEY (account_id, media_id)
) STRICT;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE anilist_outbox;

-- +goose StatementEnd
