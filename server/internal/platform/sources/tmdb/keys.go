package tmdb

import (
	"github.com/mediaryorg/mediary-node/server/internal/platform/secrets"
)

type (
	Keys      = secrets.APIKey
	KeySource = secrets.KeySource
)

const (
	KeySourceUser  = secrets.KeySourceUser
	KeySourceBuild = secrets.KeySourceBuild
	KeySourceNone  = secrets.KeySourceNone
)

func NewKeys(store *secrets.Store, fallback string) *Keys {
	return secrets.NewAPIKey(store, "tmdb.api_key", fallback)
}
