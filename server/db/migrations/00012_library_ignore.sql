-- +goose Up
-- +goose StatementBegin

-- Set when the user tells the node to leave a file alone. A sample, a trailer the
-- parser could not place, a file that belongs to nothing — without this the
-- matcher offers it again after every scan and the unmatched count never reaches
-- zero, which is the number the user is trying to clear.
ALTER TABLE library_file ADD COLUMN ignored_at INTEGER;

CREATE INDEX library_file_ignored ON library_file (ignored_at);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX library_file_ignored;

ALTER TABLE library_file DROP COLUMN ignored_at;

-- +goose StatementEnd
