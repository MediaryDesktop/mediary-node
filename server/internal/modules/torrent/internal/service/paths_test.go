package service

import (
	"path/filepath"
	"testing"
)

func TestFolderName(t *testing.T) {
	cases := map[string]string{
		"Sousou no Frieren":            "Sousou no Frieren",
		"Re:Zero / Season 2?":          "Re Zero Season 2",
		"  Dr. Stone...  ":             "Dr. Stone",
		"":                             "Untitled",
		"???":                          "Untitled",
		"Tab\tand\nnewline":            "Tab and newline",
		`Fate\stay night "UBW" <2014>`: "Fate stay night UBW 2014",
	}

	for in, want := range cases {
		if got := folderName(in); got != want {
			t.Errorf("folderName(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestClientPathFollowsTheMapping(t *testing.T) {
	node := filepath.Join(string(filepath.Separator)+"srv", "media", "Anime", "Frieren")
	nodeRoot := filepath.Join(string(filepath.Separator)+"srv", "media")

	if got := clientPath(node, TorrentPathMap{}); got != node {
		t.Errorf("without a mapping: %q", got)
	}

	if got := clientPath(node, TorrentPathMap{Client: "/downloads/", Node: nodeRoot}); got != "/downloads/Anime/Frieren" {
		t.Errorf("to a Linux client: %q", got)
	}

	if got := clientPath(node, TorrentPathMap{Client: `D:\Media`, Node: nodeRoot}); got != `D:\Media\Anime\Frieren` {
		t.Errorf("to a Windows client: %q", got)
	}

	other := filepath.Join(string(filepath.Separator)+"elsewhere", "Frieren")
	if got := clientPath(other, TorrentPathMap{Client: "/downloads", Node: nodeRoot}); got != other {
		t.Errorf("outside the mapped folder: %q", got)
	}

	// /srv/mediaX is not inside /srv/media.
	sibling := filepath.Join(string(filepath.Separator)+"srv", "mediaX", "Frieren")
	if got := clientPath(sibling, TorrentPathMap{Client: "/downloads", Node: nodeRoot}); got != sibling {
		t.Errorf("a sibling folder: %q", got)
	}
}
