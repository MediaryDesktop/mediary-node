// Package secrets keeps passwords the node needs — OPDS servers, the torrent
// client — in a file of their own, readable only by the user, as the AniList
// token is kept. Not in the database: a copy of the database — a backup snapshot
// above all — must not carry them.
package secrets

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sync"
)

type Store struct {
	path string

	mu     sync.Mutex
	loaded bool
	values map[string]string
}

func New(path string) *Store {
	return &Store{path: path}
}

// Get returns the secret under key, or "" when there is none.
func (s *Store) Get(key string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.load(); err != nil {
		return "", err
	}

	return s.values[key], nil
}

// Set stores the secret under key; an empty one removes it.
func (s *Store) Set(key, value string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.load(); err != nil {
		return err
	}

	next := make(map[string]string, len(s.values)+1)
	for k, v := range s.values {
		next[k] = v
	}
	if value == "" {
		delete(next, key)
	} else {
		next[key] = value
	}

	if err := s.write(next); err != nil {
		return err
	}

	s.values = next

	return nil
}

func (s *Store) load() error {
	if s.loaded {
		return nil
	}

	data, err := os.ReadFile(s.path)
	switch {
	case errors.Is(err, fs.ErrNotExist):
		s.values = map[string]string{}
	case err != nil:
		return fmt.Errorf("read %s: %w", s.path, err)
	default:
		values := map[string]string{}
		if err := json.Unmarshal(data, &values); err != nil {
			return fmt.Errorf("read %s: %w", s.path, err)
		}
		s.values = values
	}

	s.loaded = true

	return nil
}

func (s *Store) write(values map[string]string) error {
	data, err := json.Marshal(values)
	if err != nil {
		return err
	}

	tmp, err := os.CreateTemp(filepath.Dir(s.path), ".secrets-*")
	if err != nil {
		return fmt.Errorf("create secrets file: %w", err)
	}

	tmpPath := tmp.Name()
	defer func() { _ = os.Remove(tmpPath) }()

	if err := tmp.Chmod(0o600); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("restrict secrets file: %w", err)
	}
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("write secrets file: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close secrets file: %w", err)
	}

	if err := os.Rename(tmpPath, s.path); err != nil {
		return fmt.Errorf("replace %s: %w", s.path, err)
	}

	return nil
}
