package service

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// withDebrid makes TorBox and Real-Debrid available on the node, both backed by
// the harness's client, and records the keys their checks were given.
func withDebrid(h *harness) *[]string {
	var checked []string

	h.svc.opts.Debrid = map[string]DebridService{
		DebridTorBox: {
			Client: h.client,
			Check: func(_ context.Context, key string) (string, error) {
				checked = append(checked, key)
				return "TorBox · Free plan", nil
			},
		},
		DebridRealDebrid: {Client: h.client, Check: func(context.Context, string) (string, error) { return "Real-Debrid", nil }},
	}

	return &checked
}

func setUpDebrid(t *testing.T, h *harness, kind, key string) {
	t.Helper()

	if _, err := h.svc.UpdateDebrid(context.Background(), DebridUpdate{Service: kind, APIKey: &key}); err != nil {
		t.Fatalf("set up %s: %v", kind, err)
	}
}

func TestDebridNeedsAKey(t *testing.T) {
	h := newHarness(t)
	withDebrid(h)

	_, err := h.svc.UpdateDebrid(context.Background(), DebridUpdate{Service: DebridTorBox})
	if apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("err = %v, want the key to be required", err)
	}
}

func TestDebridIsSetUpApartFromTheClient(t *testing.T) {
	h := newHarness(t)
	withDebrid(h)
	h.configure(t)
	ctx := context.Background()

	key := "  the-key  "
	debrid, err := h.svc.UpdateDebrid(ctx, DebridUpdate{Service: DebridTorBox, APIKey: &key})
	if err != nil {
		t.Fatal(err)
	}
	if debrid.Service != DebridTorBox || !debrid.HasAPIKey || !debrid.Ready || debrid.InUse {
		t.Errorf("debrid = %+v", debrid)
	}

	if saved, _ := h.svc.secrets.Get(DebridTorBox); saved != "the-key" {
		t.Errorf("saved key = %q", saved)
	}

	// The client stays qBittorrent: the debrid service does not take its place.
	settings, err := h.svc.Settings(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if settings.Client != ClientQBittorrent {
		t.Errorf("client = %q, want qBittorrent kept", settings.Client)
	}
}

func TestEachDebridServiceKeepsItsOwnKey(t *testing.T) {
	h := newHarness(t)
	withDebrid(h)
	ctx := context.Background()

	setUpDebrid(t, h, DebridTorBox, "tb-key")
	setUpDebrid(t, h, DebridRealDebrid, "rd-key")

	debrid, err := h.svc.Debrid(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if debrid.Service != DebridRealDebrid || len(debrid.Keys) != 2 {
		t.Errorf("debrid = %+v", debrid)
	}

	// Going back to TorBox needs no key typed again.
	if _, err := h.svc.UpdateDebrid(ctx, DebridUpdate{Service: DebridTorBox}); err != nil {
		t.Errorf("back to TorBox: %v", err)
	}

	allKey := "x"
	if _, err := h.svc.UpdateDebrid(ctx, DebridUpdate{Service: DebridAllDebrid, APIKey: &allKey}); apperr.KindOf(err) != apperr.KindInvalid {
		t.Errorf("a service this node lacks: err = %v", err)
	}
}

func TestDownloadingThroughDebridNeedsItSetUp(t *testing.T) {
	h := newHarness(t)
	withDebrid(h)

	_, err := h.svc.UpdateSettings(context.Background(), TorrentSettingsUpdate{Client: ClientDebrid, RootID: 1})
	if apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("err = %v, want the debrid service to be required", err)
	}
}

func TestDownloadsGoThroughTheDebridService(t *testing.T) {
	h := newHarness(t)
	withDebrid(h)
	setUpDebrid(t, h, DebridTorBox, "key")
	ctx := context.Background()

	if _, err := h.svc.UpdateSettings(ctx, TorrentSettingsUpdate{
		Client:  ClientDebrid,
		RootID:  1,
		PathMap: TorrentPathMap{Client: "/downloads", Node: h.root},
	}); err != nil {
		t.Fatal(err)
	}

	h.add(t)

	if len(h.client.added) != 1 {
		t.Fatalf("added = %+v", h.client.added)
	}
	// The node fetches the service's files itself, so a mapping meant for a
	// qBittorrent in Docker does not apply.
	if want := filepath.Join(h.root, "Sousou no Frieren"); h.client.added[0].SavePath != want {
		t.Errorf("save path = %q, want %q", h.client.added[0].SavePath, want)
	}

	_, status, err := h.svc.List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !status.Configured || status.Kind != ClientDebrid || status.Service != "TorBox" {
		t.Errorf("status = %+v", status)
	}

	// Turning the service off would leave the client without its way to download.
	if _, offErr := h.svc.UpdateDebrid(ctx, DebridUpdate{Service: DebridNone}); apperr.KindOf(offErr) != apperr.KindConflict {
		t.Errorf("turn off in use: err = %v, want conflict", offErr)
	}
	debrid, err := h.svc.Debrid(ctx)
	if err != nil || !debrid.InUse {
		t.Errorf("debrid = %+v, %v; want in use", debrid, err)
	}
}

func TestDebridCanBeTurnedOffWhenNotInUse(t *testing.T) {
	h := newHarness(t)
	withDebrid(h)
	h.configure(t)
	setUpDebrid(t, h, DebridTorBox, "key")

	debrid, err := h.svc.UpdateDebrid(context.Background(), DebridUpdate{Service: DebridNone})
	if err != nil {
		t.Fatal(err)
	}
	if debrid.Service != DebridNone || debrid.Ready || len(debrid.Keys) != 1 {
		t.Errorf("debrid = %+v, want off with the key kept", debrid)
	}
}

func TestDebridCheckTriesAKeyBeforeItIsSaved(t *testing.T) {
	h := newHarness(t)
	checked := withDebrid(h)
	ctx := context.Background()

	key := "new-key"
	result, err := h.svc.CheckDebrid(ctx, DebridTorBox, &key)
	if err != nil {
		t.Fatal(err)
	}
	if result.Version != "TorBox · Free plan" || len(*checked) != 1 || (*checked)[0] != "new-key" {
		t.Errorf("check = %+v with keys %v", result, *checked)
	}

	if _, err := h.svc.CheckDebrid(ctx, DebridTorBox, nil); apperr.KindOf(err) != apperr.KindInvalid {
		t.Errorf("no saved key: err = %v", err)
	}

	setUpDebrid(t, h, DebridTorBox, "saved-key")
	if _, err := h.svc.Check(ctx, Connection{Kind: ClientDebrid}, true); err != nil {
		t.Fatal(err)
	}
	if last := (*checked)[len(*checked)-1]; last != "saved-key" {
		t.Errorf("the debrid client was checked with %q, want the saved key", last)
	}
}

// Settings saved before the debrid service had its own named it as the client.
func TestAClientThatNamedADebridServiceStillWorks(t *testing.T) {
	h := newHarness(t)
	withDebrid(h)
	ctx := context.Background()

	if err := h.svc.secrets.Set(DebridTorBox, "key"); err != nil {
		t.Fatal(err)
	}
	if err := h.svc.store.SetMeta(ctx, keyKind, DebridTorBox); err != nil {
		t.Fatal(err)
	}

	settings, err := h.svc.Settings(ctx)
	if err != nil {
		t.Fatal(err)
	}
	debrid, err := h.svc.Debrid(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if settings.Client != ClientDebrid || debrid.Service != DebridTorBox || !debrid.Ready {
		t.Errorf("settings = %+v, debrid = %+v", settings, debrid)
	}
}
