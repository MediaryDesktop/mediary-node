package embedded

import (
	"testing"

	"github.com/anacrolix/torrent"
	"github.com/anacrolix/torrent/bencode"
	"github.com/anacrolix/torrent/metainfo"
)

func metaInfoOf(t *testing.T, private bool) *metainfo.MetaInfo {
	t.Helper()

	info := metainfo.Info{Name: "Release", PieceLength: 16 << 10, Length: 1}
	if private {
		yes := true
		info.Private = &yes
	}

	infoBytes, err := bencode.Marshal(info)
	if err != nil {
		t.Fatal(err)
	}

	return &metainfo.MetaInfo{InfoBytes: infoBytes}
}

func trackerCount(spec *torrent.TorrentSpec) int {
	count := 0
	for _, tier := range spec.Trackers {
		count += len(tier)
	}

	return count
}

func TestWithTrackersSkipsAPrivateTorrent(t *testing.T) {
	spec := &torrent.TorrentSpec{}
	withTrackers(spec, metaInfoOf(t, true))

	if n := trackerCount(spec); n != 0 {
		t.Fatalf("trackers added = %d, want none on a private torrent", n)
	}
}

func TestWithTrackersAddsThemToAPublicTorrent(t *testing.T) {
	spec := &torrent.TorrentSpec{}
	withTrackers(spec, metaInfoOf(t, false))

	if n := trackerCount(spec); n != len(publicTrackers) {
		t.Fatalf("trackers added = %d, want all %d public ones", n, len(publicTrackers))
	}
}

func TestWithTrackersAddsThemToAMagnet(t *testing.T) {
	spec := &torrent.TorrentSpec{}
	withTrackers(spec, nil)

	if n := trackerCount(spec); n != len(publicTrackers) {
		t.Fatalf("trackers added = %d, want all %d public ones; a private tracker never hands out a magnet", n, len(publicTrackers))
	}
}

func TestWithTrackersDoesNotDuplicateAKnownOne(t *testing.T) {
	spec := &torrent.TorrentSpec{Trackers: [][]string{{publicTrackers[0]}}}
	withTrackers(spec, metaInfoOf(t, false))

	count := 0
	for _, tier := range spec.Trackers {
		for _, url := range tier {
			if url == publicTrackers[0] {
				count++
			}
		}
	}
	if count != 1 {
		t.Fatalf("occurrences of %q = %d, want 1", publicTrackers[0], count)
	}
}
