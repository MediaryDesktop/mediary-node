package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/modules/extension/internal/sandbox"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// listing serves a repository at path listing entries, and returns its address.
func (h *host) listing(t *testing.T, path, name string, entries ...map[string]any) string {
	t.Helper()

	if entries == nil {
		entries = []map[string]any{}
	}

	raw, err := json.Marshal(map[string]any{"name": name, "plugins": entries})
	if err != nil {
		t.Fatal(err)
	}
	h.serve(path, string(raw))

	return h.server.URL + path
}

func listed(manifestURL, id, version string) map[string]any {
	return map[string]any{
		"manifest": manifestURL,
		"id":       id,
		"name":     strings.ToUpper(id[:1]) + id[1:],
		"version":  version,
		"type":     "torrent-provider",
		"author":   "tests",
		"lang":     "en",
	}
}

func TestRepositoriesFeedTheCatalog(t *testing.T) {
	h := newHarness(t, "8d80cc6")
	ctx := context.Background()

	// Empty until the user adds a repository: the node starts with none.
	catalog, err := h.svc.Catalog(ctx, false)
	if err != nil || len(catalog.Plugins) != 0 || len(catalog.Repositories) != 0 {
		t.Fatalf("a fresh node's catalog: %+v, %v", catalog, err)
	}

	manifestURL := h.host.publish(t, "1.0.0", code, nil)
	first := h.host.listing(t, "/one.json", "First", listed(manifestURL, "example", "1.0.0"), listed("https://elsewhere.example.org/other/manifest.json", "other", "2.0.0"))
	second := h.host.listing(t, "/two.json", "Second",
		listed(manifestURL, "example", "1.0.0"), // the same address: shown once
		map[string]any{"manifest": "http://insecure.example.org/m.json", "id": "insecure", "name": "x", "version": "1.0.0", "type": "torrent-provider", "author": "x"},
	)

	repo, err := h.svc.AddRepository(ctx, first)
	if err != nil || repo.Name != "First" || repo.Plugins != 2 {
		t.Fatalf("added %+v, %v", repo, err)
	}
	repo, err = h.svc.AddRepository(ctx, second)
	if err != nil || repo.Plugins != 1 || repo.Skipped != 1 {
		t.Fatalf("added %+v, %v", repo, err)
	}

	catalog, err = h.svc.Catalog(ctx, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(catalog.Plugins) != 2 || len(catalog.Repositories) != 2 {
		t.Fatalf("catalog of %d plugins from %d repositories", len(catalog.Plugins), len(catalog.Repositories))
	}
	if p := catalog.Plugins[0]; p.ID != "example" || p.RepositoryName != "First" || p.ManifestURL != manifestURL || p.Installed != "" {
		t.Fatalf("first entry %+v", p)
	}

	// Installed from here, then listed newer: the catalog says so.
	h.install(t, manifestURL)
	h.host.listing(t, "/one.json", "First", listed(manifestURL, "example", "1.1.0"))

	catalog, _ = h.svc.Catalog(ctx, true)
	p := catalog.Plugins[0]
	if p.Installed != "1.0.0" || !p.InstalledHere || !p.Update {
		t.Fatalf("after installing %+v", p)
	}

	// Removing a repository leaves what was installed from it.
	if err = h.svc.RemoveRepository(ctx, catalog.Repositories[0].ID); err != nil {
		t.Fatal(err)
	}
	if exts, _ := h.svc.List(ctx); len(exts) != 1 {
		t.Fatal("removing a repository removed a plugin")
	}
	kindOf(t, h.svc.RemoveRepository(ctx, catalog.Repositories[0].ID), apperr.KindNotFound)
}

func TestAddRepositoryRefusesWhatIsNotOne(t *testing.T) {
	h := newHarness(t, "8d80cc6")
	ctx := context.Background()

	h.host.serve("/page.html", "<html></html>")
	h.host.serve("/manifest.json", `{"id": "a plugin, not a list"}`)

	for name, tc := range map[string]struct {
		url  string
		kind apperr.Kind
	}{
		"http":           {"http://plugins.example.org/repo.json", apperr.KindInvalid},
		"not an address": {"repo.json", apperr.KindInvalid},
		"a web page":     {h.host.server.URL + "/page.html", apperr.KindInvalid},
		"a manifest":     {h.host.server.URL + "/manifest.json", apperr.KindInvalid},
		"missing":        {h.host.server.URL + "/nowhere.json", apperr.KindInvalid},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := h.svc.AddRepository(ctx, tc.url)
			kindOf(t, err, tc.kind)
		})
	}

	catalog, _ := h.svc.Catalog(ctx, false)
	if len(catalog.Repositories) != 0 {
		t.Fatalf("saved %d repositories that are not", len(catalog.Repositories))
	}

	good := h.host.listing(t, "/repo.json", "Repo")
	if _, err := h.svc.AddRepository(ctx, good); err != nil {
		t.Fatal(err)
	}
	_, err := h.svc.AddRepository(ctx, good)
	kindOf(t, err, apperr.KindConflict)
}

func TestRepositoryLimit(t *testing.T) {
	h := newHarness(t, "8d80cc6")
	ctx := context.Background()

	for i := range maxRepositories {
		if _, err := h.svc.AddRepository(ctx, h.host.listing(t, fmt.Sprintf("/r%d.json", i), "R")); err != nil {
			t.Fatal(err)
		}
	}

	_, err := h.svc.AddRepository(ctx, h.host.listing(t, "/one-more.json", "R"))
	kindOf(t, err, apperr.KindPrecondition)
}

// A repository that fails keeps its last good read, with the error beside
// it; reads are reused for an hour unless a refresh asks.
func TestCatalogKeepsTheLastGoodRead(t *testing.T) {
	h := newHarness(t, "8d80cc6")
	ctx := context.Background()

	now := time.Date(2026, 10, 21, 12, 0, 0, 0, time.UTC)
	h.svc.opts.Now = func() time.Time { return now }

	url := h.host.listing(t, "/repo.json", "Repo", listed("https://p.example.org/a/manifest.json", "alpha", "1.0.0"))
	if _, err := h.svc.AddRepository(ctx, url); err != nil {
		t.Fatal(err)
	}

	// Within the hour the read is reused: a changed list is not seen yet.
	h.host.listing(t, "/repo.json", "Repo", listed("https://p.example.org/b/manifest.json", "beta", "1.0.0"))
	now = now.Add(30 * time.Minute)
	if catalog, _ := h.svc.Catalog(ctx, false); catalog.Plugins[0].ID != "alpha" {
		t.Fatalf("read again within the hour: %+v", catalog.Plugins)
	}

	// Past the hour it is read again; then it breaks, and the last good read
	// stays.
	now = now.Add(time.Hour)
	if catalog, _ := h.svc.Catalog(ctx, false); catalog.Plugins[0].ID != "beta" {
		t.Fatalf("not read again after the hour: %+v", catalog.Plugins)
	}

	h.host.serve("/repo.json", "{ broken")
	catalog, err := h.svc.Catalog(ctx, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(catalog.Plugins) != 1 || catalog.Plugins[0].ID != "beta" || catalog.Repositories[0].Error == "" {
		t.Fatalf("after a failed read: %+v, %+v", catalog.Plugins, catalog.Repositories)
	}
}

// Repositories are read under the plugins' rule, like manifests.
func TestRepositoryOnALocalAddressIsRefused(t *testing.T) {
	h := newHarness(t, "8d80cc6")
	h.svc.opts.HTTP = sandbox.PublicClient(5 * time.Second)

	_, err := h.svc.AddRepository(context.Background(), h.host.listing(t, "/repo.json", "Repo"))
	kindOf(t, err, apperr.KindInvalid)
	if !strings.Contains(err.Error(), "local or private") {
		t.Fatalf("%v", err)
	}
}

// Views opened at once share one read of each repository.
func TestConcurrentViewsReadOnce(t *testing.T) {
	h := newHarness(t, "8d80cc6")
	ctx := context.Background()

	url := h.host.listing(t, "/repo.json", "Repo", listed("https://p.example.org/a/manifest.json", "alpha", "1.0.0"))
	if _, err := h.svc.AddRepository(ctx, url); err != nil {
		t.Fatal(err)
	}
	before := h.host.hitsOf("/repo.json")

	var wg sync.WaitGroup
	for range 5 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if catalog, err := h.svc.Catalog(ctx, false); err != nil || len(catalog.Plugins) != 1 {
				t.Errorf("%+v, %v", catalog, err)
			}
		}()
	}
	wg.Wait()

	if hits := h.host.hitsOf("/repo.json") - before; hits != 0 {
		t.Fatalf("a fresh read was repeated %d times", hits)
	}

	for range 3 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _ = h.svc.Catalog(ctx, true)
		}()
	}
	wg.Wait()

	if hits := h.host.hitsOf("/repo.json") - before; hits != 3 {
		t.Fatalf("three refreshes read %d times", hits)
	}
}
