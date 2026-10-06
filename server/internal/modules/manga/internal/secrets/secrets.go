// Package secrets keeps the passwords of the user's OPDS servers, keyed by
// server, in the node's secrets file.
package secrets

import (
	"strconv"

	"github.com/mediaryorg/mediary-node/server/internal/platform/secrets"
)

type Store struct {
	file *secrets.Store
}

func New(path string) *Store {
	return &Store{file: secrets.New(path)}
}

// Password returns the server's password, or "" when it has none.
func (s *Store) Password(serverID int64) (string, error) {
	return s.file.Get(key(serverID))
}

// SetPassword stores the password; an empty one removes it.
func (s *Store) SetPassword(serverID int64, password string) error {
	return s.file.Set(key(serverID), password)
}

func key(serverID int64) string {
	return strconv.FormatInt(serverID, 10)
}
