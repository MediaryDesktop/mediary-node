package parser

import (
	"testing"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/scanner"
)

func number(value int) *int { return &value }

type expectation struct {
	relPath string
	kind    scanner.Kind

	form    Form
	title   string
	season  *int
	episode *int
	year    *int
	chapter *int
	volume  *int
}

func TestParseVideoNames(t *testing.T) {
	cases := []expectation{
		{
			relPath: "[SubsPlease] Sousou no Frieren - 01 (1080p) [ABC123].mkv",
			kind:    scanner.KindVideo,
			form:    FormSeries, title: "Sousou no Frieren", episode: number(1),
		},
		{
			relPath: "Jujutsu Kaisen/Season 2/Jujutsu Kaisen S02E05 1080p WEB-DL.mkv",
			kind:    scanner.KindVideo,
			form:    FormSeries, title: "Jujutsu Kaisen", season: number(2), episode: number(5),
		},
		{
			// The title and the season live on the folders, the file carries only
			// the episode — the tidiest layout and the one habari alone cannot do.
			relPath: "Sousou no Frieren/Season 1/- 04 [1080p].mkv",
			kind:    scanner.KindVideo,
			form:    FormSeries, title: "Sousou no Frieren", season: number(1), episode: number(4),
		},
		{
			relPath: "One Piece/One Piece - 1085 [1080p].mkv",
			kind:    scanner.KindVideo,
			form:    FormSeries, title: "One Piece", episode: number(1085),
		},
		{
			relPath: "Movies/Spirited Away (2001) [1080p BluRay x265].mkv",
			kind:    scanner.KindVideo,
			form:    FormMovie, title: "Spirited Away", year: number(2001),
		},
		{
			relPath: "Steins;Gate/Steins;Gate - OVA - 01 [BD 1080p].mkv",
			kind:    scanner.KindVideo,
			form:    FormSpecial, title: "Steins;Gate", episode: number(1),
		},
		{
			// An opening must not keep its number: matched as episode 1 it would
			// mark the first episode watched.
			relPath: "Shingeki no Kyojin/[Erai-raws] Shingeki no Kyojin - NCOP01 [1080p].mkv",
			kind:    scanner.KindVideo,
			form:    FormExtra, title: "Shingeki no Kyojin",
		},
		{
			relPath: "Bocchi the Rock!/Specials/Bocchi the Rock! - 01 [1080p].mkv",
			kind:    scanner.KindVideo,
			form:    FormSpecial, title: "Bocchi the Rock!", episode: number(1),
		},
		{
			relPath: "Cyberpunk Edgerunners/[EMBER] Cyberpunk Edgerunners S01E10 [1080p].mkv",
			kind:    scanner.KindVideo,
			form:    FormSeries, title: "Cyberpunk Edgerunners", season: number(1), episode: number(10),
		},
		{
			relPath: "Anime/Kimetsu no Yaiba/[Judas] Kimetsu no Yaiba - S04E05.mkv",
			kind:    scanner.KindVideo,
			form:    FormSeries, title: "Kimetsu no Yaiba", season: number(4), episode: number(5),
		},
		{
			// The marker must leave the title, or it is searched for as part of it.
			relPath: "[Group] Show Movie [1080p].mkv",
			kind:    scanner.KindVideo,
			form:    FormMovie, title: "Show",
		},
		{
			relPath: "Show - 01v2 [1080p].mkv",
			kind:    scanner.KindVideo,
			form:    FormSeries, title: "Show", episode: number(1),
		},
		{
			relPath: "Show (2019)/S02/Show - 12.mkv",
			kind:    scanner.KindVideo,
			form:    FormSeries, title: "Show", season: number(2), episode: number(12), year: number(2019),
		},
		{
			// A digit is a legitimate part of a title, so it stays: AniList lists
			// the sequel under its own numbered name too.
			relPath: "86 - Eighty Six/86 - Eighty Six - 01.mkv",
			kind:    scanner.KindVideo,
			form:    FormSeries, title: "86 - Eighty Six", episode: number(1),
		},
		{
			// The file names the extra, the folder above names the show.
			relPath: "Anime/Frieren/Extras/behind the scenes.mkv",
			kind:    scanner.KindVideo,
			form:    FormExtra, title: "Frieren",
		},
	}

	cases = append(cases, seasonFolderCases()...)

	for _, want := range cases {
		t.Run(want.relPath, func(t *testing.T) {
			got := Parse(want.relPath, want.kind)

			if got.Form != want.form {
				t.Errorf("form = %q, want %q", got.Form, want.form)
			}
			if got.Title != want.title {
				t.Errorf("title = %q, want %q", got.Title, want.title)
			}
			assertNumber(t, "season", got.Season, want.season)
			assertNumber(t, "episode", got.Episode, want.episode)
			assertNumber(t, "year", got.Year, want.year)
		})
	}
}

// A season folder is named in the user's own language, not in the english release
// groups write in, and the file inside it often carries nothing but its number.
// Reading such a folder as the title is how a whole season ends up searched for as
// "2 сезон".
func seasonFolderCases() []expectation {
	return []expectation{
		{
			relPath: "Клинок, рассекающий демонов/2 сезон/s02e10_720.mp4",
			kind:    scanner.KindVideo,
			form:    FormSeries, title: "Клинок, рассекающий демонов", season: number(2), episode: number(10),
		},
		{
			relPath: "Клинок, рассекающий демонов/Сезон 1/s01e03.mkv",
			kind:    scanner.KindVideo,
			form:    FormSeries, title: "Клинок, рассекающий демонов", season: number(1), episode: number(3),
		},
		{
			relPath: "Attack on Titan/Staffel 2/ep05.mkv",
			kind:    scanner.KindVideo,
			form:    FormSeries, title: "Attack on Titan", season: number(2), episode: number(5),
		},
		{
			// Japanese writes the marker on both sides of the number.
			relPath: "進撃の巨人/第2期/05.mkv",
			kind:    scanner.KindVideo,
			form:    FormSeries, title: "進撃の巨人", season: number(2), episode: number(5),
		},
		{
			// A folder that is only a number, next to one that names the show.
			relPath: "Frieren/2/- 04.mkv",
			kind:    scanner.KindVideo,
			form:    FormSeries, title: "Frieren", season: number(2), episode: number(4),
		},
		{
			// The number belongs to the title here, and no word says otherwise.
			relPath: "Konosuba 2/ep 03.mkv",
			kind:    scanner.KindVideo,
			form:    FormSeries, title: "Konosuba 2", episode: number(3),
		},
		{
			relPath: "Steins;Gate 0/ep 01.mkv",
			kind:    scanner.KindVideo,
			form:    FormSeries, title: "Steins;Gate 0", episode: number(1),
		},
		{
			// Past the ceiling no season exists, so the folder is left alone rather
			// than read as season sixty.
			relPath: "Show/60/- 01.mkv",
			kind:    scanner.KindVideo,
			form:    FormSeries, title: "Show", episode: number(1),
		},
	}
}

func TestParseComicAndBookNames(t *testing.T) {
	cases := []expectation{
		{
			relPath: "Manga/Berserk/Berserk v01 c003.cbz",
			kind:    scanner.KindManga,
			form:    FormManga, title: "Berserk", volume: number(1), chapter: number(3),
		},
		{
			relPath: "Manga/Vinland Saga/Vinland Saga - Chapter 042.cbz",
			kind:    scanner.KindManga,
			form:    FormManga, title: "Vinland Saga", chapter: number(42),
		},
		{
			// No label at all: the trailing number on a comic file is its chapter.
			relPath: "Manga/Chainsaw Man/097.cbz",
			kind:    scanner.KindManga,
			form:    FormManga, title: "Chainsaw Man", chapter: number(97),
		},
		{
			relPath: "Manga/Oyasumi Punpun/Vol. 3 Ch. 25.cbz",
			kind:    scanner.KindManga,
			form:    FormManga, title: "Oyasumi Punpun", volume: number(3), chapter: number(25),
		},
		{
			relPath: "Manga/Berserk/Berserk - c001 (v01) - p000 [Cover].cbz",
			kind:    scanner.KindManga,
			form:    FormManga, title: "Berserk", volume: number(1), chapter: number(1),
		},
		{
			relPath: "Manga/Solo Leveling/Solo Leveling Ch.179.cbz",
			kind:    scanner.KindManga,
			form:    FormManga, title: "Solo Leveling", chapter: number(179),
		},
		{
			// Comics are filed by volume, and the file inside repeats only its
			// chapter — in whatever language the shelf is named.
			relPath: "Manga/Berserk/Том 1/ch001.cbz",
			kind:    scanner.KindManga,
			form:    FormManga, title: "Berserk", volume: number(1), chapter: number(1),
		},
		{
			relPath: "Books/Dune [Frank Herbert].epub",
			kind:    scanner.KindBook,
			form:    FormBook, title: "Dune",
		},
		{
			relPath: "Books/Frank Herbert/Dune.pdf",
			kind:    scanner.KindBook,
			form:    FormBook, title: "Dune",
		},
	}

	for _, want := range cases {
		t.Run(want.relPath, func(t *testing.T) {
			got := Parse(want.relPath, want.kind)

			if got.Form != want.form {
				t.Errorf("form = %q, want %q", got.Form, want.form)
			}
			if got.Title != want.title {
				t.Errorf("title = %q, want %q", got.Title, want.title)
			}
			assertNumber(t, "chapter", got.Chapter, want.chapter)
			assertNumber(t, "volume", got.Volume, want.volume)
		})
	}
}

func TestParseFallsBackToTheFolderTitle(t *testing.T) {
	// "Specials" and "Season 1" are shelves, not titles: the title is further up.
	got := Parse("Sousou no Frieren/Specials/Season 1/- 02.mkv", scanner.KindVideo)

	if got.Title != "Sousou no Frieren" {
		t.Errorf("title = %q, want the title from the folder above the shelves", got.Title)
	}
	if got.Form != FormSpecial {
		t.Errorf("form = %q, want special", got.Form)
	}
}

func TestParseKeepsReleaseDetails(t *testing.T) {
	got := Parse("[SubsPlease] Frieren - 01 (1080p) [ABC].mkv", scanner.KindVideo)

	if got.ReleaseGroup != "SubsPlease" {
		t.Errorf("release group = %q, want SubsPlease", got.ReleaseGroup)
	}
	if got.Resolution != "1080p" {
		t.Errorf("resolution = %q, want 1080p", got.Resolution)
	}
}

func assertNumber(t *testing.T, field string, got, want *int) {
	t.Helper()

	switch {
	case want == nil && got != nil:
		t.Errorf("%s = %d, want none", field, *got)
	case want != nil && got == nil:
		t.Errorf("%s = none, want %d", field, *want)
	case want != nil && got != nil && *got != *want:
		t.Errorf("%s = %d, want %d", field, *got, *want)
	}
}
