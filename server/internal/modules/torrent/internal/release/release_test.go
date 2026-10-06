package release

import "testing"

func TestParse(t *testing.T) {
	cases := []struct {
		name       string
		group      string
		resolution string
		codec      string
		from, to   int
		batch      bool
	}{
		{
			name:  "[SubsPlease] Sousou no Frieren - 13 (1080p) [ABCD1234].mkv",
			group: "SubsPlease", resolution: "1080p", from: 13, to: 13,
		},
		{
			name:  "[Erai-raws] Sousou no Frieren - 01 ~ 28 [1080p][HEVC][Multiple Subtitle]",
			group: "Erai-raws", resolution: "1080p", codec: "HEVC", from: 1, to: 28, batch: true,
		},
		{
			name:  "[Judas] Sousou no Frieren (Season 1) [1080p][HEVC x265 10bit][Batch]",
			group: "Judas", resolution: "1080p", codec: "HEVC", batch: true,
		},
		{
			name:       "Tensei Kizoku, Kantei Skill de Nariagaru 3rd Season - AniLiberty.TOP [WEB-DL 1080p][HEVC][1-2]",
			resolution: "1080p", codec: "HEVC", from: 1, to: 2, batch: true,
		},
		{
			name:       "Kono Oto Tomare! - AniLiberty.TOP [BDRip 1080p][x264][1-13]",
			resolution: "1080p", codec: "AVC", from: 1, to: 13, batch: true,
		},
		{
			name:       "Sousou no Frieren S01E07 1080p WEB H.264-VARYG",
			resolution: "1080p", codec: "AVC", from: 7, to: 7,
		},
		{
			name:  "[ASW] Sousou no Frieren - 05v2 [1080p HEVC x265 10Bit][AAC]",
			group: "ASW", resolution: "1080p", codec: "HEVC", from: 5, to: 5,
		},
		{
			name:       "Sousou no Frieren (2023) [1920x1080 x264] [Complete]",
			resolution: "1080p", codec: "AVC", batch: true,
		},
		{
			name:  "[Group] Movie Title 2023 [720p]",
			group: "Group", resolution: "720p",
		},
	}

	for _, tc := range cases {
		got := Parse(tc.name)

		if got.Group != tc.group || got.Resolution != tc.resolution || got.Codec != tc.codec || got.Batch != tc.batch {
			t.Errorf("Parse(%q) = %+v; want group %q, resolution %q, codec %q, batch %v",
				tc.name, got, tc.group, tc.resolution, tc.codec, tc.batch)
		}

		switch {
		case tc.from == 0 && got.Episodes != nil:
			t.Errorf("Parse(%q).Episodes = %+v, want none", tc.name, *got.Episodes)
		case tc.from != 0 && (got.Episodes == nil || got.Episodes.From != tc.from || got.Episodes.To != tc.to):
			t.Errorf("Parse(%q).Episodes = %+v, want %d-%d", tc.name, got.Episodes, tc.from, tc.to)
		}
	}
}
