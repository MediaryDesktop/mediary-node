package service

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/extension/internal/sandbox"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// A plugin that needs no network: it answers with what its settings say.
const echo = `class Provider {
	async search(request) {
		return [{ title: request.query + ' via ' + config.mirror, infoHash: '0123456789abcdef0123456789abcdef01234567' }]
	}
}`

func TestSearchTorrentsRunsTheInstalledPlugin(t *testing.T) {
	h := newHarness(t, "8d80cc6")
	h.svc.opts.Runner = sandbox.New(sandbox.Options{Logger: zerolog.Nop()})
	ctx := context.Background()

	h.install(t, h.host.publish(t, "1.0.0", echo, nil))

	providers, err := h.svc.TorrentProviders(ctx)
	if err != nil || len(providers) != 1 || providers[0].ID != "example" || providers[0].Revision == "" {
		t.Fatalf("providers %+v, %v", providers, err)
	}
	before := providers[0].Revision

	releases, err := h.svc.SearchTorrents(ctx, "example", sandbox.SearchRequest{Query: "frieren"})
	if err != nil || len(releases) != 1 || releases[0].Title != "frieren via a.example.org" {
		t.Fatalf("releases %+v, %v; want the default mirror", releases, err)
	}

	if providers, _ = h.svc.TorrentProviders(ctx); providers[0].Revision != before {
		t.Fatalf("the revision moved with nothing changed: %s, then %s", before, providers[0].Revision)
	}

	if _, err = h.svc.Configure(ctx, "example", Settings{Config: map[string]string{"mirror": "b.example.org"}}); err != nil {
		t.Fatal(err)
	}
	releases, _ = h.svc.SearchTorrents(ctx, "example", sandbox.SearchRequest{Query: "frieren"})
	if releases[0].Title != "frieren via b.example.org" {
		t.Fatalf("after changing the mirror: %q", releases[0].Title)
	}

	// The search keeps a plugin's answers by its revision: another setting is
	// another answer.
	if providers, _ = h.svc.TorrentProviders(ctx); providers[0].Revision == before {
		t.Fatal("the revision stayed when a setting changed")
	}

	// Off: not offered, and not run if asked anyway.
	off := false
	if _, err = h.svc.Configure(ctx, "example", Settings{Enabled: &off}); err != nil {
		t.Fatal(err)
	}
	if providers, _ = h.svc.TorrentProviders(ctx); len(providers) != 0 {
		t.Fatalf("a plugin turned off is offered: %+v", providers)
	}
	_, err = h.svc.SearchTorrents(ctx, "example", sandbox.SearchRequest{Query: "frieren"})
	kindOf(t, err, apperr.KindPrecondition)

	_, err = h.svc.SearchTorrents(ctx, "missing", sandbox.SearchRequest{Query: "frieren"})
	kindOf(t, err, apperr.KindNotFound)
}

func TestChangedCodeIsNotSearchedWith(t *testing.T) {
	h := newHarness(t, "8d80cc6")
	h.svc.opts.Runner = sandbox.New(sandbox.Options{Logger: zerolog.Nop()})
	h.install(t, h.host.publish(t, "1.0.0", echo, nil))

	path := filepath.Join(h.dir, "example", "1.0.0", "plugin.js")
	if err := os.WriteFile(path, []byte(`class Provider { async search() { return [] } }`), 0o600); err != nil {
		t.Fatal(err)
	}

	_, err := h.svc.SearchTorrents(context.Background(), "example", sandbox.SearchRequest{Query: "q"})
	if err == nil {
		t.Fatal("ran code that does not match the manifest")
	}
}

// Two calls at once per plugin; a third waits, and gives up with its caller.
func TestAPluginRunsTwoAtOnce(t *testing.T) {
	h := newHarness(t, "8d80cc6")
	h.svc.opts.Runner = sandbox.New(sandbox.Options{Logger: zerolog.Nop()})
	h.install(t, h.host.publish(t, "1.0.0", echo, nil))

	for range perPlugin {
		release, err := h.svc.slot(context.Background(), "example")
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(release)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	_, err := h.svc.SearchTorrents(ctx, "example", sandbox.SearchRequest{Query: "q"})
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("%v; want it to wait for a place and give up", err)
	}

	// Another plugin's places are its own.
	if release, slotErr := h.svc.slot(context.Background(), "other"); slotErr != nil {
		t.Fatal(slotErr)
	} else {
		release()
	}
}
