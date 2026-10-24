// Package manifest reads and checks a plugin's manifest: what the plugin is,
// which sites it may reach, what it asks the user for, and where its code is.
// Nothing here runs the plugin; a manifest that fails Validate is never
// shown to the user to agree to.
package manifest

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/url"
	"regexp"
	"strings"
)

// MaxSize is the largest manifest the node reads. A real one is a few hundred
// bytes; anything near this is not a manifest.
const MaxSize = 64 << 10

const (
	maxNetwork     = 20
	maxConfig      = 20
	maxOptions     = 50
	maxName        = 64
	maxDescription = 300
	maxAuthor      = 64
	maxLabel       = 64
	maxURL         = 2048
)

// Type is the one role a plugin plays. The type is the whole of what it may
// do: a torrent provider is handed a search and returns releases; a manga
// provider finds series, lists their chapters and names the pages' images.
type Type string

const (
	TypeTorrentProvider Type = "torrent-provider"
	TypeMangaProvider   Type = "manga-provider"
)

var types = map[Type]bool{TypeTorrentProvider: true, TypeMangaProvider: true}

// Known reports whether the node can run a plugin of this type.
func Known(t Type) bool {
	return types[t]
}

type Manifest struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Version     string `json:"version"`
	Type        Type   `json:"type"`
	Author      string `json:"author"`
	Description string `json:"description,omitempty"`

	// Lang is an ISO 639-1 code, or "multi".
	Lang string `json:"lang"`

	Icon     string `json:"icon,omitempty"`
	Homepage string `json:"homepage,omitempty"`

	// MinNodeVersion is the oldest node the plugin works with; empty means any.
	MinNodeVersion string `json:"minNodeVersion,omitempty"`

	// Network is every host the plugin's fetch may reach. "*.example.org"
	// covers the subdomains of example.org, not example.org itself.
	Network []string `json:"network"`

	Config []ConfigField `json:"config,omitempty"`

	// Payload is where the code is; SHA256 is what it must hash to.
	Payload string `json:"payload"`
	SHA256  string `json:"sha256"`
}

type ConfigType string

const (
	ConfigText   ConfigType = "text"
	ConfigSelect ConfigType = "select"
	ConfigSwitch ConfigType = "switch"
)

type ConfigField struct {
	Name    string     `json:"name"`
	Label   string     `json:"label"`
	Type    ConfigType `json:"type"`
	Options []string   `json:"options,omitempty"`
	Default string     `json:"default,omitempty"`

	// Secret keeps the value out of the database and out of every answer the
	// node gives: an API key, a password.
	Secret bool `json:"secret,omitempty"`
}

var (
	idPattern     = regexp.MustCompile(`^[a-z][a-z0-9-]{1,47}$`)
	semverPattern = regexp.MustCompile(`^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?$`)
	langPattern   = regexp.MustCompile(`^([a-z]{2}|multi)$`)
	configPattern = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_]{0,31}$`)
	hashPattern   = regexp.MustCompile(`^[0-9a-f]{64}$`)
	labelPattern  = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`)
)

// Parse reads a manifest strictly: unknown fields are an error, so a manifest
// written for a newer node — one that might ask for something this node does
// not know to show — is refused rather than half understood.
func Parse(raw []byte) (*Manifest, error) {
	if len(raw) > MaxSize {
		return nil, fmt.Errorf("the manifest is larger than %d KB", MaxSize>>10)
	}

	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()

	var m Manifest
	if err := decoder.Decode(&m); err != nil {
		return nil, fmt.Errorf("read the manifest: %w", err)
	}
	if decoder.More() {
		return nil, errors.New("read the manifest: more than one JSON value")
	}

	if err := m.Validate(); err != nil {
		return nil, err
	}

	return &m, nil
}

// Validate collects every problem, so an author fixes the manifest in one go.
func (m *Manifest) Validate() error {
	var problems []string
	fail := func(format string, args ...any) {
		problems = append(problems, fmt.Sprintf(format, args...))
	}

	if !idPattern.MatchString(m.ID) {
		fail("id %q: 2–48 lowercase letters, digits and hyphens, starting with a letter", m.ID)
	}
	if text := strings.TrimSpace(m.Name); text == "" || len(text) > maxName {
		fail("name: 1–%d characters", maxName)
	}
	if !semverPattern.MatchString(m.Version) {
		fail("version %q is not a semantic version like 1.2.0", m.Version)
	}
	if !types[m.Type] {
		fail("type %q is not one the node knows; it knows %q and %q", m.Type, TypeTorrentProvider, TypeMangaProvider)
	}
	if text := strings.TrimSpace(m.Author); text == "" || len(text) > maxAuthor {
		fail("author: 1–%d characters", maxAuthor)
	}
	if len(m.Description) > maxDescription {
		fail("description: at most %d characters", maxDescription)
	}
	if !langPattern.MatchString(m.Lang) {
		fail("lang %q: a two-letter ISO 639-1 code or \"multi\"", m.Lang)
	}
	if m.MinNodeVersion != "" && !semverPattern.MatchString(m.MinNodeVersion) {
		fail("minNodeVersion %q is not a semantic version", m.MinNodeVersion)
	}

	for _, field := range []struct{ name, value string }{{"icon", m.Icon}, {"homepage", m.Homepage}} {
		if field.value != "" {
			if err := checkHTTPS(field.value); err != nil {
				fail("%s: %v", field.name, err)
			}
		}
	}

	if err := checkHTTPS(m.Payload); err != nil {
		fail("payload: %v", err)
	}
	if !hashPattern.MatchString(m.SHA256) {
		fail("sha256: 64 lowercase hex digits")
	}

	checkNetwork(m.Network, fail)
	checkConfig(m.Config, fail)

	if len(problems) > 0 {
		return &InvalidError{Problems: problems}
	}

	return nil
}

// InvalidError lists everything wrong with a manifest.
type InvalidError struct {
	Problems []string
}

func (e *InvalidError) Error() string {
	return "the manifest is not valid: " + strings.Join(e.Problems, "; ")
}

func checkHTTPS(raw string) error {
	if len(raw) > maxURL {
		return fmt.Errorf("longer than %d characters", maxURL)
	}

	u, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("%q is not an address", raw)
	}
	if u.Scheme != "https" || u.Host == "" {
		return fmt.Errorf("%q is not an https:// address", raw)
	}
	if u.User != nil {
		return fmt.Errorf("%q carries a user name or password", raw)
	}

	return nil
}

// checkNetwork accepts host names only. An IP address would let a manifest
// name a machine on the user's own network outright; "*" would be every site.
func checkNetwork(hosts []string, fail func(string, ...any)) {
	if len(hosts) > maxNetwork {
		fail("network: at most %d hosts", maxNetwork)
	}

	seen := map[string]bool{}
	for _, host := range hosts {
		if seen[host] {
			fail("network: %q twice", host)
			continue
		}
		seen[host] = true

		if err := CheckHost(host); err != nil {
			fail("network: %v", err)
		}
	}
}

// CheckHost says whether a network entry is a plain lowercase host name, or
// "*." in front of one.
func CheckHost(host string) error {
	if host == "*" || strings.Contains(host, "**") {
		return fmt.Errorf("%q: a plugin names its sites; every site is not one", host)
	}

	name := strings.TrimPrefix(host, "*.")
	if strings.Contains(name, "*") {
		return fmt.Errorf("%q: a wildcard only as \"*.\" at the start", host)
	}

	if net.ParseIP(strings.Trim(name, "[]")) != nil {
		return fmt.Errorf("%q: an IP address, not a host name", host)
	}

	if name != strings.ToLower(name) {
		return fmt.Errorf("%q: host names are written in lowercase", host)
	}

	labels := strings.Split(name, ".")
	if len(labels) < 2 || len(name) > 253 {
		return fmt.Errorf("%q is not a host name like example.org", host)
	}

	for _, label := range labels {
		if !labelPattern.MatchString(label) {
			return fmt.Errorf("%q is not a host name like example.org", host)
		}
	}

	// A top-level part made of digits only is an address in disguise
	// (127.1 and the like), never a real domain.
	if last := labels[len(labels)-1]; strings.Trim(last, "0123456789") == "" {
		return fmt.Errorf("%q: an IP address, not a host name", host)
	}

	return nil
}

func checkConfig(fields []ConfigField, fail func(string, ...any)) {
	if len(fields) > maxConfig {
		fail("config: at most %d fields", maxConfig)
	}

	seen := map[string]bool{}
	for _, field := range fields {
		where := fmt.Sprintf("config %q", field.Name)

		if !configPattern.MatchString(field.Name) {
			fail("%s: a name of letters, digits and underscores, starting with a letter", where)
		}
		if seen[field.Name] {
			fail("%s: twice", where)
		}
		seen[field.Name] = true

		if text := strings.TrimSpace(field.Label); text == "" || len(text) > maxLabel {
			fail("%s: label of 1–%d characters", where, maxLabel)
		}

		switch field.Type {
		case ConfigText:
			if len(field.Options) > 0 {
				fail("%s: only a select has options", where)
			}
		case ConfigSelect:
			if len(field.Options) == 0 || len(field.Options) > maxOptions {
				fail("%s: a select needs 1–%d options", where, maxOptions)
			}
			if field.Default != "" && !contains(field.Options, field.Default) {
				fail("%s: default %q is not one of the options", where, field.Default)
			}
		case ConfigSwitch:
			if len(field.Options) > 0 {
				fail("%s: only a select has options", where)
			}
			if field.Default != "" && field.Default != "true" && field.Default != "false" {
				fail("%s: a switch defaults to \"true\" or \"false\"", where)
			}
		default:
			fail("%s: type %q; text, select or switch", where, field.Type)
		}

		if field.Secret && field.Type != ConfigText {
			fail("%s: only a text field can be secret", where)
		}
		if field.Secret && field.Default != "" {
			fail("%s: a secret has no default", where)
		}
	}
}

func contains(values []string, value string) bool {
	for _, v := range values {
		if v == value {
			return true
		}
	}

	return false
}
