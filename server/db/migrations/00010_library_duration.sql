-- +goose Up
-- +goose StatementBegin

-- How long a video file runs, read out of its own container during the scan.
-- The library list shows it next to every episode, and asking the filesystem for
-- it on every request would mean reopening thousands of files to answer one page.
ALTER TABLE library_file ADD COLUMN duration_seconds INTEGER;

-- Which build of the prober looked at the file. 0 means never. A file whose
-- container the prober of the day could not read is not reopened on every scan,
-- and a prober that learns a new container reaches the existing library without
-- the files having to change.
ALTER TABLE library_file ADD COLUMN probe_version INTEGER NOT NULL DEFAULT 0;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE library_file DROP COLUMN probe_version;
ALTER TABLE library_file DROP COLUMN duration_seconds;

-- +goose StatementEnd
