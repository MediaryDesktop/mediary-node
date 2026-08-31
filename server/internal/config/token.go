package config

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"strings"
)

const tokenBytes = 32

func (c *Config) EnsureToken() (string, error) {
	if c.HTTP.Token != "" {
		return c.HTTP.Token, nil
	}

	path := c.TokenPath()

	stored, err := os.ReadFile(path)
	switch {
	case err == nil:
		token := strings.TrimSpace(string(stored))
		if token != "" {
			c.HTTP.Token = token
			return token, nil
		}

	case !errors.Is(err, fs.ErrNotExist):
		return "", fmt.Errorf("read token file %s: %w", path, err)
	}

	token, err := generateToken()
	if err != nil {
		return "", err
	}

	if err := os.WriteFile(path, []byte(token), 0o600); err != nil {
		return "", fmt.Errorf("write token file %s: %w", path, err)
	}

	c.HTTP.Token = token

	return token, nil
}

func generateToken() (string, error) {
	raw := make([]byte, tokenBytes)

	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("generate token: %w", err)
	}

	return base64.RawURLEncoding.EncodeToString(raw), nil
}
