package sqlc

import (
	"context"
)

type Querier interface {
	GetNodeMeta(ctx context.Context, key string) (NodeMetum, error)
	ListNodeMeta(ctx context.Context) ([]NodeMetum, error)
	UpsertNodeMeta(ctx context.Context, arg UpsertNodeMetaParams) (NodeMetum, error)
}

var _ Querier = (*Queries)(nil)
