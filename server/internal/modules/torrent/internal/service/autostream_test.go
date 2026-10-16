package service

import (
	"context"
	"testing"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/debrid"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

func withAutoStreaming(t *testing.T, h *harness) *streamingClient {
	t.Helper()

	h.withSearch(frierenNames)
	ix := newIndexer(t)
	client := withStreaming(t, h)
	addSource(t, h, "Jackett", ix.server.URL+"/api", "key")

	client.set(debrid.Remote{Hash: frierenHash, Progress: 0.1})

	return client
}

func autoRequest(episode int) StreamRequest {
	return StreamRequest{MediaRef: "anilist:154587", Title: "Frieren", Auto: true, Episode: &episode}
}

func TestAutoStreamPlaysTheBestReleaseOfTheEpisode(t *testing.T) {
	h := newHarness(t)
	client := withAutoStreaming(t, h)

	got, err := h.svc.StartStream(context.Background(), autoRequest(12))
	if err != nil {
		t.Fatal(err)
	}

	// The episode's own release over the batch, and never the 13th.
	if len(client.streams) != 1 || client.streams[0] != "magnet:?xt=urn:btih:"+hashB {
		t.Fatalf("played %v, want episode 12's release", client.streams)
	}
	if got.Release != "[SubsPlease] Sousou no Frieren - 12 (1080p)" || got.State != "preparing" {
		t.Errorf("stream = %+v", got)
	}
}

func TestAutoStreamSkipsExcludedReleases(t *testing.T) {
	h := newHarness(t)
	withAutoStreaming(t, h)
	if _, err := h.svc.SetProfile(context.Background(), TorrentProfile{Excluded: []string{"SubsPlease"}}); err != nil {
		t.Fatal(err)
	}

	got, err := h.svc.StartStream(context.Background(), autoRequest(12))
	if err != nil {
		t.Fatal(err)
	}
	if got.Release != "[Erai-raws] Frieren - 01 ~ 28 [1080p][Batch]" {
		t.Errorf("release = %q, want the batch once the episode's release is excluded", got.Release)
	}
}

func TestAutoStreamWithNothingForTheEpisode(t *testing.T) {
	h := newHarness(t)
	withAutoStreaming(t, h)
	if _, err := h.svc.SetProfile(context.Background(), TorrentProfile{Excluded: []string{"SubsPlease", "Erai"}}); err != nil {
		t.Fatal(err)
	}

	_, err := h.svc.StartStream(context.Background(), autoRequest(12))
	if apperr.KindOf(err) != apperr.KindNotFound {
		t.Fatalf("err = %v, want not found", err)
	}
}

func TestAutoStreamIsOneWayToSayWhatToPlay(t *testing.T) {
	h := newHarness(t)
	withAutoStreaming(t, h)

	req := autoRequest(12)
	req.Magnet = frierenMagnet

	if _, err := h.svc.StartStream(context.Background(), req); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("err = %v, want auto and a magnet refused together", err)
	}
}

func TestHeldReleaseStreamsBeforeABetterSeededOne(t *testing.T) {
	held, notHeld := true, false
	releases := []TorrentRelease{
		{ID: "seeded", Title: "seeded", Match: "episode", Seeders: 500, Eligible: true, Score: 300, Cached: &notHeld},
		{ID: "held", Title: "held", Match: "batch", Seeders: 0, Eligible: false, Score: 10, Cached: &held},
		{ID: "dead", Title: "dead", Match: "episode", Seeders: 0, Eligible: false, Score: 400, Cached: &notHeld},
		{ID: "other", Title: "other", Match: "unknown", Seeders: 900, Eligible: true, Score: 500},
	}

	best := bestStreamRelease(releases, true, &TorrentProfile{})
	if best == nil || best.ID != "held" {
		t.Fatalf("best = %+v, want the release the service holds", best)
	}

	releases[1].Cached = &notHeld
	if best = bestStreamRelease(releases, true, &TorrentProfile{}); best == nil || best.ID != "seeded" {
		t.Fatalf("best = %+v, want the seeded one: nothing plays from a dead torrent", best)
	}
}

func TestEpisodeStreamsBeforeABatchTheServiceMustFetch(t *testing.T) {
	releases := []TorrentRelease{
		{ID: "batch", Title: "batch", Match: "batch", Seeders: 900, Eligible: true, Score: 500},
		{ID: "episode", Title: "episode", Match: "episode", Seeders: 40, Eligible: true, Score: 200},
	}

	if best := bestStreamRelease(releases, true, &TorrentProfile{}); best == nil || best.ID != "episode" {
		t.Fatalf("best = %+v, want the episode alone", best)
	}

	held := true
	releases[0].Cached = &held
	if best := bestStreamRelease(releases, true, &TorrentProfile{}); best == nil || best.ID != "batch" {
		t.Fatalf("best = %+v, want the batch the service holds", best)
	}
}

func TestAutoStreamPassesOverAReleaseThatStalled(t *testing.T) {
	h := newHarness(t)
	client := withAutoStreaming(t, h)
	ctx := context.Background()

	now := time.Date(2026, 10, 6, 12, 0, 0, 0, time.UTC)
	h.svc.opts.Now = func() time.Time { return now }
	client.set(debrid.Remote{Hash: frierenHash})

	first, err := h.svc.StartStream(ctx, autoRequest(12))
	if err != nil {
		t.Fatal(err)
	}

	now = now.Add(streamStall + time.Second)
	if stalled, statusErr := h.svc.StreamStatus(ctx, first.ID); statusErr != nil || stalled.State != "failed" {
		t.Fatalf("stalled = %+v, err = %v", stalled, statusErr)
	}

	again, err := h.svc.StartStream(ctx, autoRequest(12))
	if err != nil {
		t.Fatal(err)
	}
	if again.Release != "[Erai-raws] Frieren - 01 ~ 28 [1080p][Batch]" {
		t.Errorf("release = %q, want the batch once the episode's release stalled", again.Release)
	}
}
