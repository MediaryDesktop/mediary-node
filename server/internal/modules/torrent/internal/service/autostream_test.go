package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/debrid"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
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

func TestAutoStreamPassesOverAnotherSeasonsBatch(t *testing.T) {
	h := newHarness(t)
	h.withSearch(frierenNames)
	client := withStreaming(t, h)
	client.set(debrid.Remote{Hash: frierenHash, Progress: 0.1})

	// As AniLiberty names them: the sequel's batch holds an episode 5 too, and
	// has more seeders.
	plugins := newFakeProviders(Provider{ID: "aniliberty", Name: "AniLiberty", Revision: "r1"})
	plugins.answers["aniliberty"] = []ProviderRelease{
		{Title: "Sousou no Frieren 2nd Season - AniLiberty.TOP [WEB-DL 1080p][HEVC][1-10]", Magnet: "magnet:?xt=urn:btih:2222222222222222222222222222222222222222", Seeders: 137},
		{Title: "Sousou no Frieren - AniLiberty.TOP [WEBRip 1080p][HEVC][1-28]", Magnet: "magnet:?xt=urn:btih:1111111111111111111111111111111111111111", Seeders: 114},
	}
	h.svc.opts.Providers = plugins

	got, err := h.svc.StartStream(context.Background(), autoRequest(5))
	if err != nil {
		t.Fatal(err)
	}

	if len(client.streams) != 1 || client.streams[0] != "magnet:?xt=urn:btih:1111111111111111111111111111111111111111" {
		t.Fatalf("played %v, want the first season's batch", client.streams)
	}
	for _, c := range got.Candidates {
		if strings.Contains(c.Title, "2nd Season") {
			t.Errorf("the 2nd Season is in line: %+v", got.Candidates)
		}
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

	best := bestStreamRelease(releases, true, false, &TorrentProfile{})
	if best == nil || best.ID != "held" {
		t.Fatalf("best = %+v, want the release the service holds", best)
	}

	releases[1].Cached = &notHeld
	if best = bestStreamRelease(releases, true, false, &TorrentProfile{}); best == nil || best.ID != "seeded" {
		t.Fatalf("best = %+v, want the seeded one: nothing plays from a dead torrent", best)
	}
}

func TestEpisodeStreamsBeforeABatchTheServiceMustFetch(t *testing.T) {
	releases := []TorrentRelease{
		{ID: "batch", Title: "batch", Match: "batch", Seeders: 900, Eligible: true, Score: 500},
		{ID: "episode", Title: "episode", Match: "episode", Seeders: 40, Eligible: true, Score: 200},
	}

	if best := bestStreamRelease(releases, true, false, &TorrentProfile{}); best == nil || best.ID != "episode" {
		t.Fatalf("best = %+v, want the episode alone", best)
	}

	held := true
	releases[0].Cached = &held
	if best := bestStreamRelease(releases, true, false, &TorrentProfile{}); best == nil || best.ID != "batch" {
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
	if len(first.Candidates) != 2 || first.Candidates[0].State != "trying" || first.Candidates[1].State != "waiting" {
		t.Fatalf("candidates = %+v, want the episode's release tried and the batch in line", first.Candidates)
	}

	// With another in line, the first is given up on after a minute, not three.
	now = now.Add(candidateStall + time.Second)
	moved, err := h.svc.StreamStatus(ctx, first.ID)
	if err != nil {
		t.Fatal(err)
	}
	if moved.State != "preparing" || moved.Release != "[Erai-raws] Frieren - 01 ~ 28 [1080p][Batch]" {
		t.Fatalf("moved = %+v, want the batch tried in the same stream", moved)
	}
	if moved.Candidates[0].State != "failed" || moved.Candidates[0].Error == "" || moved.Candidates[1].State != "trying" {
		t.Fatalf("candidates = %+v", moved.Candidates)
	}

	// The last one gets the full wait, and then the stream fails.
	now = now.Add(candidateStall + time.Second)
	if waiting, _ := h.svc.StreamStatus(ctx, first.ID); waiting.State != "preparing" {
		t.Fatalf("the last candidate was given up on after a minute: %+v", waiting)
	}

	now = now.Add(streamStall)
	failed, err := h.svc.StreamStatus(ctx, first.ID)
	if err != nil {
		t.Fatal(err)
	}
	if failed.State != "failed" || !strings.Contains(failed.Error, "none of the 2 releases") {
		t.Fatalf("failed = %+v", failed)
	}

	// Asked again, the stalled releases are passed over.
	if _, err = h.svc.StartStream(ctx, autoRequest(12)); apperr.KindOf(err) != apperr.KindNotFound {
		t.Errorf("err = %v, want nothing left to try", err)
	}
}

func TestAutoStreamMovesOnFromATorrentWithoutTheEpisode(t *testing.T) {
	h := newHarness(t)
	client := withAutoStreaming(t, h)

	// Every release turns out to hold episodes 1 and 2, not 12.
	client.set(debrid.Remote{Hash: frierenHash, Ready: true, Files: batchFiles()})

	started, err := h.svc.StartStream(context.Background(), autoRequest(12))
	if err != nil {
		t.Fatal(err)
	}
	if started.State != "preparing" || started.Candidates[0].State != "failed" {
		t.Fatalf("started = %+v, want the batch tried after the first", started)
	}

	// The next poll looks into the batch.
	got, err := h.svc.StreamStatus(context.Background(), started.ID)
	if err != nil {
		t.Fatal(err)
	}

	if len(client.streams) != 2 {
		t.Errorf("tried %d releases, want both in line", len(client.streams))
	}
	if got.State != "failed" || !strings.Contains(got.Error, "no video for this episode") {
		t.Fatalf("stream = %+v", got)
	}
	for _, c := range got.Candidates {
		if c.State != "failed" {
			t.Errorf("candidate %q is %s, want failed", c.Title, c.State)
		}
	}
}
