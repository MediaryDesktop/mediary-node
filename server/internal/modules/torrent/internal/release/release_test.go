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

func TestParseSeasons(t *testing.T) {
	cases := []struct {
		name    string
		season  int
		episode int
		batch   bool
	}{
		{"Breaking.Bad.S02E05.1080p.WEB-DL.x264", 2, 5, false},
		{"Breaking Bad S02 1080p BluRay x265", 2, 0, true},
		{"Breaking.Bad.Season.3.Complete.720p", 3, 0, true},
		{"The Office (US) s03e07 Branch Wars", 3, 7, false},
		{"[SubsPlease] Sousou no Frieren - 13 (1080p) [ABCD1234].mkv", 0, 13, false},
		{"Squid Game 2021 1080p NF WEB-DL", 0, 0, false},
	}

	for _, c := range cases {
		info := Parse(c.name)

		season := 0
		if info.Season != nil {
			season = *info.Season
		}

		episode := 0
		if info.Episodes != nil && info.Episodes.From == info.Episodes.To {
			episode = info.Episodes.From
		}

		if season != c.season || episode != c.episode || info.Batch != c.batch {
			t.Errorf("%s = season %d episode %d batch %v, want %d %d %v", c.name, season, episode, info.Batch, c.season, c.episode, c.batch)
		}
	}
}

// A release spanning several seasons has no single season — it would mislead a
// release that is really the whole series into looking like only one season of
// it, and would keep it from matching a search for any other season.
func TestParseSeasonSpan(t *testing.T) {
	cases := []struct {
		name     string
		from, to int
	}{
		{"Менталіст / The Mentalist, S1-7E1-151 of 151 (2008-2015) WEB-DL", 1, 151},
		{"The Mentalist S01-S07 E01-151 (2008-2015) WEB-DL", 1, 151},
	}

	for _, c := range cases {
		info := Parse(c.name)

		if info.Season != nil {
			t.Errorf("Parse(%q).Season = %d, want none", c.name, *info.Season)
		}
		if info.Episodes == nil || info.Episodes.From != c.from || info.Episodes.To != c.to {
			t.Errorf("Parse(%q).Episodes = %+v, want %d-%d", c.name, info.Episodes, c.from, c.to)
		}
		if !info.Batch {
			t.Errorf("Parse(%q).Batch = false, want true", c.name)
		}
	}
}
