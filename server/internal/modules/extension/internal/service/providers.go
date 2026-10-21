package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/mediaryorg/mediary-node/server/internal/modules/extension/internal/manifest"
	"github.com/mediaryorg/mediary-node/server/internal/modules/extension/internal/sandbox"
	"github.com/mediaryorg/mediary-node/server/internal/modules/extension/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// perPlugin is how many calls one plugin runs at once. A search fans out into
// several queries, and the site behind a plugin is not ours to hammer.
const perPlugin = 2

// TorrentProvider is a plugin on now that searches for torrents.
type TorrentProvider struct {
	ID   string
	Name string
	// Revision changes whenever the plugin could answer differently — other
	// code, other settings — so answers kept under the last one are not reused.
	Revision string
}

func (s *Service) TorrentProviders(ctx context.Context) ([]TorrentProvider, error) {
	exts, err := s.store.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("list plugins: %w", err)
	}

	var out []TorrentProvider
	for i := range exts {
		ext := &exts[i]
		if !ext.Enabled || ext.Manifest.Type != manifest.TypeTorrentProvider {
			continue
		}

		revision, revErr := s.revision(ext)
		if revErr != nil {
			return nil, revErr
		}
		out = append(out, TorrentProvider{ID: ext.ID, Name: ext.Manifest.Name, Revision: revision})
	}

	return out, nil
}

// revision is a fingerprint of what the plugin's answer depends on: its code,
// by the manifest's sum, and its settings as it runs with them. A secret leaves
// only its share of the hash.
func (s *Service) revision(ext *store.Extension) (string, error) {
	config, err := s.RuntimeConfig(ext)
	if err != nil {
		return "", err
	}

	raw, err := json.Marshal(struct {
		Code   string
		Config map[string]string
	}{ext.Manifest.SHA256, config})
	if err != nil {
		return "", fmt.Errorf("fingerprint %s: %w", ext.ID, err)
	}

	sum := sha256.Sum256(raw)

	return hex.EncodeToString(sum[:12]), nil
}

// SearchTorrents runs one plugin's search in the sandbox.
func (s *Service) SearchTorrents(ctx context.Context, id string, req sandbox.SearchRequest) ([]sandbox.Release, error) {
	plugin, err := s.runnable(ctx, id)
	if err != nil {
		return nil, err
	}

	release, err := s.slot(ctx, id)
	if err != nil {
		return nil, err
	}
	defer release()

	return s.opts.Runner.Search(ctx, plugin, req)
}

// FetchTorrent downloads the .torrent a plugin's release links to, under that
// plugin's hosts.
func (s *Service) FetchTorrent(ctx context.Context, id, link string) (data []byte, magnet string, err error) {
	plugin, err := s.runnable(ctx, id)
	if err != nil {
		return nil, "", err
	}

	return s.opts.Runner.FetchTorrent(ctx, plugin, link)
}

// runnable is the plugin as the sandbox runs it: on, a torrent provider, its
// code matching the manifest the user agreed to, its settings filled in.
func (s *Service) runnable(ctx context.Context, id string) (sandbox.Plugin, error) {
	if s.opts.Runner == nil {
		return sandbox.Plugin{}, apperr.New(apperr.KindUnavailable, "plugins do not run on this node")
	}

	ext, err := s.installed(ctx, id)
	if err != nil {
		return sandbox.Plugin{}, err
	}
	if !ext.Enabled {
		return sandbox.Plugin{}, apperr.New(apperr.KindPrecondition, "%s is turned off", ext.Manifest.Name)
	}
	if ext.Manifest.Type != manifest.TypeTorrentProvider {
		return sandbox.Plugin{}, apperr.New(apperr.KindPrecondition, "%s does not search for torrents", ext.Manifest.Name)
	}

	return s.sandboxed(ext)
}

func (s *Service) sandboxed(ext *store.Extension) (sandbox.Plugin, error) {
	code, err := s.Code(ext)
	if err != nil {
		return sandbox.Plugin{}, apperr.Wrap(err, apperr.KindInternal, "%v; reinstall the plugin", err)
	}

	config, err := s.RuntimeConfig(ext)
	if err != nil {
		return sandbox.Plugin{}, apperr.Wrap(err, apperr.KindInternal, "read the settings of %s", ext.ID)
	}

	return sandbox.Plugin{ID: ext.ID, Code: code, Network: ext.Manifest.Network, Config: config}, nil
}

// slot waits for one of the plugin's places, or for the caller to give up.
func (s *Service) slot(ctx context.Context, id string) (release func(), err error) {
	s.slotsMu.Lock()
	slots, ok := s.slots[id]
	if !ok {
		slots = make(chan struct{}, perPlugin)
		s.slots[id] = slots
	}
	s.slotsMu.Unlock()

	select {
	case slots <- struct{}{}:
		return func() { <-slots }, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}
