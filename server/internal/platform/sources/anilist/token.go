package anilist

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

type TokenStore struct {
	path string

	mu     sync.RWMutex
	loaded bool
	token  string
}

func NewTokenStore(path string) *TokenStore {
	return &TokenStore{path: path}
}

func (s *TokenStore) Token() (string, error) {
	s.mu.RLock()
	if s.loaded {
		token := s.token
		s.mu.RUnlock()
		return token, nil
	}
	s.mu.RUnlock()

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.loaded {
		return s.token, nil
	}

	stored, err := os.ReadFile(s.path)
	switch {
	case err == nil:
		s.token = strings.TrimSpace(string(stored))
	case errors.Is(err, fs.ErrNotExist):
		s.token = ""
	default:
		return "", fmt.Errorf("read anilist token %s: %w", s.path, err)
	}

	s.loaded = true

	return s.token, nil
}

func (s *TokenStore) Save(token string) error {
	token = strings.TrimSpace(token)
	if token == "" {
		return errors.New("anilist token is empty")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	tmp, err := os.CreateTemp(filepath.Dir(s.path), ".anilist-token-*")
	if err != nil {
		return fmt.Errorf("create anilist token file: %w", err)
	}

	tmpPath := tmp.Name()
	defer func() { _ = os.Remove(tmpPath) }()

	if err := tmp.Chmod(0o600); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("restrict anilist token file: %w", err)
	}

	if _, err := tmp.WriteString(token); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("write anilist token file: %w", err)
	}

	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close anilist token file: %w", err)
	}

	if err := os.Rename(tmpPath, s.path); err != nil {
		return fmt.Errorf("store anilist token %s: %w", s.path, err)
	}

	s.token = token
	s.loaded = true

	return nil
}

func (s *TokenStore) Clear() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := os.Remove(s.path); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("remove anilist token %s: %w", s.path, err)
	}

	s.token = ""
	s.loaded = true

	return nil
}
