package service

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/qbittorrent"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

// A feed for a title the library has episodes 1 and 2 of.
func newEpisodeIndexer(t *testing.T) *httptest.Server {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(feed(
			item("[SubsPlease] Sousou no Frieren - 01 (1080p)", strings.Repeat("1", 40), 90, "magnet:?xt=urn:btih:"+strings.Repeat("1", 40)),
			item("[SubsPlease] Sousou no Frieren - 02 (1080p)", strings.Repeat("2", 40), 90, "magnet:?xt=urn:btih:"+strings.Repeat("2", 40)),
			item("[SubsPlease] Sousou no Frieren - 03 (720p)", strings.Repeat("3", 40), 200, "magnet:?xt=urn:btih:"+strings.Repeat("3", 40)),
			item("[Erai-raws] Sousou no Frieren - 03 [1080p]", strings.Repeat("4", 40), 50, "magnet:?xt=urn:btih:"+strings.Repeat("4", 40)),
			item("[SubsPlease] Sousou no Frieren - 04 (1080p)", strings.Repeat("5", 40), 80, "magnet:?xt=urn:btih:"+strings.Repeat("5", 40)),
			item("[Erai-raws] Sousou no Frieren - 01 ~ 28 [1080p][Batch]", strings.Repeat("6", 40), 900, "magnet:?xt=urn:btih:"+strings.Repeat("6", 40)),
			item("[SubsPlease] Sousou no Frieren - 30 (1080p)", strings.Repeat("7", 40), 90, "magnet:?xt=urn:btih:"+strings.Repeat("7", 40)),
			item("[SubsPlease] Sousou no Frieren - 05 (1080p)", strings.Repeat("8", 40), 0, "magnet:?xt=urn:btih:"+strings.Repeat("8", 40)),
			// Indexers search loosely; another title must never be taken.
			item("[SubsPlease] Tensei Shitara Ken Deshita - 06 (1080p)", strings.Repeat("9", 40), 999, "magnet:?xt=urn:btih:"+strings.Repeat("9", 40)),
		)))
	}))
	t.Cleanup(server.Close)

	return server
}

func newRuleHarness(t *testing.T) *harness {
	t.Helper()

	h := newHarness(t)
	h.configure(t)
	h.withSearch(frierenNames)
	h.library.episodes = map[string][]int{"anilist:154587": {1, 2}}

	addSource(t, h, "Jackett", newEpisodeIndexer(t).URL+"/api", "key")

	if _, err := h.svc.SetProfile(context.Background(), TorrentProfile{Resolution: "1080p"}); err != nil {
		t.Fatal(err)
	}

	return h
}

func TestARuleStartsAfterTheLibrary(t *testing.T) {
	h := newRuleHarness(t)

	rule, err := h.svc.PutRule(context.Background(), RuleInput{MediaRef: "anilist:154587", Title: "Frieren", Enabled: true})
	if err != nil {
		t.Fatal(err)
	}
	if rule.FromEpisode != 3 {
		t.Fatalf("from = %d, want the episode after the library's last", rule.FromEpisode)
	}

	zero := 0
	if _, err := h.svc.PutRule(context.Background(), RuleInput{MediaRef: "anilist:154587", Title: "Frieren", FromEpisode: &zero}); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("episode 0: %v, want invalid", err)
	}
}

func TestARulePlansOnlyMissingSingleEpisodes(t *testing.T) {
	h := newRuleHarness(t)
	ctx := context.Background()

	from := 1
	if _, err := h.svc.PutRule(ctx, RuleInput{MediaRef: "anilist:154587", Title: "Frieren", FromEpisode: &from, Enabled: true}); err != nil {
		t.Fatal(err)
	}

	preview, err := h.svc.CheckRule(ctx, "anilist:154587", true)
	if err != nil {
		t.Fatal(err)
	}

	var got []string
	for _, planned := range preview.Planned {
		got = append(got, fmt.Sprintf("%d-%d %s", planned.Episodes[0], planned.Episodes[len(planned.Episodes)-1], planned.Release.Title))
	}

	// 1 and 2 are in the library, 30 is past the title's 28 and the single 05
	// has no seeders; of the two 03s the profile wants 1080p. What no single
	// release holds comes from the batch, without the episodes already here.
	want := []string{
		"3-3 [Erai-raws] Sousou no Frieren - 03 [1080p]",
		"4-4 [SubsPlease] Sousou no Frieren - 04 (1080p)",
		"5-28 [Erai-raws] Sousou no Frieren - 01 ~ 28 [1080p][Batch]",
	}
	if strings.Join(got, "|") != strings.Join(want, "|") {
		t.Fatalf("planned = %v, want %v", got, want)
	}
	if preview.Added != 0 || len(h.client.added) != 0 {
		t.Fatalf("a preview added %d, client got %v", preview.Added, h.client.added)
	}

	check, err := h.svc.CheckRule(ctx, "anilist:154587", false)
	if err != nil {
		t.Fatal(err)
	}
	if check.Added != 3 || len(h.client.added) != 3 {
		t.Fatalf("check = %+v, client got %d", check, len(h.client.added))
	}
	if batch := h.client.added[2]; !batch.Hold {
		t.Fatalf("a batch is held for its episodes' files, got %+v", batch)
	}

	again, err := h.svc.CheckRule(ctx, "anilist:154587", false)
	if err != nil {
		t.Fatal(err)
	}
	if again.Added != 0 || len(again.Planned) != 0 {
		t.Fatalf("an episode already downloading is not planned again, got %+v", again)
	}

	rule, err := h.svc.Rule(ctx, "anilist:154587")
	if err != nil || rule.LastChecked == nil || rule.LastAdded != 0 {
		t.Fatalf("rule = %+v, %v", rule, err)
	}
}

func TestDisabledRulesDoNotRun(t *testing.T) {
	h := newRuleHarness(t)
	ctx := context.Background()

	if _, err := h.svc.PutRule(ctx, RuleInput{MediaRef: "anilist:154587", Title: "Frieren", Enabled: false}); err != nil {
		t.Fatal(err)
	}

	h.svc.runRules(ctx)

	if len(h.client.added) != 0 {
		t.Fatalf("a disabled rule added %v", h.client.added)
	}

	if err := h.svc.DeleteRule(ctx, "anilist:154587"); err != nil {
		t.Fatal(err)
	}
	if err := h.svc.DeleteRule(ctx, "anilist:154587"); apperr.KindOf(err) != apperr.KindNotFound {
		t.Fatalf("second delete: %v, want not found", err)
	}
}

func TestAHeldBatchGetsOnlyItsEpisodesFiles(t *testing.T) {
	h := newHarness(t)
	h.configure(t)
	ctx := context.Background()

	download, err := h.svc.Add(ctx, AddRequest{
		MediaRef:    "anilist:154587",
		Title:       "Frieren",
		Magnet:      frierenMagnet,
		ChooseFiles: true,
		Episodes:    []int{3},
	})
	if err != nil {
		t.Fatal(err)
	}

	h.client.set(
		qbittorrent.Torrent{Hash: frierenHash, State: "stoppedDL"},
		qbittorrent.File{Index: 0, Name: "Frieren/Frieren - 01.mkv", Priority: 1},
		qbittorrent.File{Index: 1, Name: "Frieren/Frieren - 03.mkv", Priority: 1},
		qbittorrent.File{Index: 2, Name: "Frieren/Frieren - 03.ass", Priority: 1},
		qbittorrent.File{Index: 3, Name: "Frieren/Frieren - 01.ass", Priority: 1},
		qbittorrent.File{Index: 4, Name: "Frieren/Fonts/Arial.ttf", Priority: 1},
	)

	h.svc.Poll(ctx)

	got := h.client.priorities[frierenHash]
	want := map[int]int{0: 0, 1: 1, 2: 1, 3: 0, 4: 1}
	for index, priority := range want {
		if got[index] != priority {
			t.Fatalf("priorities = %v, want %v", got, want)
		}
	}
	if len(h.client.resumed) != 1 {
		t.Fatalf("the batch starts once its files are picked, resumed = %v", h.client.resumed)
	}
	if listed := h.only(t); listed.Choosing || listed.ID != download.ID {
		t.Fatalf("download = %+v", listed)
	}
}

func TestABatchWithoutTheEpisodesIsGivenUp(t *testing.T) {
	h := newHarness(t)
	h.configure(t)
	ctx := context.Background()

	if _, err := h.svc.Add(ctx, AddRequest{
		MediaRef:    "anilist:154587",
		Title:       "Frieren",
		Magnet:      frierenMagnet,
		ChooseFiles: true,
		Episodes:    []int{9},
	}); err != nil {
		t.Fatal(err)
	}

	h.client.set(
		qbittorrent.Torrent{Hash: frierenHash, State: "stoppedDL"},
		qbittorrent.File{Index: 0, Name: "Frieren - 01.mkv", Priority: 1},
	)

	h.svc.Poll(ctx)

	if withFiles, ok := h.client.deleted[frierenHash]; !ok || !withFiles {
		t.Fatalf("deleted = %v, want the batch taken out", h.client.deleted)
	}
	if listed := h.only(t); listed.State != "failed" {
		t.Fatalf("download = %+v, want failed", listed)
	}
}
