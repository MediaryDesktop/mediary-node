package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"golang.org/x/mod/semver"

	"github.com/mediaryorg/mediary-node/server/internal/modules/extension/internal/manifest"
	"github.com/mediaryorg/mediary-node/server/internal/modules/extension/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
	"github.com/mediaryorg/mediary-node/server/internal/platform/secrets"
)

type Options struct {
	// Dir holds each plugin's code, a folder per version.
	Dir string
	// NodeVersion is checked against a manifest's minNodeVersion; a build
	// that is not a release — a commit hash — is not checked.
	NodeVersion string
	// HTTP fetches manifests and code; it must refuse local addresses.
	HTTP *http.Client
	Now  func() time.Time
}

type Service struct {
	store   *store.Store
	secrets *secrets.Store
	logger  zerolog.Logger
	hub     *events.Hub
	opts    Options

	// One install, update or removal at a time: they touch the same folders
	// and rows, and a user clicks twice.
	mu sync.Mutex

	// What the last update check found, by plugin.
	updatesMu sync.Mutex
	updates   map[string]Update

	catalog catalogCache
}

func New(st *store.Store, sec *secrets.Store, logger zerolog.Logger, hub *events.Hub, opts Options) *Service {
	if opts.Now == nil {
		opts.Now = time.Now
	}

	return &Service{
		store:   st,
		secrets: sec,
		logger:  logger,
		hub:     hub,
		opts:    opts,
		updates: map[string]Update{},
		catalog: catalogCache{reads: map[int64]read{}},
	}
}

func (s *Service) Status(context.Context) (bool, error) {
	return s.store.Ready(), nil
}

// Info is what a manifest says about a plugin, as the user sees it.
type Info struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Version     string   `json:"version"`
	Type        string   `json:"type" enum:"torrent-provider"`
	Author      string   `json:"author"`
	Description string   `json:"description,omitempty"`
	Lang        string   `json:"lang"`
	Icon        string   `json:"icon,omitempty"`
	Homepage    string   `json:"homepage,omitempty"`
	Network     []string `json:"network" doc:"Every host the plugin may reach. Nothing else is reachable to it."`
}

type ConfigField struct {
	Name    string   `json:"name"`
	Label   string   `json:"label"`
	Type    string   `json:"type" enum:"text,select,switch"`
	Options []string `json:"options,omitempty"`
	Default string   `json:"default,omitempty"`
	Secret  bool     `json:"secret"`
	// Value is the setting as saved; a secret's is never sent.
	Value string `json:"value,omitempty"`
	// Set says whether a secret has a value.
	Set bool `json:"set"`
}

// Extension is an installed plugin.
type Extension struct {
	Info
	Config      []ConfigField `json:"config"`
	Enabled     bool          `json:"enabled"`
	ManifestURL string        `json:"manifest_url"`
	InstalledAt time.Time     `json:"installed_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
	Update      *Update       `json:"update,omitempty" doc:"What the last update check found."`
}

// Preview is a plugin about to be installed: everything the user agrees to,
// and the consent that installing it takes.
type Preview struct {
	Info
	Config      []ConfigField `json:"config"`
	ManifestURL string        `json:"manifest_url"`
	Consent     string        `json:"consent" doc:"Pass back to install exactly this; a manifest that changed in between is refused."`
	Installed   string        `json:"installed,omitempty" doc:"The version already installed, if any."`
	MinNode     string        `json:"min_node_version,omitempty"`
	Compatible  bool          `json:"compatible"`
}

// Update is a newer version waiting at the plugin's address.
type Update struct {
	Version    string   `json:"version,omitempty"`
	Consent    string   `json:"consent,omitempty"`
	AddedHosts []string `json:"added_hosts,omitempty" doc:"Hosts the new version reaches that this one does not."`
	// NeedsConsent is set when the new version reaches new hosts or plays
	// another role: the user agrees to it as to a new plugin.
	NeedsConsent bool   `json:"needs_consent"`
	Compatible   bool   `json:"compatible"`
	Error        string `json:"error,omitempty" doc:"Why the check could not tell."`
}

func info(m *manifest.Manifest) Info {
	network := m.Network
	if network == nil {
		network = []string{}
	}

	return Info{
		ID:          m.ID,
		Name:        m.Name,
		Version:     m.Version,
		Type:        string(m.Type),
		Author:      m.Author,
		Description: m.Description,
		Lang:        m.Lang,
		Icon:        m.Icon,
		Homepage:    m.Homepage,
		Network:     network,
	}
}

func fields(m *manifest.Manifest) []ConfigField {
	out := make([]ConfigField, 0, len(m.Config))
	for _, f := range m.Config {
		out = append(out, ConfigField{
			Name:    f.Name,
			Label:   f.Label,
			Type:    string(f.Type),
			Options: f.Options,
			Default: f.Default,
			Secret:  f.Secret,
		})
	}

	return out
}

func (s *Service) view(ext *store.Extension) (*Extension, error) {
	config := fields(&ext.Manifest)
	for i := range config {
		if config[i].Secret {
			value, err := s.secrets.Get(secretKey(ext.ID, config[i].Name))
			if err != nil {
				return nil, apperr.Wrap(err, apperr.KindInternal, "read the settings of %s", ext.ID)
			}
			config[i].Set = value != ""
			continue
		}
		config[i].Value = ext.Config[config[i].Name]
	}

	out := &Extension{
		Info:        info(&ext.Manifest),
		Config:      config,
		Enabled:     ext.Enabled,
		ManifestURL: ext.ManifestURL,
		InstalledAt: ext.InstalledAt,
		UpdatedAt:   ext.UpdatedAt,
	}

	s.updatesMu.Lock()
	if update, ok := s.updates[ext.ID]; ok {
		out.Update = &update
	}
	s.updatesMu.Unlock()

	return out, nil
}

func (s *Service) List(ctx context.Context) ([]Extension, error) {
	exts, err := s.store.List(ctx)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "list plugins")
	}

	out := make([]Extension, 0, len(exts))
	for i := range exts {
		v, viewErr := s.view(&exts[i])
		if viewErr != nil {
			return nil, viewErr
		}
		out = append(out, *v)
	}

	return out, nil
}

func (s *Service) Get(ctx context.Context, id string) (*Extension, error) {
	ext, err := s.installed(ctx, id)
	if err != nil {
		return nil, err
	}

	return s.view(ext)
}

func (s *Service) installed(ctx context.Context, id string) (*store.Extension, error) {
	ext, err := s.store.Get(ctx, id)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read plugin %s", id)
	}
	if ext == nil {
		return nil, apperr.New(apperr.KindNotFound, "no plugin %q is installed", id)
	}

	return ext, nil
}

// consentOf is what the user agrees to, as one value: the manifest as the
// node understood it. Any change to it — a host, a setting, the code's sum —
// is a different consent.
func consentOf(m *manifest.Manifest) string {
	raw, _ := json.Marshal(m)
	sum := sha256.Sum256(raw)

	return hex.EncodeToString(sum[:])
}

// compatible says whether the node is new enough. A build that is not a
// release has no version to compare and is taken as new enough.
func (s *Service) compatible(m *manifest.Manifest) bool {
	if m.MinNodeVersion == "" {
		return true
	}

	node := "v" + strings.TrimPrefix(s.opts.NodeVersion, "v")
	if i := strings.Index(node, "-"); i > 0 && strings.Contains(node[i:], "-g") {
		node = node[:i] // a git describe suffix: commits after the release
	}
	// 0.0.0-dev is what a build without git calls itself.
	if !semver.IsValid(node) || strings.Contains(semver.Prerelease(node), "dev") {
		return true
	}

	return semver.Compare(node, "v"+m.MinNodeVersion) >= 0
}

func newer(candidate, current string) bool {
	return semver.Compare("v"+candidate, "v"+current) > 0
}

// addedHosts are the hosts next reaches that prev does not.
func addedHosts(prev, next []string) []string {
	var added []string
	for _, host := range next {
		if !slices.Contains(prev, host) {
			added = append(added, host)
		}
	}

	return added
}

func secretKey(id, field string) string {
	return "extension." + id + "." + field
}

// publish announces a change to a plugin, or to the repositories when id is
// empty.
func (s *Service) publish(id string) {
	if s.hub == nil {
		return
	}

	payload := map[string]any{}
	if id != "" {
		payload["id"] = id
	}
	s.hub.Publish(events.TopicExtension, payload)
}
