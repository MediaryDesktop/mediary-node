-- Queries owned by the progress module: where the user is in each episode,
-- chapter and book. Every row has exactly one key (a title and a unit within
-- it, or a reference that does not depend on this computer), and the snapshot
-- queries are ordered by it, so an unchanged state encodes to the same bytes.

-- name: GetWatchStateByEpisode :one
SELECT id, media_ref, episode, content_key, position, duration, watched,
       watch_count, pass_counted, last_watched_at, updated_at
FROM watch_state
WHERE media_ref = ? AND episode = ?;

-- name: GetWatchStateByContent :one
SELECT id, media_ref, episode, content_key, position, duration, watched,
       watch_count, pass_counted, last_watched_at, updated_at
FROM watch_state
WHERE content_key = ?;

-- name: InsertWatchState :exec
INSERT INTO watch_state (media_ref, episode, content_key, position, duration, watched,
                         watch_count, pass_counted, last_watched_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateWatchState :exec
UPDATE watch_state
SET position        = ?,
    duration        = ?,
    watched         = ?,
    watch_count     = ?,
    pass_counted    = ?,
    last_watched_at = ?,
    updated_at      = ?
WHERE id = ?;

-- name: ListTitleWatchStates :many
SELECT id, media_ref, episode, content_key, position, duration, watched,
       watch_count, pass_counted, last_watched_at, updated_at
FROM watch_state
WHERE media_ref = ?
ORDER BY episode;

-- Episodes begun and not finished, latest first: what "continue watching" offers.
-- name: ListUnfinishedWatchStates :many
SELECT id, media_ref, episode, content_key, position, duration, watched,
       watch_count, pass_counted, last_watched_at, updated_at
FROM watch_state
WHERE media_ref IS NOT NULL
  AND watched = 0
  AND position > 0
ORDER BY updated_at DESC, id DESC
LIMIT ?;

-- name: GetChapterStateByNumber :one
SELECT id, media_ref, chapter, source_ref, page, pages, read, read_at, updated_at
FROM chapter_state
WHERE media_ref = ? AND chapter = ?;

-- name: GetChapterStateBySource :one
SELECT id, media_ref, chapter, source_ref, page, pages, read, read_at, updated_at
FROM chapter_state
WHERE source_ref = ?;

-- name: InsertChapterState :exec
INSERT INTO chapter_state (media_ref, chapter, source_ref, page, pages, read, read_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateChapterState :exec
UPDATE chapter_state
SET page       = ?,
    pages      = ?,
    read       = ?,
    read_at    = ?,
    updated_at = ?
WHERE id = ?;

-- name: ListTitleChapterStates :many
SELECT id, media_ref, chapter, source_ref, page, pages, read, read_at, updated_at
FROM chapter_state
WHERE media_ref = ?
ORDER BY chapter;

-- name: GetBookState :one
SELECT content_key, media_ref, locator, fraction, updated_at
FROM book_state
WHERE content_key = ?;

-- name: UpsertBookState :exec
INSERT INTO book_state (content_key, media_ref, locator, fraction, updated_at)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT (content_key) DO UPDATE SET media_ref  = excluded.media_ref,
                                        locator    = excluded.locator,
                                        fraction   = excluded.fraction,
                                        updated_at = excluded.updated_at;

-- name: SnapshotWatchStates :many
SELECT media_ref, episode, content_key, position, duration, watched,
       watch_count, pass_counted, last_watched_at, updated_at
FROM watch_state
ORDER BY media_ref, episode, content_key;

-- name: SnapshotChapterStates :many
SELECT media_ref, chapter, source_ref, page, pages, read, read_at, updated_at
FROM chapter_state
ORDER BY media_ref, chapter, source_ref;

-- name: SnapshotBookStates :many
SELECT content_key, media_ref, locator, fraction, updated_at
FROM book_state
ORDER BY content_key;

-- name: ClearWatchStates :exec
DELETE FROM watch_state;

-- name: ClearChapterStates :exec
DELETE FROM chapter_state;

-- name: ClearBookStates :exec
DELETE FROM book_state;
