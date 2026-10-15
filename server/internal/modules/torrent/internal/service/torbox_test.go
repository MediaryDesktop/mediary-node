package service

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

func withTorBox(h *harness) *[]string {
	var checked []string

	h.svc.opts.Debrid = map[string]DebridService{
		ClientTorBox: {
			Client: h.client,
			Check: func(_ context.Context, key string) (string, error) {
				checked = append(checked, key)
				return "TorBox · Free plan", nil
			},
		},
		ClientRealDebrid: {Client: h.client, Check: func(context.Context, string) (string, error) { return "Real-Debrid", nil }},
	}

	return &checked
}

func TestEachDebridServiceKeepsItsOwnKey(t *testing.T) {
	h := newHarness(t)
	withTorBox(h)
	ctx := context.Background()

	torboxKey, rdKey := "tb-key", "rd-key"
	if _, err := h.svc.UpdateSettings(ctx, TorrentSettingsUpdate{Client: ClientTorBox, APIKey: &torboxKey, RootID: 1}); err != nil {
		t.Fatal(err)
	}
	settings, err := h.svc.UpdateSettings(ctx, TorrentSettingsUpdate{Client: ClientRealDebrid, APIKey: &rdKey, RootID: 1})
	if err != nil {
		t.Fatal(err)
	}

	if settings.Client != ClientRealDebrid || !settings.HasAPIKey || len(settings.DebridKeys) != 2 {
		t.Errorf("settings = %+v", settings)
	}

	for kind, want := range map[string]string{ClientTorBox: "tb-key", ClientRealDebrid: "rd-key"} {
		if got, _ := h.svc.secrets.Get(kind); got != want {
			t.Errorf("%s key = %q, want %q", kind, got, want)
		}
	}

	// Going back to TorBox needs no key typed again.
	if _, err := h.svc.UpdateSettings(ctx, TorrentSettingsUpdate{Client: ClientTorBox, RootID: 1}); err != nil {
		t.Errorf("back to TorBox: %v", err)
	}

	// A service this node was not built with cannot be chosen.
	allKey := "x"
	if _, err := h.svc.UpdateSettings(ctx, TorrentSettingsUpdate{Client: ClientAllDebrid, APIKey: &allKey, RootID: 1}); apperr.KindOf(err) != apperr.KindInvalid {
		t.Errorf("unavailable service: err = %v", err)
	}
}

func TestTorBoxNeedsAKey(t *testing.T) {
	h := newHarness(t)
	withTorBox(h)

	_, err := h.svc.UpdateSettings(context.Background(), TorrentSettingsUpdate{Client: ClientTorBox, RootID: 1})
	if apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("err = %v, want the key to be required", err)
	}
}

func TestTorBoxKeyIsSavedAsASecretAndUsedForDownloads(t *testing.T) {
	h := newHarness(t)
	checked := withTorBox(h)
	ctx := context.Background()

	key := "  the-key  "
	settings, err := h.svc.UpdateSettings(ctx, TorrentSettingsUpdate{
		Client:  ClientTorBox,
		APIKey:  &key,
		RootID:  1,
		PathMap: TorrentPathMap{Client: "/downloads", Node: h.root},
	})
	if err != nil {
		t.Fatal(err)
	}
	if settings.Client != ClientTorBox || !settings.HasAPIKey {
		t.Errorf("settings = %+v", settings)
	}

	saved, _ := h.svc.secrets.Get(ClientTorBox)
	if saved != "the-key" {
		t.Errorf("saved key = %q", saved)
	}

	// Saving again without a key keeps the saved one.
	if _, saveErr := h.svc.UpdateSettings(ctx, TorrentSettingsUpdate{Client: ClientTorBox, RootID: 1}); saveErr != nil {
		t.Fatalf("save without retyping the key: %v", saveErr)
	}

	result, err := h.svc.Check(ctx, Connection{Kind: ClientTorBox}, true)
	if err != nil {
		t.Fatal(err)
	}
	if result.Version != "TorBox · Free plan" || len(*checked) != 1 || (*checked)[0] != "the-key" {
		t.Errorf("check = %+v with keys %v", result, *checked)
	}

	h.add(t)

	if len(h.client.added) != 1 {
		t.Fatalf("added = %+v", h.client.added)
	}
	// The node fetches TorBox's files itself, so a path mapping meant for a
	// qBittorrent in Docker does not apply.
	if want := filepath.Join(h.root, "Sousou no Frieren"); h.client.added[0].SavePath != want {
		t.Errorf("save path = %q, want %q", h.client.added[0].SavePath, want)
	}
	if len(h.conns) != 0 {
		t.Errorf("a qBittorrent client was built: %+v", h.conns)
	}

	_, status, err := h.svc.List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !status.Configured || status.Kind != ClientTorBox {
		t.Errorf("status = %+v", status)
	}
}

func TestTorBoxCheckTriesAKeyBeforeItIsSaved(t *testing.T) {
	h := newHarness(t)
	checked := withTorBox(h)

	if _, err := h.svc.Check(context.Background(), Connection{Kind: ClientTorBox, APIKey: "new-key"}, false); err != nil {
		t.Fatal(err)
	}
	if len(*checked) != 1 || (*checked)[0] != "new-key" {
		t.Errorf("checked %v", *checked)
	}

	if _, err := h.svc.Check(context.Background(), Connection{Kind: ClientTorBox}, true); apperr.KindOf(err) != apperr.KindInvalid {
		t.Errorf("err = %v, want an empty saved key to be refused", err)
	}
}
