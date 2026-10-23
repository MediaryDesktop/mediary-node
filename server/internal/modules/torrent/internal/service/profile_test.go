package service

import (
	"context"
	"testing"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/release"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

func candidate(title string, seeders int, match string) TorrentRelease {
	return TorrentRelease{Title: title, Seeders: seeders, Match: match, Info: release.Parse(title)}
}

func bestOf(t *testing.T, releases []TorrentRelease) string {
	t.Helper()

	for i := range releases {
		if releases[i].Best {
			return releases[i].Title
		}
	}

	return ""
}

func TestTheProfilePicksTheBest(t *testing.T) {
	releases := []TorrentRelease{
		candidate("[SubsPlease] Frieren - 13 (720p)", 400, "episode"),
		candidate("Frieren - AniLiberty.TOP [WEB-DL 1080p][HEVC][1-28]", 60, "batch"),
		candidate("[Erai-raws] Frieren - 13 [1080p][AVC]", 120, "episode"),
		candidate("[Dub] Frieren - 13 [1080p][HEVC]", 900, "episode"),
		candidate("Frieren Complete [1080p HEVC]", 0, "batch"),
	}

	profile := &TorrentProfile{
		Resolution: "1080p",
		Codec:      "HEVC",
		Preferred:  []string{"AniLiberty", "Erai-raws"},
		Excluded:   []string{"dub"},
		MinSeeders: 5,
	}

	rank(releases, profile)

	if got := bestOf(t, releases); got != "Frieren - AniLiberty.TOP [WEB-DL 1080p][HEVC][1-28]" {
		t.Fatalf("best = %q", got)
	}

	for _, found := range releases {
		switch found.Title {
		case "[Dub] Frieren - 13 [1080p][HEVC]", "Frieren Complete [1080p HEVC]":
			if found.Eligible {
				t.Errorf("%q must not be eligible", found.Title)
			}
		default:
			if !found.Eligible {
				t.Errorf("%q must be eligible", found.Title)
			}
		}
	}
}

func TestWithoutAProfileSeedersAndTheExactEpisodeDecide(t *testing.T) {
	releases := []TorrentRelease{
		candidate("Frieren 01-28 [720p]", 300, "batch"),
		candidate("Frieren - 13 [720p]", 250, "episode"),
		candidate("Frieren Movie", 900, "unknown"),
	}

	rank(releases, &TorrentProfile{})

	if got := bestOf(t, releases); got != "Frieren - 13 [720p]" {
		t.Fatalf("best = %q", got)
	}
}

// Real releases for Frieren with no episode asked, 24.10.2026: one episode had
// more seeders than the whole season.
func TestForTheWholeTitleARangeOfEpisodesIsBest(t *testing.T) {
	releases := []TorrentRelease{
		candidate("[Arg0] Frieren: Beyond Journey's End (2023) - S01E01 v3 (WEB 1080p HEVC x265 E-AC-3) [Dual-Audio]", 111, "any"),
		candidate("Sousou no Frieren - AniLiberty.TOP [WEBRip 1080p][HEVC][1-28]", 101, "any"),
		candidate("[SubsPlease] Sousou no Frieren (01-28) (1080p) [V2] [Batch]", 101, "any"),
		candidate("Frieren Complete Movie Collection [1080p]", 400, "any"),
	}

	rank(releases, &TorrentProfile{})

	if got := bestOf(t, releases); got != "Sousou no Frieren - AniLiberty.TOP [WEBRip 1080p][HEVC][1-28]" && got != "[SubsPlease] Sousou no Frieren (01-28) (1080p) [V2] [Batch]" {
		t.Fatalf("best = %q, want a batch of the 28 episodes", got)
	}
}

func TestTheProfileIsSavedClean(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	empty, err := h.svc.Profile(ctx)
	if err != nil || empty.Resolution != "" || len(empty.Preferred) != 0 {
		t.Fatalf("a fresh node's profile = %+v, %v", empty, err)
	}

	_, err = h.svc.SetProfile(ctx, TorrentProfile{
		Resolution: "1080p",
		Preferred:  []string{" AniLiberty ", "", "aniliberty", "SubsPlease"},
		Excluded:   []string{"dub"},
		MinSeeders: 3,
	})
	if err != nil {
		t.Fatal(err)
	}

	saved, err := h.svc.Profile(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(saved.Preferred) != 2 || saved.Preferred[0] != "AniLiberty" || saved.Preferred[1] != "SubsPlease" || saved.MinSeeders != 3 {
		t.Fatalf("saved = %+v", saved)
	}

	if _, err := h.svc.SetProfile(ctx, TorrentProfile{MinSeeders: -1}); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("negative seeders: %v, want invalid", err)
	}
}
