package service

import (
	"context"
	"slices"
	"testing"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

func withAutoDownloads(t *testing.T, h *harness) {
	t.Helper()

	h.configure(t)
	h.withSearch(frierenNames)
	ix := newIndexer(t)
	addSource(t, h, "Jackett", ix.server.URL+"/api", "key")
}

func autoDownload(episode int) AddRequest {
	return AddRequest{MediaRef: "anilist:154587", Title: "Frieren", Auto: true, Episode: &episode}
}

func TestAutoDownloadTakesTheEpisodesOwnRelease(t *testing.T) {
	h := newHarness(t)
	withAutoDownloads(t, h)

	download, err := h.svc.Add(context.Background(), autoDownload(12))
	if err != nil {
		t.Fatal(err)
	}

	// The episode alone over the better seeded batch, and never the 13th.
	if len(h.client.added) != 1 || h.client.added[0].Magnet != "magnet:?xt=urn:btih:"+hashB {
		t.Fatalf("added %+v, want episode 12's release", h.client.added)
	}
	if download.Choosing || !slices.Equal(download.Episodes, []int{12}) {
		t.Errorf("download = %+v, want it for episode 12 with nothing to choose", download)
	}
}

func TestAutoDownloadTakesOnlyTheEpisodeFromABatch(t *testing.T) {
	h := newHarness(t)
	withAutoDownloads(t, h)
	if _, err := h.svc.SetProfile(context.Background(), TorrentProfile{Excluded: []string{"SubsPlease"}}); err != nil {
		t.Fatal(err)
	}

	download, err := h.svc.Add(context.Background(), autoDownload(12))
	if err != nil {
		t.Fatal(err)
	}

	if len(h.client.added) != 1 || string(h.client.added[0].Torrent) != batchTorrent {
		t.Fatalf("added %+v, want the batch once the episode's release is excluded", h.client.added)
	}
	if !download.Choosing || !slices.Equal(download.Episodes, []int{12}) {
		t.Errorf("download = %+v, want the batch held for episode 12's files", download)
	}
}

func TestAutoDownloadWithNothingForTheEpisode(t *testing.T) {
	h := newHarness(t)
	withAutoDownloads(t, h)
	if _, err := h.svc.SetProfile(context.Background(), TorrentProfile{Excluded: []string{"SubsPlease", "Erai"}}); err != nil {
		t.Fatal(err)
	}

	_, err := h.svc.Add(context.Background(), autoDownload(12))
	if apperr.KindOf(err) != apperr.KindNotFound {
		t.Fatalf("err = %v, want not found", err)
	}
	if len(h.client.added) != 0 {
		t.Fatalf("added %+v, want nothing", h.client.added)
	}
}

func TestAutoDownloadIsOneWayToSayWhatToDownload(t *testing.T) {
	h := newHarness(t)
	withAutoDownloads(t, h)

	req := autoDownload(12)
	req.Magnet = frierenMagnet

	if _, err := h.svc.Add(context.Background(), req); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("err = %v, want auto and a magnet refused together", err)
	}
}

func TestAutoDownloadSkipsUnseededReleases(t *testing.T) {
	releases := []TorrentRelease{
		{ID: "dead", Title: "dead", Match: "episode", Seeders: 0, Eligible: true, Score: 900},
		{ID: "batch", Title: "batch", Match: "batch", Seeders: 50, Eligible: true, Score: 100},
		{ID: "other", Title: "other", Match: "unknown", Seeders: 900, Eligible: true, Score: 500},
	}

	best := bestDownloadRelease(releases, true, &TorrentProfile{})
	if best == nil || best.ID != "batch" {
		t.Fatalf("best = %+v, want the seeded batch: a dead torrent never finishes", best)
	}
}
