package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/extension/internal/sandbox"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/extension/internal/store"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/db"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/secrets"
)

const code = `class Provider { async search() { return [] } }`

// host serves plugins over https; a test changes what it serves mid-way.
type host struct {
	server *httptest.Server
	mu     sync.Mutex
	files  map[string]string
	hits   map[string]int
}

func newHost(t *testing.T) *host {
	t.Helper()

	h := &host{files: map[string]string{}, hits: map[string]int{}}
	h.server = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h.mu.Lock()
		body, ok := h.files[r.URL.Path]
		h.hits[r.URL.Path]++
		h.mu.Unlock()
		if !ok {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(h.server.Close)

	return h
}

func (h *host) hitsOf(path string) int {
	h.mu.Lock()
	defer h.mu.Unlock()

	return h.hits[path]
}

func (h *host) serve(path, body string) {
	h.mu.Lock()
	h.files[path] = body
	h.mu.Unlock()
}

// publish serves a version of the plugin: its code and a manifest pinning it.
// edit changes the manifest before it is served.
func (h *host) publish(t *testing.T, version, js string, edit func(m map[string]any)) string {
	t.Helper()

	sum := sha256.Sum256([]byte(js))
	codePath := "/example/" + version + "/plugin.js"
	h.serve(codePath, js)

	m := map[string]any{
		"id":      "example",
		"name":    "Example",
		"version": version,
		"type":    "torrent-provider",
		"author":  "tests",
		"lang":    "en",
		"network": []string{"tracker.example.org"},
		"config": []map[string]any{
			{"name": "mirror", "label": "Mirror", "type": "select", "options": []string{"a.example.org", "b.example.org"}, "default": "a.example.org"},
			{"name": "apiKey", "label": "API key", "type": "text", "secret": true},
			{"name": "adult", "label": "Adult", "type": "switch"},
		},
		"payload": h.server.URL + codePath,
		"sha256":  hex.EncodeToString(sum[:]),
	}
	if edit != nil {
		edit(m)
	}

	raw, err := json.Marshal(m)
	if err != nil {
		t.Fatal(err)
	}
	h.serve("/example/manifest.json", string(raw))

	return h.server.URL + "/example/manifest.json"
}

type harness struct {
	svc     *Service
	store   *store.Store
	secrets *secrets.Store
	dir     string
	host    *host
}

func newHarness(t *testing.T, nodeVersion string) *harness {
	t.Helper()

	ctx := context.Background()
	dir := t.TempDir()

	database, err := db.Open(ctx, filepath.Join(dir, "node.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = database.Close() })

	if err = db.Migrate(ctx, database, zerolog.Nop()); err != nil {
		t.Fatal(err)
	}

	h := newHost(t)
	st := store.New(database)
	sec := secrets.New(filepath.Join(dir, "extension-secrets.json"))

	return &harness{
		svc: New(st, sec, zerolog.Nop(), nil, Options{
			Dir:         filepath.Join(dir, "extensions"),
			NodeVersion: nodeVersion,
			HTTP:        h.server.Client(),
			Now:         func() time.Time { return time.Date(2026, 10, 21, 12, 0, 0, 0, time.UTC) },
		}),
		store:   st,
		secrets: sec,
		dir:     filepath.Join(dir, "extensions"),
		host:    h,
	}
}

func (h *harness) install(t *testing.T, url string) *Extension {
	t.Helper()

	preview, err := h.svc.Preview(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}

	ext, err := h.svc.Install(context.Background(), url, preview.Consent)
	if err != nil {
		t.Fatal(err)
	}

	return ext
}

func kindOf(t *testing.T, err error, want apperr.Kind) {
	t.Helper()

	if err == nil {
		t.Fatalf("no error; want %s", want)
	}
	if got := apperr.KindOf(err); got != want {
		t.Fatalf("%v: %s; want %s", err, got, want)
	}
}

func TestPreviewSavesNothing(t *testing.T) {
	h := newHarness(t, "8d80cc6")
	url := h.host.publish(t, "1.0.0", code, nil)

	preview, err := h.svc.Preview(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}

	if preview.ID != "example" || preview.Version != "1.0.0" || len(preview.Network) != 1 || len(preview.Config) != 3 {
		t.Fatalf("preview %+v", preview)
	}
	if len(preview.Consent) != 64 || !preview.Compatible || preview.Installed != "" {
		t.Fatalf("consent %q, compatible %v, installed %q", preview.Consent, preview.Compatible, preview.Installed)
	}

	if exts, _ := h.svc.List(context.Background()); len(exts) != 0 {
		t.Fatalf("%d plugins after a preview", len(exts))
	}
	if _, err = os.Stat(h.dir); err == nil {
		t.Fatal("a preview wrote to the plugins folder")
	}
}

func TestInstall(t *testing.T) {
	h := newHarness(t, "8d80cc6")
	url := h.host.publish(t, "1.0.0", code, nil)

	ext := h.install(t, url)
	if !ext.Enabled || ext.Version != "1.0.0" || ext.ManifestURL != url {
		t.Fatalf("installed %+v", ext)
	}

	saved, _ := h.store.Get(context.Background(), "example")
	got, err := h.svc.Code(saved)
	if err != nil || got != code {
		t.Fatalf("code %q, %v", got, err)
	}

	preview, _ := h.svc.Preview(context.Background(), url)
	if preview.Installed != "1.0.0" {
		t.Fatalf("a second preview says installed %q", preview.Installed)
	}
	_, err = h.svc.Install(context.Background(), url, preview.Consent)
	kindOf(t, err, apperr.KindConflict)
}

func TestInstallNeedsConsentToThisManifest(t *testing.T) {
	h := newHarness(t, "8d80cc6")
	url := h.host.publish(t, "1.0.0", code, nil)

	preview, err := h.svc.Preview(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}

	// Between the preview and the install, the manifest grows a host.
	h.host.publish(t, "1.0.0", code, func(m map[string]any) {
		m["network"] = []string{"tracker.example.org", "collector.example.org"}
	})

	_, err = h.svc.Install(context.Background(), url, preview.Consent)
	kindOf(t, err, apperr.KindConflict)

	_, err = h.svc.Install(context.Background(), url, strings.Repeat("0", 64))
	kindOf(t, err, apperr.KindConflict)

	if exts, _ := h.svc.List(context.Background()); len(exts) != 0 {
		t.Fatalf("installed without consent: %+v", exts)
	}
}

func TestInstallRefusesBadCode(t *testing.T) {
	cases := map[string]struct {
		edit func(h *host, m map[string]any)
		js   string
		kind apperr.Kind
	}{
		"sum does not match": {
			edit: func(h *host, _ map[string]any) { h.serve("/example/1.0.0/plugin.js", code+" // changed") },
			js:   code, kind: apperr.KindUpstream,
		},
		"does not parse": {js: `class Provider {`, kind: apperr.KindInvalid},
		"code missing": {
			edit: func(h *host, m map[string]any) { m["payload"] = h.server.URL + "/nowhere.js" },
			js:   code, kind: apperr.KindUpstream,
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			h := newHarness(t, "8d80cc6")
			url := h.host.publish(t, "1.0.0", tc.js, func(m map[string]any) {
				if tc.edit != nil {
					tc.edit(h.host, m)
				}
			})

			preview, err := h.svc.Preview(context.Background(), url)
			if err != nil {
				t.Fatal(err)
			}
			_, err = h.svc.Install(context.Background(), url, preview.Consent)
			kindOf(t, err, tc.kind)

			if exts, _ := h.svc.List(context.Background()); len(exts) != 0 {
				t.Fatal("installed anyway")
			}
		})
	}
}

func TestManifestAddresses(t *testing.T) {
	h := newHarness(t, "8d80cc6")

	for _, url := range []string{"http://plugins.example.org/manifest.json", "file:///C:/manifest.json", "https://user:pw@example.org/m.json", "not a url"} {
		_, err := h.svc.Preview(context.Background(), url)
		kindOf(t, err, apperr.KindInvalid)
	}

	_, err := h.svc.Preview(context.Background(), h.host.server.URL+"/missing.json")
	kindOf(t, err, apperr.KindUpstream)
}

func TestNodeVersion(t *testing.T) {
	needs := func(m map[string]any) { m["minNodeVersion"] = "2.0.0" }

	old := newHarness(t, "1.4.0")
	url := old.host.publish(t, "1.0.0", code, needs)
	preview, err := old.svc.Preview(context.Background(), url)
	if err != nil || preview.Compatible {
		t.Fatalf("compatible %v, %v", preview.Compatible, err)
	}
	_, err = old.svc.Install(context.Background(), url, preview.Consent)
	kindOf(t, err, apperr.KindPrecondition)

	for _, version := range []string{"v2.0.0", "2.1.0-3-gabc1234", "8d80cc6", "0.0.0-dev"} {
		h := newHarness(t, version)
		if p, previewErr := h.svc.Preview(context.Background(), h.host.publish(t, "1.0.0", code, needs)); previewErr != nil || !p.Compatible {
			t.Errorf("node %s: compatible %v, %v", version, p != nil && p.Compatible, previewErr)
		}
	}
}

func TestSettings(t *testing.T) {
	h := newHarness(t, "8d80cc6")
	h.install(t, h.host.publish(t, "1.0.0", code, nil))
	ctx := context.Background()

	ext, err := h.svc.Configure(ctx, "example", Settings{Config: map[string]string{"mirror": "b.example.org", "apiKey": "s3cret", "adult": "true"}})
	if err != nil {
		t.Fatal(err)
	}

	byName := map[string]ExtensionSetting{}
	for _, f := range ext.Config {
		byName[f.Name] = f
	}
	if byName["mirror"].Value != "b.example.org" || byName["adult"].Value != "true" {
		t.Fatalf("settings %+v", ext.Config)
	}
	if !byName["apiKey"].Set || byName["apiKey"].Value != "" {
		t.Fatalf("a secret came back: %+v", byName["apiKey"])
	}

	// The secret is in the secrets file, never in the database.
	saved, _ := h.store.Get(ctx, "example")
	if _, inDB := saved.Config["apiKey"]; inDB {
		t.Fatal("the secret is in the database")
	}
	if key, _ := h.secrets.Get(secretKey("example", "apiKey")); key != "s3cret" {
		t.Fatalf("secrets file holds %q", key)
	}

	runtime, err := h.svc.RuntimeConfig(saved)
	if err != nil || runtime["mirror"] != "b.example.org" || runtime["apiKey"] != "s3cret" || runtime["adult"] != "true" {
		t.Fatalf("runtime config %v, %v", runtime, err)
	}

	// Empty goes back to the default, or removes the secret.
	off := false
	if _, err = h.svc.Configure(ctx, "example", Settings{Enabled: &off, Config: map[string]string{"mirror": "", "apiKey": ""}}); err != nil {
		t.Fatal(err)
	}
	saved, _ = h.store.Get(ctx, "example")
	runtime, _ = h.svc.RuntimeConfig(saved)
	if saved.Enabled || runtime["mirror"] != "a.example.org" || runtime["apiKey"] != "" {
		t.Fatalf("enabled %v, runtime %v", saved.Enabled, runtime)
	}

	for name, config := range map[string]map[string]string{
		"not an option": {"mirror": "evil.example.org"},
		"not a switch":  {"adult": "yes"},
		"unknown field": {"proxy": "x"},
		"control char":  {"apiKey": "a\nb"},
		"too long":      {"apiKey": strings.Repeat("k", maxValue+1)},
	} {
		t.Run(name, func(t *testing.T) {
			_, configErr := h.svc.Configure(ctx, "example", Settings{Config: config})
			kindOf(t, configErr, apperr.KindInvalid)
		})
	}

	// A refused change saves nothing, not even its valid half.
	_, err = h.svc.Configure(ctx, "example", Settings{Config: map[string]string{"mirror": "b.example.org", "adult": "yes"}})
	kindOf(t, err, apperr.KindInvalid)
	if saved, _ = h.store.Get(ctx, "example"); saved.Config["mirror"] != "" {
		t.Fatalf("half a change was saved: %v", saved.Config)
	}
}

func TestUpdates(t *testing.T) {
	h := newHarness(t, "8d80cc6")
	ctx := context.Background()
	url := h.host.publish(t, "1.0.0", code, nil)
	h.install(t, url)

	if _, err := h.svc.Configure(ctx, "example", Settings{Config: map[string]string{"mirror": "b.example.org", "apiKey": "s3cret"}}); err != nil {
		t.Fatal(err)
	}

	// Nothing newer: no update.
	exts, err := h.svc.CheckUpdates(ctx)
	if err != nil || exts[0].Update != nil {
		t.Fatalf("update %+v, %v", exts[0].Update, err)
	}

	// Newer, same hosts: no new consent, but the consent still pins it.
	newCode := `class Provider { async search() { return [{ title: 'v2' }] } }`
	h.host.publish(t, "1.1.0", newCode, func(m map[string]any) {
		m["config"] = []map[string]any{
			{"name": "mirror", "label": "Mirror", "type": "select", "options": []string{"a.example.org", "b.example.org"}},
		}
	})
	exts, _ = h.svc.CheckUpdates(ctx)
	update := exts[0].Update
	if update == nil || update.Version != "1.1.0" || update.NeedsConsent || len(update.AddedHosts) != 0 {
		t.Fatalf("update %+v", update)
	}

	_, err = h.svc.Update(ctx, "example", strings.Repeat("0", 64))
	kindOf(t, err, apperr.KindConflict)

	ext, err := h.svc.Update(ctx, "example", update.Consent)
	if err != nil {
		t.Fatal(err)
	}
	if ext.Version != "1.1.0" || ext.Update != nil {
		t.Fatalf("after the update %+v", ext)
	}

	saved, _ := h.store.Get(ctx, "example")
	if got, _ := h.svc.Code(saved); got != newCode {
		t.Fatalf("runs %q", got)
	}
	if saved.Config["mirror"] != "b.example.org" {
		t.Fatalf("the setting that still fits was dropped: %v", saved.Config)
	}
	if key, _ := h.secrets.Get(secretKey("example", "apiKey")); key != "" {
		t.Fatal("the secret of a field the new version dropped was kept")
	}
	if _, statErr := os.Stat(filepath.Join(h.dir, "example", "1.0.0")); statErr == nil {
		t.Fatal("the old version's code stayed")
	}

	// A new host: consent again.
	h.host.publish(t, "1.2.0", newCode, func(m map[string]any) {
		m["network"] = []string{"tracker.example.org", "collector.example.org"}
	})
	exts, _ = h.svc.CheckUpdates(ctx)
	if u := exts[0].Update; u == nil || !u.NeedsConsent || len(u.AddedHosts) != 1 || u.AddedHosts[0] != "collector.example.org" {
		t.Fatalf("update %+v", exts[0].Update)
	}

	// An older version at the address is no update, and cannot be forced.
	h.host.publish(t, "0.9.0", code, nil)
	exts, _ = h.svc.CheckUpdates(ctx)
	if exts[0].Update != nil {
		t.Fatalf("an older version offered: %+v", exts[0].Update)
	}
	preview, _ := h.svc.Preview(ctx, url)
	_, err = h.svc.Update(ctx, "example", preview.Consent)
	kindOf(t, err, apperr.KindConflict)

	// The address now holds another plugin.
	h.host.publish(t, "9.0.0", code, func(m map[string]any) { m["id"] = "other" })
	exts, _ = h.svc.CheckUpdates(ctx)
	if u := exts[0].Update; u == nil || !strings.Contains(u.Error, "another plugin") {
		t.Fatalf("update %+v", exts[0].Update)
	}
}

func TestRemove(t *testing.T) {
	h := newHarness(t, "8d80cc6")
	ctx := context.Background()
	h.install(t, h.host.publish(t, "1.0.0", code, nil))

	if _, err := h.svc.Configure(ctx, "example", Settings{Config: map[string]string{"apiKey": "s3cret"}}); err != nil {
		t.Fatal(err)
	}

	if err := h.svc.Remove(ctx, "example"); err != nil {
		t.Fatal(err)
	}

	if exts, _ := h.svc.List(ctx); len(exts) != 0 {
		t.Fatal("still listed")
	}
	if _, err := os.Stat(filepath.Join(h.dir, "example")); err == nil {
		t.Fatal("the code stayed")
	}
	if key, _ := h.secrets.Get(secretKey("example", "apiKey")); key != "" {
		t.Fatal("the secret stayed")
	}

	kindOf(t, h.svc.Remove(ctx, "example"), apperr.KindNotFound)
}

func TestCodeChangedOnDiskIsNotRun(t *testing.T) {
	h := newHarness(t, "8d80cc6")
	h.install(t, h.host.publish(t, "1.0.0", code, nil))

	path := filepath.Join(h.dir, "example", "1.0.0", "plugin.js")
	if err := os.WriteFile(path, []byte(code+"; fetch('http://evil')"), 0o600); err != nil {
		t.Fatal(err)
	}

	saved, _ := h.store.Get(context.Background(), "example")
	if _, err := h.svc.Code(saved); err == nil || !strings.Contains(err.Error(), "does not match") {
		t.Fatalf("%v; want it refused", err)
	}
}

// The node's real client refuses a manifest on a local address as the user's
// mistake, before any request.
func TestLocalManifestAddressIsInvalid(t *testing.T) {
	h := newHarness(t, "8d80cc6")
	h.svc.opts.HTTP = sandbox.PublicClient(5 * time.Second)

	_, err := h.svc.Preview(context.Background(), h.host.publish(t, "1.0.0", code, nil))
	kindOf(t, err, apperr.KindInvalid)
	if !strings.Contains(err.Error(), "127.0.0.1 is a local or private address") {
		t.Fatalf("%v", err)
	}
}
