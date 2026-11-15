package service

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/debrid"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

// streamingClient is a debrid client that can play a torrent it holds.
type streamingClient struct {
	*fakeClient

	mu      sync.Mutex
	remote  debrid.Remote
	streams []string
	links   int
}

func (c *streamingClient) Service() string { return "Fake" }

// Stream records the magnet it was given, so a test sees which release played.
func (c *streamingClient) Stream(_ context.Context, magnet string, _ []byte) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.streams = append(c.streams, magnet)

	return frierenHash, nil
}

func (c *streamingClient) StreamState(context.Context, string) (debrid.Remote, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.remote, nil
}

func (c *streamingClient) StreamLink(_ context.Context, _ string, fileID int) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.links++

	return "https://cdn.example/" + string(rune('a'+fileID)), nil
}

func (c *streamingClient) set(remote debrid.Remote) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.remote = remote
}

func withStreaming(t *testing.T, h *harness) *streamingClient {
	t.Helper()

	client := &streamingClient{fakeClient: h.client}
	h.svc.opts.Debrid = map[string]DebridService{DebridTorBox: {Client: client}}

	// The library downloads through qBittorrent; streams come from the debrid
	// service all the same.
	h.configure(t)
	setUpDebrid(t, h, DebridTorBox, "key")

	return client
}

func batchFiles() []debrid.RemoteFile {
	return []debrid.RemoteFile{
		{ID: 0, Path: "Frieren/Sousou no Frieren - 01.mkv", Size: 300},
		{ID: 1, Path: "Frieren/Sousou no Frieren - 02.mkv", Size: 310},
		{ID: 2, Path: "Frieren/Sousou no Frieren - 02.ass", Size: 1},
	}
}

func TestStreamThroughDebridNeedsAService(t *testing.T) {
	h := newHarness(t)
	h.configure(t)

	_, err := h.svc.StartStream(context.Background(), StreamRequest{MediaRef: "anilist:154587", Magnet: frierenMagnet, Via: StreamViaDebrid})
	if apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("err = %v, want precondition", err)
	}
}

func TestStreamIsReadiedThenPlaysTheEpisodesFile(t *testing.T) {
	h := newHarness(t)
	client := withStreaming(t, h)
	ctx := context.Background()

	client.set(debrid.Remote{Hash: frierenHash, Progress: 0.4, Speed: 1000})

	episode := 2
	started, err := h.svc.StartStream(ctx, StreamRequest{MediaRef: "anilist:154587", Magnet: frierenMagnet, Episode: &episode})
	if err != nil {
		t.Fatal(err)
	}
	if started.State != "preparing" || started.Progress != 0.4 || started.FileID != 0 || started.Service != "Fake" {
		t.Fatalf("started = %+v", started)
	}
	if len(h.client.added) != 0 {
		t.Error("a stream was added to the downloads")
	}

	if _, fileErr := h.svc.StreamFile(ctx, -started.ID); apperr.KindOf(fileErr) != apperr.KindPrecondition {
		t.Errorf("file before ready: err = %v", fileErr)
	}

	client.set(debrid.Remote{Hash: frierenHash, Ready: true, Progress: 1, Files: batchFiles()})

	ready, err := h.svc.StreamStatus(ctx, started.ID)
	if err != nil {
		t.Fatal(err)
	}
	if ready.State != "ready" || ready.FileID != -started.ID || ready.Name != "Sousou no Frieren - 02.mkv" {
		t.Fatalf("ready = %+v", ready)
	}

	file, err := h.svc.StreamFile(ctx, ready.FileID)
	if err != nil {
		t.Fatal(err)
	}
	if file.URL != "https://cdn.example/b" || file.MediaRef != "anilist:154587" || *file.Episode != 2 || file.Key != "stream-"+frierenHash+"-1" {
		t.Errorf("file = %+v", file)
	}

	// The player asks for every range; the link is reused, not asked again.
	for range 3 {
		if _, fileErr := h.svc.StreamFile(ctx, ready.FileID); fileErr != nil {
			t.Fatal(fileErr)
		}
	}
	if client.links != 1 {
		t.Errorf("link asked %d times, want once", client.links)
	}

	// A link the CDN refused is asked for again.
	h.svc.RenewStreamLink(ready.FileID)
	if _, fileErr := h.svc.StreamFile(ctx, ready.FileID); fileErr != nil {
		t.Fatal(fileErr)
	}
	if client.links != 2 {
		t.Errorf("link asked %d times after renewal, want twice", client.links)
	}

	// Asking again for the same episode gives the same stream.
	again, err := h.svc.StartStream(ctx, StreamRequest{MediaRef: "anilist:154587", Magnet: frierenMagnet, Episode: &episode})
	if err != nil {
		t.Fatal(err)
	}
	if again.ID != started.ID {
		t.Errorf("a second stream %d for the same episode, want %d", again.ID, started.ID)
	}
}

func TestStreamWithoutTheEpisodeFails(t *testing.T) {
	h := newHarness(t)
	client := withStreaming(t, h)
	client.set(debrid.Remote{Hash: frierenHash, Ready: true, Files: batchFiles()})

	episode := 9
	got, err := h.svc.StartStream(context.Background(), StreamRequest{MediaRef: "anilist:154587", Magnet: frierenMagnet, Episode: &episode})
	if err != nil {
		t.Fatal(err)
	}
	if got.State != "failed" || got.Error == "" {
		t.Errorf("got = %+v", got)
	}
}

func TestStreamWithoutAnEpisodePlaysTheLargestVideo(t *testing.T) {
	h := newHarness(t)
	client := withStreaming(t, h)
	client.set(debrid.Remote{Hash: frierenHash, Ready: true, Files: batchFiles()})

	got, err := h.svc.StartStream(context.Background(), StreamRequest{MediaRef: "anilist:154587", Magnet: frierenMagnet})
	if err != nil {
		t.Fatal(err)
	}
	if got.State != "ready" || got.Name != "Sousou no Frieren - 02.mkv" {
		t.Errorf("got = %+v", got)
	}
}

func TestStreamTheServiceGaveUpOn(t *testing.T) {
	h := newHarness(t)
	client := withStreaming(t, h)
	client.set(debrid.Remote{Hash: frierenHash, Failed: "Fake: no seeds"})

	got, err := h.svc.StartStream(context.Background(), StreamRequest{MediaRef: "anilist:154587", Magnet: frierenMagnet})
	if err != nil {
		t.Fatal(err)
	}
	if got.State != "failed" || got.Error != "Fake: no seeds" {
		t.Errorf("got = %+v", got)
	}
}

func TestStreamNobodySharesGivesUp(t *testing.T) {
	h := newHarness(t)
	client := withStreaming(t, h)
	ctx := context.Background()

	now := time.Date(2026, 10, 6, 12, 0, 0, 0, time.UTC)
	h.svc.opts.Now = func() time.Time { return now }

	client.set(debrid.Remote{Hash: frierenHash})

	started, err := h.svc.StartStream(ctx, StreamRequest{MediaRef: "anilist:154587", Magnet: frierenMagnet})
	if err != nil {
		t.Fatal(err)
	}
	if started.State != "preparing" {
		t.Fatalf("started = %+v", started)
	}

	now = now.Add(streamStall + time.Second)
	stalled, err := h.svc.StreamStatus(ctx, started.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stalled.State != "failed" || !strings.Contains(stalled.Error, "Fake found nobody sharing") {
		t.Fatalf("stalled = %+v", stalled)
	}

	// A torrent that moves, however slowly, is still waited for.
	client.set(debrid.Remote{Hash: frierenHash, Progress: 0.01})
	moving, err := h.svc.StreamStatus(ctx, started.ID)
	if err != nil {
		t.Fatal(err)
	}
	if moving.State != "preparing" {
		t.Fatalf("moving = %+v", moving)
	}
}

func TestAFileChosenByHandIsAStreamOfItsOwn(t *testing.T) {
	h := newHarness(t)
	client := withStreaming(t, h)
	client.set(debrid.Remote{Hash: frierenHash, Ready: true, Files: batchFiles()})
	ctx := context.Background()

	episode := 1
	first, err := h.svc.StartStream(ctx, StreamRequest{MediaRef: "anilist:154587", Magnet: frierenMagnet, Episode: &episode})
	if err != nil {
		t.Fatal(err)
	}

	if first.State != "ready" || first.Name != "Sousou no Frieren - 01.mkv" {
		t.Fatalf("first %+v", first)
	}

	// The videos stay on offer while it plays, and the subtitle file is not one.
	if len(first.Files) != 2 || first.Files[0].ID != 0 || first.Files[1].ID != 1 {
		t.Fatalf("files %+v, want the two videos", first.Files)
	}

	chosen, err := h.svc.ChooseStreamFile(ctx, first.ID, 1)
	if err != nil {
		t.Fatal(err)
	}

	// Its own ID, so a player that holds the first one opens it afresh.
	if chosen.ID == first.ID || chosen.State != "ready" || chosen.FileID != -chosen.ID || chosen.Name != "Sousou no Frieren - 02.mkv" {
		t.Fatalf("chosen %+v", chosen)
	}

	file, err := h.svc.StreamFile(ctx, chosen.FileID)
	if err != nil {
		t.Fatal(err)
	}

	// What gets marked watched is what the user asked for, not the file's own number.
	if file.Episode == nil || *file.Episode != 1 || file.Key != "stream-"+frierenHash+"-1" {
		t.Errorf("file %+v, episode %v", file, file.Episode)
	}

	// The first still plays its own file.
	if again, statusErr := h.svc.StreamStatus(ctx, first.ID); statusErr != nil || again.Name != "Sousou no Frieren - 01.mkv" {
		t.Errorf("the first stream became %+v, %v", again, statusErr)
	}

	// Asking again for the same torrent and episode gives what was chosen.
	asked, err := h.svc.StartStream(ctx, StreamRequest{MediaRef: "anilist:154587", Magnet: frierenMagnet, Episode: &episode})
	if err != nil {
		t.Fatal(err)
	}

	if asked.ID != chosen.ID {
		t.Errorf("asking again gave stream %d, want the chosen one %d", asked.ID, chosen.ID)
	}
}

func TestAStreamThatFoundNoEpisodeStillOffersItsVideos(t *testing.T) {
	h := newHarness(t)
	client := withStreaming(t, h)
	client.set(debrid.Remote{Hash: frierenHash, Ready: true, Files: batchFiles()})

	episode := 9
	failed, err := h.svc.StartStream(context.Background(), StreamRequest{MediaRef: "anilist:154587", Magnet: frierenMagnet, Episode: &episode})
	if err != nil {
		t.Fatal(err)
	}

	if failed.State != "failed" || len(failed.Files) != 2 {
		t.Fatalf("state %q, files %+v", failed.State, failed.Files)
	}
}

func TestOnlyAVideoOfTheStreamsTorrentCanBeChosen(t *testing.T) {
	h := newHarness(t)
	client := withStreaming(t, h)
	client.set(debrid.Remote{Hash: frierenHash, Ready: true, Files: batchFiles()})
	ctx := context.Background()

	episode := 9
	failed, err := h.svc.StartStream(ctx, StreamRequest{MediaRef: "anilist:154587", Magnet: frierenMagnet, Episode: &episode})
	if err != nil {
		t.Fatal(err)
	}

	for name, fileID := range map[string]int{"a subtitle": 2, "no such file": 7} {
		if _, chooseErr := h.svc.ChooseStreamFile(ctx, failed.ID, fileID); apperr.KindOf(chooseErr) != apperr.KindInvalid {
			t.Errorf("%s: err = %v, want invalid", name, chooseErr)
		}
	}

	if _, chooseErr := h.svc.ChooseStreamFile(ctx, failed.ID+100, 0); apperr.KindOf(chooseErr) != apperr.KindNotFound {
		t.Errorf("unknown stream: err = %v, want not found", chooseErr)
	}

	if status, statusErr := h.svc.StreamStatus(ctx, failed.ID); statusErr != nil || status.State != "failed" {
		t.Errorf("refused choices changed the stream: %+v, %v", status, statusErr)
	}

	if len(h.svc.streams.byID) != 1 {
		t.Errorf("refused choices left %d streams, want the one", len(h.svc.streams.byID))
	}
}
