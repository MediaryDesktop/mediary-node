-- name: ListLibraryRoots :many
SELECT r.id, r.path, r.added_at, r.last_scan_at,
       (SELECT COUNT(*) FROM library_file f
         WHERE f.root_id = r.id AND f.missing_since IS NULL) AS file_count,
       (SELECT COUNT(*) FROM library_file f
         WHERE f.root_id = r.id AND f.missing_since IS NOT NULL) AS missing_count,
       -- An opening or a trailer belongs to no title, so counting it as waiting
       -- for one would leave a number the user can never bring down to zero.
       (SELECT COUNT(*) FROM library_file f
              LEFT JOIN file_match m ON m.file_id = f.id
         WHERE f.root_id = r.id AND m.file_id IS NULL
           AND f.media_form IS NOT NULL AND f.media_form <> 'extra') AS unmatched_count
FROM library_root r
ORDER BY r.path;

-- name: GetLibraryRoot :one
SELECT id, path, added_at, last_scan_at
FROM library_root
WHERE id = ?;

-- name: InsertLibraryRoot :one
INSERT INTO library_root (path, added_at)
VALUES (?, ?)
RETURNING id, path, added_at, last_scan_at;

-- name: DeleteLibraryRoot :execrows
DELETE FROM library_root
WHERE id = ?;

-- name: TouchLibraryRoot :exec
UPDATE library_root
SET last_scan_at = ?
WHERE id = ?;

-- The scan reads every known file of a root once, then walks the filesystem and
-- compares in memory: one query instead of a lookup per file.
-- name: ListLibraryFileStates :many
SELECT id, rel_path, kind, size_bytes, mtime, missing_since, parser_version, probe_version
FROM library_file
WHERE root_id = ?;

-- name: InsertLibraryFile :one
INSERT INTO library_file (root_id, rel_path, kind, size_bytes, mtime, scanned_at,
                          media_form, parsed_title, parsed_year, parsed_season,
                          parsed_episode, parsed_chapter, parsed_volume, parser_version,
                          duration_seconds, probe_version)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING id;

-- name: UpdateLibraryFile :exec
UPDATE library_file
SET kind           = ?,
    size_bytes     = ?,
    mtime          = ?,
    scanned_at     = ?,
    missing_since  = NULL,
    media_form     = ?,
    parsed_title   = ?,
    parsed_year    = ?,
    parsed_season  = ?,
    parsed_episode = ?,
    parsed_chapter = ?,
    parsed_volume  = ?,
    parser_version = ?,
    duration_seconds = ?,
    probe_version    = ?
WHERE id = ?;

-- Only the parsed columns: the file itself did not change, a newer parser reads
-- its name differently.
-- name: UpdateLibraryFileParse :exec
UPDATE library_file
SET media_form     = ?,
    parsed_title   = ?,
    parsed_year    = ?,
    parsed_season  = ?,
    parsed_episode = ?,
    parsed_chapter = ?,
    parsed_volume  = ?,
    parser_version = ?
WHERE id = ?;

-- The file itself did not change; a newer prober reads its container again.
-- name: UpdateLibraryFileProbe :exec
UPDATE library_file
SET duration_seconds = ?,
    probe_version    = ?
WHERE id = ?;

-- name: ClearLibraryFileMissing :exec
UPDATE library_file
SET missing_since = NULL,
    scanned_at    = ?
WHERE id = ?;

-- name: MarkLibraryFileMissing :exec
UPDATE library_file
SET missing_since = ?
WHERE id = ? AND missing_since IS NULL;

-- name: ListLibraryFiles :many
SELECT f.id, f.root_id, r.path AS root_path, f.rel_path, f.kind, f.size_bytes,
       f.mtime, f.scanned_at, f.missing_since, f.ignored_at,
       f.media_form, f.parsed_title, f.parsed_year, f.parsed_season,
       f.parsed_episode, f.parsed_chapter, f.parsed_volume, f.duration_seconds,
       m.media_ref, m.season, m.episode, m.confidence, m.source AS match_source
FROM library_file f
         JOIN library_root r ON r.id = f.root_id
         LEFT JOIN file_match m ON m.file_id = f.id
WHERE (CAST(sqlc.arg(root_id) AS INTEGER) = 0 OR f.root_id = CAST(sqlc.arg(root_id) AS INTEGER))
  AND (CAST(sqlc.arg(kind) AS TEXT) = '' OR f.kind = CAST(sqlc.arg(kind) AS TEXT))
  AND (CAST(sqlc.arg(media_form) AS TEXT) = '' OR f.media_form = CAST(sqlc.arg(media_form) AS TEXT))
  AND (CAST(sqlc.arg(unmatched_only) AS INTEGER) = 0 OR (m.file_id IS NULL AND f.ignored_at IS NULL))
  AND (CAST(sqlc.arg(ignored_only) AS INTEGER) = 0 OR f.ignored_at IS NOT NULL)
  AND (CAST(sqlc.arg(media_ref) AS TEXT) = '' OR m.media_ref = CAST(sqlc.arg(media_ref) AS TEXT))
ORDER BY r.path, f.rel_path
LIMIT CAST(sqlc.arg(page_limit) AS INTEGER) OFFSET CAST(sqlc.arg(page_offset) AS INTEGER);

-- name: CountLibraryFiles :one
SELECT COUNT(*) AS total
FROM library_file f
         LEFT JOIN file_match m ON m.file_id = f.id
WHERE (CAST(sqlc.arg(root_id) AS INTEGER) = 0 OR f.root_id = CAST(sqlc.arg(root_id) AS INTEGER))
  AND (CAST(sqlc.arg(kind) AS TEXT) = '' OR f.kind = CAST(sqlc.arg(kind) AS TEXT))
  AND (CAST(sqlc.arg(media_form) AS TEXT) = '' OR f.media_form = CAST(sqlc.arg(media_form) AS TEXT))
  AND (CAST(sqlc.arg(unmatched_only) AS INTEGER) = 0 OR (m.file_id IS NULL AND f.ignored_at IS NULL))
  AND (CAST(sqlc.arg(ignored_only) AS INTEGER) = 0 OR f.ignored_at IS NOT NULL)
  AND (CAST(sqlc.arg(media_ref) AS TEXT) = '' OR m.media_ref = CAST(sqlc.arg(media_ref) AS TEXT));

-- What the filter tabs above the list show. One query rather than three: the
-- three numbers have to agree with each other, and they only do if they are read
-- from the same snapshot.
-- name: CountLibraryFileStates :one
SELECT COUNT(*) AS total,
       CAST(COALESCE(SUM(CASE WHEN m.file_id IS NULL
                               AND f.ignored_at IS NULL
                               AND f.media_form IS NOT NULL
                               AND f.media_form <> 'extra' THEN 1 ELSE 0 END), 0) AS INTEGER) AS unmatched,
       CAST(COALESCE(SUM(CASE WHEN f.ignored_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS INTEGER) AS ignored,
       CAST(COALESCE(SUM(CASE WHEN f.missing_since IS NOT NULL THEN 1 ELSE 0 END), 0) AS INTEGER) AS missing
FROM library_file f
         LEFT JOIN file_match m ON m.file_id = f.id
WHERE (CAST(sqlc.arg(root_id) AS INTEGER) = 0 OR f.root_id = CAST(sqlc.arg(root_id) AS INTEGER))
  AND (CAST(sqlc.arg(kind) AS TEXT) = '' OR f.kind = CAST(sqlc.arg(kind) AS TEXT))
  AND (CAST(sqlc.arg(media_form) AS TEXT) = '' OR f.media_form = CAST(sqlc.arg(media_form) AS TEXT));

-- name: GetLibraryFile :one
SELECT f.id, f.root_id, r.path AS root_path, f.rel_path, f.kind, f.size_bytes,
       f.mtime, f.scanned_at, f.missing_since, f.ignored_at,
       f.media_form, f.parsed_title, f.parsed_year, f.parsed_season,
       f.parsed_episode, f.parsed_chapter, f.parsed_volume, f.duration_seconds,
       m.media_ref, m.season, m.episode, m.confidence, m.source AS match_source
FROM library_file f
         JOIN library_root r ON r.id = f.root_id
         LEFT JOIN file_match m ON m.file_id = f.id
WHERE f.id = ?;

-- Files the matcher still has to work out, ordered so that every episode of one
-- title arrives together: the candidates are then looked up once per title
-- instead of once per file.
-- name: ListUnmatchedFiles :many
SELECT f.id, f.rel_path, f.kind, f.media_form, f.parsed_title, f.parsed_year,
       f.parsed_season, f.parsed_episode, f.parsed_chapter, f.parsed_volume
FROM library_file f
         LEFT JOIN file_match m ON m.file_id = f.id
WHERE m.file_id IS NULL
  AND f.missing_since IS NULL
  AND f.ignored_at IS NULL
  AND f.parsed_title IS NOT NULL
  AND f.parsed_title <> ''
  -- An opening or a trailer belongs to no episode, so there is nothing to match.
  AND f.media_form IS NOT NULL
  AND f.media_form <> 'extra'
ORDER BY f.media_form, f.parsed_title, f.parsed_season, f.id
LIMIT ?;

-- name: UpsertManualFileMatch :exec
INSERT INTO file_match (file_id, media_ref, season, episode, confidence, source, matched_at)
VALUES (?, ?, ?, ?, 1.0, 'manual', ?)
ON CONFLICT (file_id) DO UPDATE
    SET media_ref  = excluded.media_ref,
        season     = excluded.season,
        episode    = excluded.episode,
        confidence = excluded.confidence,
        source     = excluded.source,
        matched_at = excluded.matched_at;

-- A manual match is the user's decision, so an automatic one never replaces it.
-- name: UpsertAutoFileMatch :exec
INSERT INTO file_match (file_id, media_ref, season, episode, confidence, source, matched_at)
VALUES (?, ?, ?, ?, ?, 'auto', ?)
ON CONFLICT (file_id) DO UPDATE
    SET media_ref  = excluded.media_ref,
        season     = excluded.season,
        episode    = excluded.episode,
        confidence = excluded.confidence,
        matched_at = excluded.matched_at
WHERE file_match.source <> 'manual';

-- name: DeleteFileMatch :execrows
DELETE FROM file_match
WHERE file_id = ?;

-- The library as a list of titles rather than of files: one row per title the
-- user has something of, which is what a shelf of posters is made from.
-- name: ListLibraryCollection :many
SELECT m.media_ref,
       COUNT(*) AS file_count,
       CAST(COALESCE(SUM(CASE WHEN f.missing_since IS NOT NULL THEN 1 ELSE 0 END), 0) AS INTEGER) AS missing_count
FROM file_match m
         JOIN library_file f ON f.id = m.file_id
GROUP BY m.media_ref;

-- name: SetLibraryFileIgnored :execrows
UPDATE library_file
SET ignored_at = ?
WHERE id = ?;

-- name: ClearLibraryFileIgnored :execrows
UPDATE library_file
SET ignored_at = NULL
WHERE id = ?;

-- The match hangs off the file row and goes with it: the user deleted the file
-- itself, not only what it was tied to.
-- name: DeleteLibraryFile :execrows
DELETE FROM library_file
WHERE id = ?;

-- Every file at once, for the explorer's tree. The tree is the whole library by
-- definition, so paging it would only mean the client asking for page after page
-- before it can draw anything.
-- name: ListAllLibraryFiles :many
SELECT f.id, f.root_id, r.path AS root_path, f.rel_path, f.kind, f.size_bytes,
       f.mtime, f.scanned_at, f.missing_since, f.ignored_at,
       f.media_form, f.parsed_title, f.parsed_year, f.parsed_season,
       f.parsed_episode, f.parsed_chapter, f.parsed_volume, f.duration_seconds,
       m.media_ref, m.season, m.episode, m.confidence, m.source AS match_source
FROM library_file f
         JOIN library_root r ON r.id = f.root_id
         LEFT JOIN file_match m ON m.file_id = f.id
ORDER BY r.path, f.rel_path;
