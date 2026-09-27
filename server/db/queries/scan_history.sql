-- name: InsertScanRun :one
INSERT INTO scan_run (started_at, finished_at, status, roots_total, found, added,
                       changed, reparsed, missing, probed, considered, matched)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING id;

-- name: InsertScanRunRoot :exec
INSERT INTO scan_run_root (scan_run_id, root_id, root_path, found, added, changed,
                            reparsed, missing, probed, error)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: InsertScanRunGroup :exec
INSERT INTO scan_run_group (scan_run_id, media_ref, file_count, tracked)
VALUES (?, ?, ?, ?);

-- name: InsertScanRunFileLog :exec
INSERT INTO scan_run_file_log (scan_run_id, file_id, rel_path, parsed_title,
                                outcome, media_ref, confidence)
VALUES (?, ?, ?, ?, ?, ?, ?);

-- A local database has no reason to grow scan history forever; the newest runs
-- are the only ones anyone comes back to read.
-- name: PruneScanRuns :exec
DELETE FROM scan_run
WHERE id NOT IN (SELECT id FROM scan_run ORDER BY started_at DESC LIMIT ?);

-- name: ListScanRuns :many
SELECT id, started_at, finished_at, status, roots_total, found, added, changed,
       reparsed, missing, probed, considered, matched
FROM scan_run
WHERE (CAST(sqlc.arg(from_ts) AS INTEGER) = 0 OR started_at >= CAST(sqlc.arg(from_ts) AS INTEGER))
  AND (CAST(sqlc.arg(to_ts) AS INTEGER) = 0 OR started_at <= CAST(sqlc.arg(to_ts) AS INTEGER))
ORDER BY started_at DESC
LIMIT CAST(sqlc.arg(page_limit) AS INTEGER) OFFSET CAST(sqlc.arg(page_offset) AS INTEGER);

-- name: CountScanRuns :one
SELECT COUNT(*) AS total
FROM scan_run
WHERE (CAST(sqlc.arg(from_ts) AS INTEGER) = 0 OR started_at >= CAST(sqlc.arg(from_ts) AS INTEGER))
  AND (CAST(sqlc.arg(to_ts) AS INTEGER) = 0 OR started_at <= CAST(sqlc.arg(to_ts) AS INTEGER));

-- name: GetScanRun :one
SELECT id, started_at, finished_at, status, roots_total, found, added, changed,
       reparsed, missing, probed, considered, matched
FROM scan_run
WHERE id = ?;

-- name: ListScanRunRoots :many
SELECT id, scan_run_id, root_id, root_path, found, added, changed, reparsed,
       missing, probed, error
FROM scan_run_root
WHERE scan_run_id = ?
ORDER BY root_path;

-- name: ListScanRunGroups :many
SELECT id, scan_run_id, media_ref, file_count, tracked
FROM scan_run_group
WHERE scan_run_id = ?
ORDER BY file_count DESC, media_ref;

-- name: ListScanRunFileLogs :many
SELECT id, scan_run_id, file_id, rel_path, parsed_title, outcome, media_ref, confidence
FROM scan_run_file_log
WHERE scan_run_id = ?
ORDER BY outcome, rel_path;
