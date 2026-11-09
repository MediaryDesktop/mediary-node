package embedded

import (
	"github.com/anacrolix/torrent"
	"github.com/anacrolix/torrent/metainfo"
)

// publicTrackers are given to every torrent the client adds, unless it is
// private. Releases come as a bare info hash, and finding peers through DHT
// alone takes minutes or never works behind some networks; a tracker names the
// swarm in a second.
var publicTrackers = []string{
	"http://nyaa.tracker.wf:7777/announce",
	"udp://tracker.opentrackr.org:1337/announce",
	"udp://open.stealth.si:80/announce",
	"udp://tracker.torrent.eu.org:451/announce",
	"udp://exodus.desync.com:6969/announce",
	"udp://open.demonii.com:1337/announce",
	"udp://tracker.openbittorrent.com:6969/announce",
}

// withTrackers adds the public trackers the torrent does not name already — but
// never to a private one. A private torrent's own flag says its swarm is
// closed: naming it to a tracker that never heard of it does nothing useful,
// and most private trackers ban an account caught adding trackers of its own.
// mi is nil for a magnet, which a private tracker does not hand out in the
// first place, so a bare info hash is always added as it was before.
func withTrackers(spec *torrent.TorrentSpec, mi *metainfo.MetaInfo) {
	if mi != nil && isPrivate(mi) {
		return
	}

	known := map[string]bool{}
	for _, tier := range spec.Trackers {
		for _, url := range tier {
			known[url] = true
		}
	}

	var extra []string
	for _, url := range publicTrackers {
		if !known[url] {
			extra = append(extra, url)
		}
	}

	if len(extra) > 0 {
		spec.Trackers = append(spec.Trackers, extra)
	}
}

func isPrivate(mi *metainfo.MetaInfo) bool {
	info, err := mi.UnmarshalInfo()

	return err == nil && info.Private != nil && *info.Private
}
