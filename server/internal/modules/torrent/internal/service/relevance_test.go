package service

import "testing"

func TestNamesTitle(t *testing.T) {
	season3 := []string{"Tensei Kizoku, Kantei Skill de Nariagaru 3rd Season"}
	season1 := []string{"Tensei Kizoku, Kantei Skill de Nariagaru", "As a Reincarnated Aristocrat, I'll Use My Appraisal Skill to Rise in the World"}
	frieren := []string{"Frieren: Beyond Journey's End", "Sousou no Frieren"}

	cases := []struct {
		release string
		names   []string
		want    bool
	}{
		// Real AniLiberty names from Jackett, 06.10.2026.
		{"Перерождение в аристократа со способностью анализа 3 / E01-E02 Tensei Kizoku, Kantei Skill de Nariagaru 3rd Season - AniLiberty.TOP [WEB-DL 1080p][HEVC][1-2]", season3, true},
		{"О моём перерождении в меч 2 / E01 Tensei Shitara Ken Deshita 2nd Season - AniLiberty.TOP [WEB-DL 1080p][HEVC][1]", season3, false},
		{"Тёмное прошлое перевоплощённой злодейки / E01-E12 Tensei Akujo no Kuro Rekishi - AniLiberty.TOP [WEBRip 1080p][HEVC][1-12]", season3, false},
		{"Перерождение в аристократа со способностью анализа 2 / E01-E12 Tensei Kizoku, Kantei Skill de Nariagaru 2nd Season - AniLiberty.TOP [WEB-DL 1080p][HEVC][1-12]", season3, false},

		// The first season's name sits inside every sequel's.
		{"Перерождение в аристократа со способностью анализа / E01-E12 Tensei Kizoku, Kantei Skill de Nariagaru - AniLiberty.TOP [WEBRip 1080p][HEVC][1-12]", season1, true},
		{"Перерождение в аристократа со способностью анализа 3 / E01-E02 Tensei Kizoku, Kantei Skill de Nariagaru 3rd Season - AniLiberty.TOP [WEB-DL 1080p][HEVC][1-2]", season1, false},
		{"[Group] Tensei Kizoku, Kantei Skill de Nariagaru S2 - 05 [1080p]", season1, false},

		{"[SubsPlease] Sousou no Frieren - 13 (1080p)", frieren, true},
		{"Frieren - Beyond Journey's End S01E07 1080p WEB H.264", frieren, true},
		{"[SubsPlease] Sousou no Frieren 2 - 05 (1080p)", frieren, false},
		{"[SubsPlease] Sousou no Frierenx - 05 (1080p)", frieren, false},
		{"Anything at all", nil, false},
	}

	for _, tc := range cases {
		if got := namesTitle(tc.release, tc.names); got != tc.want {
			t.Errorf("namesTitle(%q, %v) = %v, want %v", tc.release, tc.names, got, tc.want)
		}
	}
}

func TestNamesAnotherSeason(t *testing.T) {
	frieren := []string{"Frieren: Beyond Journey's End", "Sousou no Frieren"}
	frieren2 := []string{"Frieren: Beyond Journey's End Season 2", "Sousou no Frieren 2nd Season"}
	solo := []string{"Ore dake Level Up na Ken", "Solo Leveling"}

	cases := []struct {
		release string
		names   []string
		want    bool
	}{
		// Real AniLiberty names, 23.10.2026.
		{"Sousou no Frieren 2nd Season - AniLiberty.TOP [WEB-DL 1080p][HEVC][1-10]", frieren, true},
		{"Sousou no Frieren - AniLiberty.TOP [WEBRip 1080p][HEVC][1-28]", frieren, false},
		{"Sousou no Frieren 2nd Season - AniLiberty.TOP [WEB-DL 1080p][HEVC][1-10]", frieren2, false},
		{"Ore dake Level Up na Ken Season 2- Arise from the Shadow - AniLiberty.TOP [WEBRip 1080p][AVC][1-13]", solo, true},
		{"Ore dake Level Up na Ken - AniLiberty.TOP [WEBRip 1080p][AVC][1-12]", solo, false},

		{"[SubsPlease] Sousou no Frieren S2 - 05 (1080p)", frieren, true},
		{"[Group] Sousou no Frieren II - 05", frieren, true},
		// The first season named as such is the title itself.
		{"Sousou no Frieren S01 1080p WEB", frieren, false},
		{"Sousou no Frieren Season 1 [1080p]", frieren, false},
		{"Frieren - Beyond Journey's End S01E07 1080p WEB H.264", frieren, false},
		// A bare number is as often the episode.
		{"Sousou.no.Frieren.05.1080p", frieren, false},
		// Nothing of the title's names: not for this check to say.
		{"[Erai-raws] Frieren - 01 ~ 28 [1080p][Batch]", frieren, false},
		{"Sousou no Frieren 2nd Season - 05", nil, false},
	}

	for _, tc := range cases {
		if got := namesAnotherSeason(tc.release, tc.names); got != tc.want {
			t.Errorf("namesAnotherSeason(%q, %v) = %v, want %v", tc.release, tc.names, got, tc.want)
		}
	}
}
