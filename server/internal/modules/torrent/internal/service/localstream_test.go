package service

import (
	"context"
	"io"
	"strings"
	"sync"
	"testing"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/debrid"
)

// localClient is the node's own client as the streams see it: it knows the
// files once it has the metadata, and buffers the one it is told.
type localClient struct {
	*fakeClient

	mu       sync.Mutex
	remote   debrid.Remote
	buffered float64
	asked    int
	streams  []string
}

func (c *localClient) Service() string { return "Built-in client" }

func (c *localClient) Stream(_ context.Context, magnet string, _ []byte) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.streams = append(c.streams, magnet)

	return frierenHash, nil
}

func (c *localClient) StreamState(context.Context, string) (debrid.Remote, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.remote, nil
}

func (c *localClient) Buffer(_ context.Context, _ string, fileID int) (ready bool, progress float64, err error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.asked = fileID

	return c.buffered >= 1, c.buffered, nil
}

func (c *localClient) OpenStream(context.Context, string, int) (io.ReadSeekCloser, error) {
	return nopSeekCloser{strings.NewReader("video")}, nil
}

type nopSeekCloser struct{ io.ReadSeeker }

func (nopSeekCloser) Close() error { return nil }

func withLocalStreaming(t *testing.T, h *harness) *localClient {
	t.Helper()

	client := &localClient{fakeClient: h.client}
	h.svc.opts.Embedded = client
	h.configure(t)

	return client
}

func TestWithoutDebridAStreamComesFromTheBuiltInClient(t *testing.T) {
	h := newHarness(t)
	client := withLocalStreaming(t, h)
	ctx := context.Background()

	client.remote = debrid.Remote{Hash: frierenHash, Ready: true, Peers: 7, Speed: 2000, Files: batchFiles()}
	client.buffered = 0.5

	episode := 2
	started, err := h.svc.StartStream(ctx, StreamRequest{MediaRef: "anilist:154587", Magnet: frierenMagnet, Episode: &episode})
	if err != nil {
		t.Fatal(err)
	}
	if started.Via != StreamViaEmbedded || started.State != "preparing" || started.Progress != 0.5 || started.Peers != 7 {
		t.Fatalf("started = %+v, want the built-in client buffering", started)
	}
	if client.asked != 1 {
		t.Errorf("buffered file %d, want episode 2's", client.asked)
	}

	client.buffered = 1
	ready, err := h.svc.StreamStatus(ctx, started.ID)
	if err != nil {
		t.Fatal(err)
	}
	if ready.State != "ready" || ready.FileID != -started.ID {
		t.Fatalf("ready = %+v", ready)
	}

	file, err := h.svc.StreamFile(ctx, ready.FileID)
	if err != nil {
		t.Fatal(err)
	}
	if file.URL != "" || file.Open == nil {
		t.Fatalf("file = %+v, want one read from the client, not a link", file)
	}

	reader, err := file.Open(ctx)
	if err != nil {
		t.Fatal(err)
	}
	data, _ := io.ReadAll(reader)
	_ = reader.Close()
	if string(data) != "video" {
		t.Errorf("read %q", data)
	}
}

func TestAStreamAskedThroughTheBuiltInClientIgnoresDebrid(t *testing.T) {
	h := newHarness(t)
	local := withLocalStreaming(t, h)
	service := &streamingClient{fakeClient: h.client}
	h.svc.opts.Debrid = map[string]DebridService{DebridTorBox: {Client: service}}
	setUpDebrid(t, h, DebridTorBox, "key")

	local.remote = debrid.Remote{Hash: frierenHash}

	got, err := h.svc.StartStream(context.Background(), StreamRequest{MediaRef: "anilist:154587", Magnet: frierenMagnet, Via: StreamViaEmbedded})
	if err != nil {
		t.Fatal(err)
	}
	if got.Via != StreamViaEmbedded || len(local.streams) != 1 || len(service.streams) != 0 {
		t.Fatalf("stream = %+v; built-in %d, debrid %d", got, len(local.streams), len(service.streams))
	}
}

func TestTheBuiltInClientTakesABetterSeededBatch(t *testing.T) {
	held := true
	releases := []TorrentRelease{
		{ID: "episode", Title: "episode", Match: "episode", Seeders: 12, Eligible: true, Score: 200},
		{ID: "batch", Title: "batch", Match: "batch", Seeders: 400, Eligible: true, Score: 200, Cached: &held},
	}

	if best := bestStreamRelease(releases, true, true, &TorrentProfile{}); best == nil || best.ID != "batch" {
		t.Fatalf("best = %+v, want the batch: only the episode's file is fetched", best)
	}
}
