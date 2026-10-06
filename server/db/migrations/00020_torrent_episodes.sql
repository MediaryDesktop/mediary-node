-- +goose Up
-- +goose StatementBegin

-- A download is added for several episodes when it is a batch: the list is kept
-- as a JSON array. Rows written under the single-episode column keep their episode.
ALTER TABLE torrent_download ADD COLUMN episodes TEXT;
UPDATE torrent_download SET episodes = '[' || episode || ']' WHERE episode IS NOT NULL;
ALTER TABLE torrent_download DROP COLUMN episode;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE torrent_download ADD COLUMN episode INTEGER;
UPDATE torrent_download SET episode = json_extract(episodes, '$[0]') WHERE episodes IS NOT NULL;
ALTER TABLE torrent_download DROP COLUMN episodes;

-- +goose StatementEnd
