-- +goose Up
-- +goose StatementBegin

-- One row per finished scan, so the desktop can show what happened on past runs
-- instead of only the single in-memory slot the running scan overwrites.
CREATE TABLE scan_run (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at  INTEGER NOT NULL,
    finished_at INTEGER NOT NULL,

    -- 'partial' when the scan's context was cancelled mid-walk; the roots and
    -- files recorded up to that point are still real, just not the whole story.
    status TEXT NOT NULL CHECK (status IN ('completed', 'partial')),

    roots_total INTEGER NOT NULL,
    found       INTEGER NOT NULL,
    added       INTEGER NOT NULL,
    changed     INTEGER NOT NULL,
    reparsed    INTEGER NOT NULL,
    missing     INTEGER NOT NULL,
    probed      INTEGER NOT NULL,
    considered  INTEGER NOT NULL,
    matched     INTEGER NOT NULL
) STRICT;

CREATE INDEX scan_run_by_started_at ON scan_run (started_at DESC);

-- Per-root outcome, kept even after the root itself is removed: the run happened
-- on that path regardless of whether the user still watches it.
CREATE TABLE scan_run_root (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_run_id INTEGER NOT NULL REFERENCES scan_run (id) ON DELETE CASCADE,
    root_id     INTEGER REFERENCES library_root (id) ON DELETE SET NULL,
    root_path   TEXT    NOT NULL,

    found    INTEGER NOT NULL,
    added    INTEGER NOT NULL,
    changed  INTEGER NOT NULL,
    reparsed INTEGER NOT NULL,
    missing  INTEGER NOT NULL,
    probed   INTEGER NOT NULL,

    error TEXT
) STRICT;

CREATE INDEX scan_run_root_by_scan ON scan_run_root (scan_run_id);

-- One row per title the matcher settled on during this run. tracked = 0 is the
-- closest thing to "not in your collection yet": the matcher found it on its own
-- from a search, rather than off the user's own list.
CREATE TABLE scan_run_group (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_run_id INTEGER NOT NULL REFERENCES scan_run (id) ON DELETE CASCADE,
    media_ref   TEXT    NOT NULL,
    file_count  INTEGER NOT NULL,
    tracked     INTEGER NOT NULL CHECK (tracked IN (0, 1))
) STRICT;

CREATE INDEX scan_run_group_by_scan ON scan_run_group (scan_run_id);

-- One row per file the matcher looked at, matched or not. rel_path and
-- parsed_title are snapshots rather than a join: a file can be deleted later and
-- the run should still say what it used to be.
CREATE TABLE scan_run_file_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_run_id INTEGER NOT NULL REFERENCES scan_run (id) ON DELETE CASCADE,
    file_id     INTEGER REFERENCES library_file (id) ON DELETE SET NULL,

    rel_path     TEXT NOT NULL,
    parsed_title TEXT,

    outcome   TEXT NOT NULL CHECK (outcome IN ('matched_auto', 'unmatched')),
    media_ref TEXT,

    -- The best candidate's score, whether or not it cleared the threshold: what
    -- an unmatched file came closest to is the answer to "why didn't this work".
    confidence REAL
) STRICT;

CREATE INDEX scan_run_file_log_by_scan ON scan_run_file_log (scan_run_id);
CREATE INDEX scan_run_file_log_by_outcome ON scan_run_file_log (scan_run_id, outcome);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX scan_run_file_log_by_outcome;
DROP INDEX scan_run_file_log_by_scan;
DROP TABLE scan_run_file_log;
DROP INDEX scan_run_group_by_scan;
DROP TABLE scan_run_group;
DROP INDEX scan_run_root_by_scan;
DROP TABLE scan_run_root;
DROP INDEX scan_run_by_started_at;
DROP TABLE scan_run;

-- +goose StatementEnd
