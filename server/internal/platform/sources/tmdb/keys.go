package tmdb

import (
	"strings"

	"github.com/mediaryorg/mediary-node/server/internal/platform/secrets"
)

const userKeyEntry = "tmdb.api_key"

type KeySource string

const (
	KeySourceUser  KeySource = "user"
	KeySourceBuild KeySource = "build"
	KeySourceNone  KeySource = "none"
)

// Keys picks the credential the node sends: the user's own key when they saved
// one, otherwise the one the build or the environment shipped with. The user's
// key lives in a 0600 file beside the OPDS passwords, never in the database.
type Keys struct {
	secrets  *secrets.Store
	fallback string
}

func NewKeys(store *secrets.Store, fallback string) *Keys {
	return &Keys{secrets: store, fallback: strings.TrimSpace(fallback)}
}

func (k *Keys) Key() (string, error) {
	key, _, err := k.current()
	return key, err
}

func (k *Keys) Source() (KeySource, error) {
	_, source, err := k.current()
	return source, err
}

// SetUserKey stores the user's own key; an empty one goes back to the build's.
func (k *Keys) SetUserKey(key string) error {
	return k.secrets.Set(userKeyEntry, strings.TrimSpace(key))
}

func (k *Keys) current() (string, KeySource, error) {
	if k == nil {
		return "", KeySourceNone, nil
	}

	if k.secrets != nil {
		own, err := k.secrets.Get(userKeyEntry)
		if err != nil {
			return "", KeySourceNone, err
		}

		if own != "" {
			return own, KeySourceUser, nil
		}
	}

	if k.fallback != "" {
		return k.fallback, KeySourceBuild, nil
	}

	return "", KeySourceNone, nil
}
