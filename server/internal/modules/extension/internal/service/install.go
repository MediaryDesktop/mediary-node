package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sync"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/extension/internal/manifest"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/extension/internal/sandbox"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/extension/internal/store"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

// maxCode is the largest plugin the node downloads. A provider that reads
// a tracker's pages is a few kilobytes.
const maxCode = 2 << 20

const codeFile = "plugin.js"

// Preview reads the manifest at an address and says what installing it means.
// Nothing is downloaded but the manifest; nothing is saved.
func (s *Service) Preview(ctx context.Context, manifestURL string) (*ExtensionPreview, error) {
	m, err := s.fetchManifest(ctx, manifestURL)
	if err != nil {
		return nil, err
	}

	preview := &ExtensionPreview{
		Info:        info(m),
		Config:      fields(m),
		ManifestURL: manifestURL,
		Consent:     consentOf(m),
		MinNode:     m.MinNodeVersion,
		Compatible:  s.compatible(m),
	}

	if ext, getErr := s.store.Get(ctx, m.ID); getErr == nil && ext != nil {
		preview.Installed = ext.Manifest.Version
	}

	return preview, nil
}

// Install puts in exactly the plugin the user saw: the manifest is read again,
// and if it is not the one consent was given for, nothing is installed.
func (s *Service) Install(ctx context.Context, manifestURL, consent string) (*Extension, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	m, err := s.fetchManifest(ctx, manifestURL)
	if err != nil {
		return nil, err
	}
	if consentOf(m) != consent {
		return nil, apperr.New(apperr.KindConflict, "the plugin changed since it was shown; look at it again before installing")
	}

	existing, err := s.store.Get(ctx, m.ID)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read plugin %s", m.ID)
	}
	if existing != nil {
		return nil, apperr.New(apperr.KindConflict, "%s is already installed; update it instead", m.Name)
	}

	if !s.compatible(m) {
		return nil, apperr.New(apperr.KindPrecondition, "%s needs a newer Mediary (%s or later)", m.Name, m.MinNodeVersion)
	}

	if fetchErr := s.fetchCode(ctx, m); fetchErr != nil {
		return nil, fetchErr
	}

	ext, err := s.store.Insert(ctx, manifestURL, m, nil, s.opts.Now())
	if err != nil {
		_ = os.RemoveAll(filepath.Join(s.opts.Dir, m.ID))
		return nil, apperr.Wrap(err, apperr.KindInternal, "save plugin %s", m.ID)
	}

	s.logger.Info().Str("plugin", m.ID).Str("version", m.Version).Str("from", manifestURL).Msg("plugin installed")
	s.publish(m.ID)

	return s.view(ext)
}

// CheckUpdates reads every plugin's manifest at the address it came from.
// Nothing is installed; what was found is kept for the list and the update.
func (s *Service) CheckUpdates(ctx context.Context) ([]Extension, error) {
	exts, err := s.store.List(ctx)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "list plugins")
	}

	found := make(map[string]ExtensionUpdate, len(exts))
	var mu sync.Mutex
	var wg sync.WaitGroup
	slots := make(chan struct{}, 4)

	for i := range exts {
		ext := exts[i]
		wg.Add(1)
		go func() {
			defer wg.Done()
			slots <- struct{}{}
			defer func() { <-slots }()

			update, ok := s.checkOne(ctx, &ext)
			if ok {
				mu.Lock()
				found[ext.ID] = update
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	s.updatesMu.Lock()
	s.updates = found
	s.updatesMu.Unlock()

	return s.List(ctx)
}

// checkOne reports false when the plugin is up to date.
func (s *Service) checkOne(ctx context.Context, ext *store.Extension) (ExtensionUpdate, bool) {
	m, err := s.fetchManifest(ctx, ext.ManifestURL)
	if err != nil {
		return ExtensionUpdate{Error: messageOf(err)}, true
	}

	if m.ID != ext.ID {
		return ExtensionUpdate{Error: fmt.Sprintf("the address now holds another plugin, %q", m.ID)}, true
	}
	if !newer(m.Version, ext.Manifest.Version) {
		return ExtensionUpdate{}, false
	}

	added := addedHosts(ext.Manifest.Network, m.Network)

	return ExtensionUpdate{
		Version:      m.Version,
		Consent:      consentOf(m),
		AddedHosts:   added,
		NeedsConsent: len(added) > 0 || m.Type != ext.Manifest.Type,
		Compatible:   s.compatible(m),
	}, true
}

// Update installs the newer version at the plugin's own address — never one
// from anywhere else, and never an older one. Like an install, it takes the
// consent for exactly the manifest the user was shown.
func (s *Service) Update(ctx context.Context, id, consent string) (*Extension, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	ext, err := s.installed(ctx, id)
	if err != nil {
		return nil, err
	}

	m, err := s.fetchManifest(ctx, ext.ManifestURL)
	if err != nil {
		return nil, err
	}
	if m.ID != ext.ID {
		return nil, apperr.New(apperr.KindUpstream, "the address %s now holds another plugin, %q", ext.ManifestURL, m.ID)
	}
	if !newer(m.Version, ext.Manifest.Version) {
		return nil, apperr.New(apperr.KindConflict, "%s %s is the newest version", ext.Manifest.Name, ext.Manifest.Version)
	}
	if consentOf(m) != consent {
		return nil, apperr.New(apperr.KindConflict, "the update changed since it was shown; check for updates again")
	}
	if !s.compatible(m) {
		return nil, apperr.New(apperr.KindPrecondition, "%s %s needs a newer Mediary (%s or later)", m.Name, m.Version, m.MinNodeVersion)
	}

	if fetchErr := s.fetchCode(ctx, m); fetchErr != nil {
		return nil, fetchErr
	}

	config, dropped := keptSettings(&ext.Manifest, ext.Config, m)

	updated, err := s.store.Replace(ctx, m, config, s.opts.Now())
	if err != nil {
		_ = os.RemoveAll(filepath.Join(s.opts.Dir, m.ID, m.Version))
		return nil, apperr.Wrap(err, apperr.KindInternal, "save plugin %s", m.ID)
	}

	// Secrets of fields the new version no longer has go with them.
	for _, name := range dropped {
		_ = s.secrets.Set(secretKey(id, name), "")
	}
	_ = os.RemoveAll(filepath.Join(s.opts.Dir, id, ext.Manifest.Version))

	s.updatesMu.Lock()
	delete(s.updates, id)
	s.updatesMu.Unlock()

	s.logger.Info().Str("plugin", id).Str("from", ext.Manifest.Version).Str("to", m.Version).Msg("plugin updated")
	s.publish(id)

	return s.view(updated)
}

// keptSettings carries over the values that still fit the new manifest, and
// names the old secret fields it no longer keeps secret — their values go.
func keptSettings(prev *manifest.Manifest, saved map[string]string, next *manifest.Manifest) (kept map[string]string, dropped []string) {
	byName := map[string]manifest.ConfigField{}
	for _, f := range next.Config {
		byName[f.Name] = f
	}

	kept = map[string]string{}
	for name, value := range saved {
		if f, ok := byName[name]; ok && !f.Secret && validValue(f, value) == nil {
			kept[name] = value
		}
	}

	for _, f := range prev.Config {
		if !f.Secret {
			continue
		}
		if now, ok := byName[f.Name]; !ok || !now.Secret {
			dropped = append(dropped, f.Name)
		}
	}

	return kept, dropped
}

// Remove deletes the plugin, its code and its secrets.
func (s *Service) Remove(ctx context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	ext, err := s.installed(ctx, id)
	if err != nil {
		return err
	}

	if _, err = s.store.Delete(ctx, id); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "remove plugin %s", id)
	}

	for _, f := range ext.Manifest.Config {
		if f.Secret {
			_ = s.secrets.Set(secretKey(id, f.Name), "")
		}
	}
	if err = os.RemoveAll(filepath.Join(s.opts.Dir, id)); err != nil {
		s.logger.Warn().Err(err).Str("plugin", id).Msg("the plugin's code stays on disk")
	}

	s.updatesMu.Lock()
	delete(s.updates, id)
	s.updatesMu.Unlock()

	s.logger.Info().Str("plugin", id).Msg("plugin removed")
	s.publish(id)

	return nil
}

// Code reads a plugin's saved code and checks it against the manifest the
// user agreed to: a file changed on disk is not run.
func (s *Service) Code(ext *store.Extension) (string, error) {
	path := filepath.Join(s.opts.Dir, ext.ID, ext.Manifest.Version, codeFile)

	raw, err := os.ReadFile(path) //nolint:gosec // the node's own plugins folder
	if err != nil {
		return "", fmt.Errorf("read the code of %s: %w", ext.ID, err)
	}

	if sum := sha256.Sum256(raw); hex.EncodeToString(sum[:]) != ext.Manifest.SHA256 {
		return "", fmt.Errorf("the code of %s on disk does not match its manifest", ext.ID)
	}

	return string(raw), nil
}

func (s *Service) fetchManifest(ctx context.Context, rawURL string) (*manifest.Manifest, error) {
	u, err := url.Parse(rawURL)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil {
		return nil, apperr.Invalid("url", "a plugin's manifest is at an https:// address")
	}

	raw, err := s.download(ctx, u.String(), manifest.MaxSize)
	if err != nil {
		return nil, apperr.Wrap(err, kindOfFetch(err), "could not read the manifest: %s", messageOf(err))
	}

	m, err := manifest.Parse(raw)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInvalid, "%s", err.Error())
	}

	return m, nil
}

// fetchCode downloads the plugin's code, refuses it unless it hashes to the
// manifest's sum and parses, and saves it where Code reads it.
func (s *Service) fetchCode(ctx context.Context, m *manifest.Manifest) error {
	raw, err := s.download(ctx, m.Payload, maxCode)
	if err != nil {
		return apperr.Wrap(err, kindOfFetch(err), "could not download the plugin's code: %s", messageOf(err))
	}

	if sum := sha256.Sum256(raw); hex.EncodeToString(sum[:]) != m.SHA256 {
		return apperr.New(apperr.KindUpstream, "the code at %s does not match the sum in the manifest; nothing was installed", m.Payload)
	}

	if err = sandbox.Compile(m.ID+".js", string(raw)); err != nil {
		return apperr.Wrap(err, apperr.KindInvalid, "the plugin's code does not parse: %v", err)
	}

	dir := filepath.Join(s.opts.Dir, m.ID, m.Version)
	if err = os.MkdirAll(dir, 0o750); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "create the plugin's folder")
	}

	tmp := filepath.Join(dir, codeFile+".tmp")
	if err = os.WriteFile(tmp, raw, 0o600); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "save the plugin's code")
	}
	if err = os.Rename(tmp, filepath.Join(dir, codeFile)); err != nil {
		_ = os.Remove(tmp)
		return apperr.Wrap(err, apperr.KindInternal, "save the plugin's code")
	}

	return nil
}

var errTooLarge = errors.New("the file is larger than expected")

func (s *Service) download(ctx context.Context, rawURL string, limit int64) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, http.NoBody)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mediary")

	resp, err := s.opts.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s answered %s", rawURL, resp.Status)
	}

	raw, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(raw)) > limit {
		return nil, errTooLarge
	}

	return raw, nil
}

// kindOfFetch tells an address the node refuses — a local one, which the
// user or the manifest gave — from a server that failed to answer.
func kindOfFetch(err error) apperr.Kind {
	var local *sandbox.LocalAddressError
	if errors.As(err, &local) {
		return apperr.KindInvalid
	}

	return apperr.KindUpstream
}

// messageOf is an error without the HTTP client's wrapping.
func messageOf(err error) string {
	var appErr *apperr.Error
	if errors.As(err, &appErr) {
		return appErr.Message
	}

	var urlErr *url.Error
	if errors.As(err, &urlErr) {
		return urlErr.Err.Error()
	}

	return err.Error()
}
