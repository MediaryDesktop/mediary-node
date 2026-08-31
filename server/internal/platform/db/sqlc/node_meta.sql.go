package sqlc

import (
	"context"
)

const getNodeMeta = `-- name: GetNodeMeta :one

SELECT key, value, updated_at
FROM node_meta
WHERE key = ?
`

func (q *Queries) GetNodeMeta(ctx context.Context, key string) (NodeMetum, error) {
	row := q.db.QueryRowContext(ctx, getNodeMeta, key)
	var i NodeMetum
	err := row.Scan(&i.Key, &i.Value, &i.UpdatedAt)
	return i, err
}

const listNodeMeta = `-- name: ListNodeMeta :many
SELECT key, value, updated_at
FROM node_meta
ORDER BY key
`

func (q *Queries) ListNodeMeta(ctx context.Context) ([]NodeMetum, error) {
	rows, err := q.db.QueryContext(ctx, listNodeMeta)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []NodeMetum{}
	for rows.Next() {
		var i NodeMetum
		if err := rows.Scan(&i.Key, &i.Value, &i.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const upsertNodeMeta = `-- name: UpsertNodeMeta :one
INSERT INTO node_meta (key, value, updated_at)
VALUES (?, ?, unixepoch())
ON CONFLICT (key) DO UPDATE
    SET value = excluded.value,
        updated_at = unixepoch()
RETURNING key, value, updated_at
`

type UpsertNodeMetaParams struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

func (q *Queries) UpsertNodeMeta(ctx context.Context, arg UpsertNodeMetaParams) (NodeMetum, error) {
	row := q.db.QueryRowContext(ctx, upsertNodeMeta, arg.Key, arg.Value)
	var i NodeMetum
	err := row.Scan(&i.Key, &i.Value, &i.UpdatedAt)
	return i, err
}
