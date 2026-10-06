package library

import "testing"

func TestNameEpisode(t *testing.T) {
	m := &Module{}

	cases := []struct {
		path    string
		video   bool
		episode int
	}{
		{"[SubsPlease] Sousou no Frieren - 13 (1080p) [ABCD1234].mkv", true, 13},
		{"Frieren S01/Sousou no Frieren - S01E07.mp4", true, 7},
		{"Frieren/Extras/NCOP01.mkv", true, 0},
		{"Frieren/Sousou no Frieren - 13.ass", false, 0},
		{"Frieren/cover.jpg", false, 0},
	}

	for _, tc := range cases {
		video, episode := m.NameEpisode(tc.path)
		got := 0
		if episode != nil {
			got = *episode
		}
		if video != tc.video || got != tc.episode {
			t.Errorf("NameEpisode(%q) = %v, %d; want %v, %d", tc.path, video, got, tc.video, tc.episode)
		}
	}
}
