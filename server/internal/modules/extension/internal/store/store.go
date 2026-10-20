package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/modules/extension/internal/manifest"
	"github.com/mediaryorg/mediary-node/server/internal/platform/db/sqlc"
)

type Store struct {
	db *sql.DB
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) Ready() bool {
	return s != nil && s.db != nil
}

// Extension is an installed plugin: the manifest the user agreed to, whether
// it is on, and its settings other than secrets.
type Extension struct {
	ID          string
	ManifestURL string
	Manifest    manifest.Manifest
	Enabled     bool
	Config      map[string]string
	InstalledAt time.Time
	UpdatedAt   time.Time
}

func (s *Store) List(ctx context.Context) ([]Extension, error) {
	rows, err := sqlc.New(s.db).ListExtensions(ctx)
	if err != nil {
		return nil, fmt.Errorf("list extensions: %w", err)
	}

	out := make([]Extension, 0, len(rows))
	for _, row := range rows {
		ext, convErr := fromRow(row)
		if convErr != nil {
			return nil, convErr
		}
		out = append(out, *ext)
	}

	return out, nil
}

// Get returns nil when no such plugin is installed.
func (s *Store) Get(ctx context.Context, id string) (*Extension, error) {
	row, err := sqlc.New(s.db).GetExtension(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read extension %s: %w", id, err)
	}

	return fromRow(row)
}

func (s *Store) Insert(ctx context.Context, manifestURL string, m *manifest.Manifest, config map[string]string, now time.Time) (*Extension, error) {
	raw, cfg, err := encode(m, config)
	if err != nil {
		return nil, err
	}

	row, err := sqlc.New(s.db).InsertExtension(ctx, sqlc.InsertExtensionParams{
		ID:          m.ID,
		ManifestUrl: manifestURL,
		Manifest:    raw,
		Config:      cfg,
		InstalledAt: stamp(now),
		UpdatedAt:   stamp(now),
	})
	if err != nil {
		return nil, fmt.Errorf("save extension %s: %w", m.ID, err)
	}

	return fromRow(row)
}

// Replace keeps the plugin as installed but with a newer manifest and the
// settings that still fit it.
func (s *Store) Replace(ctx context.Context, m *manifest.Manifest, config map[string]string, now time.Time) (*Extension, error) {
	raw, cfg, err := encode(m, config)
	if err != nil {
		return nil, err
	}

	row, err := sqlc.New(s.db).UpdateExtensionManifest(ctx, sqlc.UpdateExtensionManifestParams{
		Manifest:  raw,
		Config:    cfg,
		UpdatedAt: stamp(now),
		ID:        m.ID,
	})
	if err != nil {
		return nil, fmt.Errorf("update extension %s: %w", m.ID, err)
	}

	return fromRow(row)
}

func (s *Store) Settle(ctx context.Context, id string, enabled bool, config map[string]string, now time.Time) (*Extension, error) {
	cfg, err := json.Marshal(config)
	if err != nil {
		return nil, fmt.Errorf("encode settings: %w", err)
	}

	on := int64(0)
	if enabled {
		on = 1
	}

	row, err := sqlc.New(s.db).UpdateExtensionSettings(ctx, sqlc.UpdateExtensionSettingsParams{
		Enabled:   on,
		Config:    string(cfg),
		UpdatedAt: stamp(now),
		ID:        id,
	})
	if err != nil {
		return nil, fmt.Errorf("save settings of %s: %w", id, err)
	}

	return fromRow(row)
}

// Delete reports false when there was nothing to delete.
func (s *Store) Delete(ctx context.Context, id string) (bool, error) {
	n, err := sqlc.New(s.db).DeleteExtension(ctx, id)
	if err != nil {
		return false, fmt.Errorf("delete extension %s: %w", id, err)
	}

	return n > 0, nil
}

func encode(m *manifest.Manifest, config map[string]string) (raw, cfg string, err error) {
	manifestJSON, err := json.Marshal(m)
	if err != nil {
		return "", "", fmt.Errorf("encode manifest: %w", err)
	}

	if config == nil {
		config = map[string]string{}
	}
	configJSON, err := json.Marshal(config)
	if err != nil {
		return "", "", fmt.Errorf("encode settings: %w", err)
	}

	return string(manifestJSON), string(configJSON), nil
}

func fromRow(row sqlc.Extension) (*Extension, error) {
	ext := &Extension{
		ID:          row.ID,
		ManifestURL: row.ManifestUrl,
		Enabled:     row.Enabled != 0,
		Config:      map[string]string{},
	}

	if err := json.Unmarshal([]byte(row.Manifest), &ext.Manifest); err != nil {
		return nil, fmt.Errorf("read the saved manifest of %s: %w", row.ID, err)
	}
	if err := json.Unmarshal([]byte(row.Config), &ext.Config); err != nil {
		return nil, fmt.Errorf("read the saved settings of %s: %w", row.ID, err)
	}

	ext.InstalledAt, _ = time.Parse(time.RFC3339, row.InstalledAt)
	ext.UpdatedAt, _ = time.Parse(time.RFC3339, row.UpdatedAt)

	return ext, nil
}

func stamp(t time.Time) string {
	return t.UTC().Format(time.RFC3339)
}
