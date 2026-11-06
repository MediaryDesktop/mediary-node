package service

import (
	"context"
	"fmt"
	"maps"
	"slices"
	"unicode"
	"unicode/utf8"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/extension/internal/manifest"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/extension/internal/store"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

const maxValue = 2000

// Settings changes a plugin. Nil Enabled keeps it as it is. Config holds
// only the fields to change: an empty value goes back to the default — or,
// for a secret, removes it.
type Settings struct {
	Enabled *bool
	Config  map[string]string
}

func (s *Service) Configure(ctx context.Context, id string, in Settings) (*Extension, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	ext, err := s.installed(ctx, id)
	if err != nil {
		return nil, err
	}

	byName := map[string]manifest.ConfigField{}
	for _, f := range ext.Manifest.Config {
		byName[f.Name] = f
	}

	// Every value is checked before any is saved: half a change is worse
	// than none.
	for name, value := range in.Config {
		f, ok := byName[name]
		if !ok {
			return nil, apperr.Invalid("config", "%s has no setting %q", ext.Manifest.Name, name)
		}
		if err = validValue(f, value); err != nil {
			return nil, apperr.Invalid("config", "%s: %v", f.Label, err)
		}
	}

	config := maps.Clone(ext.Config)
	for name, value := range in.Config {
		f := byName[name]
		switch {
		case f.Secret:
			if err = s.secrets.Set(secretKey(id, name), value); err != nil {
				return nil, apperr.Wrap(err, apperr.KindInternal, "save the settings of %s", id)
			}
		case value == "":
			delete(config, name)
		default:
			config[name] = value
		}
	}

	enabled := ext.Enabled
	if in.Enabled != nil {
		enabled = *in.Enabled
	}

	updated, err := s.store.Settle(ctx, id, enabled, config, s.opts.Now())
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "save the settings of %s", id)
	}

	s.publish(id)

	return s.view(updated)
}

// validValue checks one value against its field. Empty is always allowed:
// it means the default, or no secret.
func validValue(f manifest.ConfigField, value string) error {
	if value == "" {
		return nil
	}

	switch f.Type {
	case manifest.ConfigSelect:
		if !slices.Contains(f.Options, value) {
			return fmt.Errorf("%q is not one of its options", value)
		}
	case manifest.ConfigSwitch:
		if value != "true" && value != "false" {
			return fmt.Errorf("a switch is \"true\" or \"false\"")
		}
	case manifest.ConfigText:
		if len(value) > maxValue || !utf8.ValidString(value) {
			return fmt.Errorf("at most %d characters", maxValue)
		}
		for _, r := range value {
			if unicode.IsControl(r) {
				return fmt.Errorf("no control characters")
			}
		}
	}

	return nil
}

// RuntimeConfig is what the plugin reads as config: every field, with the
// user's value, else the default.
func (s *Service) RuntimeConfig(ext *store.Extension) (map[string]string, error) {
	out := make(map[string]string, len(ext.Manifest.Config))

	for _, f := range ext.Manifest.Config {
		value := f.Default
		if f.Secret {
			secret, err := s.secrets.Get(secretKey(ext.ID, f.Name))
			if err != nil {
				return nil, fmt.Errorf("read the settings of %s: %w", ext.ID, err)
			}
			value = secret
		} else if saved, ok := ext.Config[f.Name]; ok {
			value = saved
		}
		out[f.Name] = value
	}

	return out, nil
}
