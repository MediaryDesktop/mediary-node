// Package repository reads a plugin repository: a list someone publishes of
// plugins and where their manifests are. A repository only ever feeds the
// catalog. Installing goes through the plugin's own manifest, read at its
// address and agreed to as it is, so a repository that describes a plugin
// wrongly cannot get anything else installed.
package repository

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"unicode"

	"github.com/mediaryorg/mediary-node/server/internal/modules/extension/internal/manifest"
)

const (
	// MaxSize is the largest repository the node reads.
	MaxSize = 1 << 20
	// MaxEntries is the most plugins one repository lists.
	MaxEntries = 1000

	maxName        = 64
	maxDescription = 300
	maxURL         = 2048
)

// Repository is a published list of plugins.
type Repository struct {
	Name    string  `json:"name"`
	Plugins []Entry `json:"plugins"`
}

// Entry is one plugin as the repository describes it.
type Entry struct {
	Manifest    string `json:"manifest"`
	ID          string `json:"id"`
	Name        string `json:"name"`
	Version     string `json:"version"`
	Type        string `json:"type"`
	Author      string `json:"author"`
	Description string `json:"description,omitempty"`
	Lang        string `json:"lang,omitempty"`
	Icon        string `json:"icon,omitempty"`
}

var (
	idPattern     = regexp.MustCompile(`^[a-z][a-z0-9-]{1,47}$`)
	semverPattern = regexp.MustCompile(`^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?$`)
	langPattern   = regexp.MustCompile(`^([a-z]{2}|multi)$`)
)

// Parse reads a repository. The list itself has to be well formed; an entry
// that is not — a plugin of a type this node does not run, a manifest that is
// not at an https address — is left out, and counted, so one bad entry does
// not hide the rest. Unknown fields are allowed: a repository is only shown,
// never agreed to.
func Parse(raw []byte) (repo *Repository, skipped int, err error) {
	if len(raw) > MaxSize {
		return nil, 0, fmt.Errorf("the repository is larger than %d KB", MaxSize>>10)
	}

	var parsed struct {
		Name    string            `json:"name"`
		Plugins []json.RawMessage `json:"plugins"`
	}
	if err = json.Unmarshal(raw, &parsed); err != nil {
		return nil, 0, fmt.Errorf("read the repository: %w", err)
	}
	if parsed.Plugins == nil {
		return nil, 0, errors.New(`the repository has no "plugins" list`)
	}
	if len(parsed.Plugins) > MaxEntries {
		return nil, 0, fmt.Errorf("the repository lists more than %d plugins", MaxEntries)
	}

	repo = &Repository{Name: clean(parsed.Name, maxName), Plugins: make([]Entry, 0, len(parsed.Plugins))}

	for _, item := range parsed.Plugins {
		var entry Entry
		if json.Unmarshal(item, &entry) != nil {
			skipped++
			continue
		}

		if checked, ok := check(entry); ok {
			repo.Plugins = append(repo.Plugins, checked)
			continue
		}
		skipped++
	}

	return repo, skipped, nil
}

func check(e Entry) (Entry, bool) {
	if !httpsURL(e.Manifest) || !idPattern.MatchString(e.ID) || !semverPattern.MatchString(e.Version) {
		return Entry{}, false
	}
	if manifest.Type(e.Type) != manifest.TypeTorrentProvider {
		return Entry{}, false
	}

	e.Name = clean(e.Name, maxName)
	e.Author = clean(e.Author, maxName)
	if e.Name == "" || e.Author == "" {
		return Entry{}, false
	}

	e.Description = clean(e.Description, maxDescription)
	if !langPattern.MatchString(e.Lang) {
		e.Lang = ""
	}
	if e.Icon != "" && !httpsURL(e.Icon) {
		e.Icon = ""
	}

	return e, true
}

// HTTPSURL says whether raw is an https:// address without a user name.
func HTTPSURL(raw string) bool {
	return httpsURL(raw)
}

func httpsURL(raw string) bool {
	if raw == "" || len(raw) > maxURL {
		return false
	}

	u, err := url.Parse(raw)

	return err == nil && u.Scheme == "https" && u.Host != "" && u.User == nil
}

// clean folds whitespace, drops control characters and cuts the text to
// length: whatever a repository says ends up on the user's screen.
func clean(text string, limit int) string {
	text = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return ' '
		}
		return r
	}, text)
	text = strings.Join(strings.Fields(text), " ")

	runes := []rune(text)
	if len(runes) > limit {
		text = string(runes[:limit])
	}

	return text
}
