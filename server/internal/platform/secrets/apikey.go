package secrets

import "strings"

type KeySource string

const (
	KeySourceUser  KeySource = "user"
	KeySourceBuild KeySource = "build"
	KeySourceNone  KeySource = "none"
)

// APIKey picks the credential the node sends to a source: the user's own key when
// they saved one, otherwise the one the build or the environment shipped with.
// The user's key lives in a 0600 file beside the OPDS passwords, never in the
// database.
type APIKey struct {
	store    *Store
	entry    string
	fallback string
}

func NewAPIKey(store *Store, entry, fallback string) *APIKey {
	return &APIKey{store: store, entry: entry, fallback: strings.TrimSpace(fallback)}
}

func (k *APIKey) Key() (string, error) {
	key, _, err := k.current()
	return key, err
}

func (k *APIKey) Source() (KeySource, error) {
	_, source, err := k.current()
	return source, err
}

// SetUserKey stores the user's own key; an empty one goes back to the build's.
func (k *APIKey) SetUserKey(key string) error {
	return k.store.Set(k.entry, strings.TrimSpace(key))
}

func (k *APIKey) current() (string, KeySource, error) {
	if k == nil {
		return "", KeySourceNone, nil
	}

	if k.store != nil {
		own, err := k.store.Get(k.entry)
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
