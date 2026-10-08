package matcher

import "testing"

func number(value int) *int { return &value }

// The candidates below carry the titles, formats, years and episode counts
// AniList actually lists for these entries.
var (
	frieren = Candidate{
		MediaRef: "anilist:154587",
		Titles:   []string{"Sousou no Frieren", "Frieren: Beyond Journey's End", "葬送のフリーレン"},
		Format:   "TV", Year: number(2023), Episodes: number(28),
	}
	jujutsuS1 = Candidate{
		MediaRef: "anilist:113415",
		Titles:   []string{"Jujutsu Kaisen", "Jujutsu Kaisen", "呪術廻戦"},
		Format:   "TV", Year: number(2020), Episodes: number(24),
	}
	jujutsuS2 = Candidate{
		MediaRef: "anilist:145064",
		Titles:   []string{"Jujutsu Kaisen 2nd Season", "Jujutsu Kaisen Season 2", "呪術廻戦 第2期"},
		Format:   "TV", Year: number(2023), Episodes: number(23),
	}
	attackOnTitan = Candidate{
		MediaRef: "anilist:16498",
		Titles:   []string{"Shingeki no Kyojin", "Attack on Titan", "進撃の巨人"},
		Format:   "TV", Year: number(2013), Episodes: number(25),
	}
	onePiece = Candidate{
		MediaRef: "anilist:21",
		Titles:   []string{"One Piece", "One Piece", "ONE PIECE"},
		Format:   "TV", Year: number(1999), Episodes: number(0),
	}
	spiritedAway = Candidate{
		MediaRef: "anilist:199",
		Titles:   []string{"Sen to Chihiro no Kamikakushi", "Spirited Away", "千と千尋の神隠し"},
		Format:   "MOVIE", Year: number(2001), Episodes: number(1),
	}
	berserk = Candidate{
		MediaRef: "anilist:30002",
		Titles:   []string{"Berserk", "Berserk", "ベルセルク"},
		Format:   "MANGA",
	}
	berserkOfGluttony = Candidate{
		MediaRef: "anilist:101625",
		Titles: []string{
			"Boushoku no Berserk: Ore Dake Level to Iu Gainen wo Toppa Suru THE COMIC",
			"Berserk of Gluttony",
		},
		Format: "MANGA",
	}
	bocchi = Candidate{
		MediaRef: "anilist:130003",
		Titles:   []string{"Bocchi the Rock!", "BOCCHI THE ROCK!", "ぼっち・ざ・ろっく！"},
		Format:   "TV", Year: number(2022), Episodes: number(12),
	}

	// The Russian synonym below is AniList's own — added to the first season's
	// entry only, same as it would be the day the second season airs and no one
	// has gotten around to the sequel's entry yet.
	kimetsuS1 = Candidate{
		MediaRef: "anilist:101922",
		Titles: []string{
			"Kimetsu no Yaiba", "Demon Slayer: Kimetsu no Yaiba", "鬼滅の刃",
			"Клинок, рассекающий демонов",
		},
		Format: "TV", Year: number(2019), Episodes: number(26),
		Sequels: []RelatedCandidate{
			{MediaRef: "anilist:112151", Format: "TV", Year: number(2021), Episodes: number(11)},
		},
	}
)

func bestOf(t *testing.T, file File, candidates ...Candidate) Scored {
	t.Helper()

	ranked := Rank(file, candidates)
	if len(ranked) == 0 {
		t.Fatal("ranking is empty")
	}

	return ranked[0]
}

func TestRankPicksTheObviousTitle(t *testing.T) {
	best := bestOf(t,
		File{Title: "Sousou no Frieren", Form: "series", Episode: number(1)},
		jujutsuS1, frieren, bocchi,
	)

	if best.Candidate.MediaRef != frieren.MediaRef {
		t.Fatalf("picked %s, want Frieren", best.Candidate.MediaRef)
	}
	if best.Confidence < AutoThreshold {
		t.Errorf("confidence = %.2f, want at least %.2f so the node matches it on its own", best.Confidence, AutoThreshold)
	}
}

// The classic failure of a media server: episodes of a second season filed under
// the first season's entry.
func TestRankSeparatesSeasons(t *testing.T) {
	second := bestOf(t,
		File{Title: "Jujutsu Kaisen", Form: "series", Season: number(2), Episode: number(5), Year: number(2023)},
		jujutsuS1, jujutsuS2,
	)
	if second.Candidate.MediaRef != jujutsuS2.MediaRef {
		t.Errorf("season 2 file matched %s, want the second season entry", second.Candidate.MediaRef)
	}

	first := bestOf(t,
		File{Title: "Jujutsu Kaisen", Form: "series", Episode: number(3), Year: number(2020)},
		jujutsuS1, jujutsuS2,
	)
	if first.Candidate.MediaRef != jujutsuS1.MediaRef {
		t.Errorf("unnumbered file matched %s, want the first season entry", first.Candidate.MediaRef)
	}
}

// The file names a season the entry does not cover. Scoring it as a perfect match
// is how a library ends up filed under the wrong entry without anyone being asked.
func TestRankWillNotMatchASeasonTheEntryDoesNotName(t *testing.T) {
	best := bestOf(t,
		File{Title: "Shingeki no Kyojin Final Season", Form: "series", Episode: number(5)},
		attackOnTitan,
	)

	if best.Confidence >= AutoThreshold {
		t.Errorf("confidence = %.2f for a season the entry does not name, want it below %.2f",
			best.Confidence, AutoThreshold)
	}
}

// A file named exactly after the entry's english title must match it, even when
// one word is spelled without its apostrophe.
func TestRankMatchesADifferentSpellingOfTheSameTitle(t *testing.T) {
	best := bestOf(t,
		File{Title: "Frieren Beyond Journeys End", Form: "series", Episode: number(2)},
		frieren, bocchi,
	)

	if best.Candidate.MediaRef != frieren.MediaRef || best.Confidence < AutoThreshold {
		t.Errorf("picked %s at %.2f, want Frieren at %.2f or more",
			best.Candidate.MediaRef, best.Confidence, AutoThreshold)
	}
}

func TestRankMatchesOnTheEnglishTitle(t *testing.T) {
	best := bestOf(t,
		File{Title: "Attack on Titan", Form: "series", Episode: number(1)},
		frieren, attackOnTitan, onePiece,
	)

	if best.Candidate.MediaRef != attackOnTitan.MediaRef {
		t.Fatalf("picked %s, want Attack on Titan matched through its english title", best.Candidate.MediaRef)
	}
	if best.Confidence < AutoThreshold {
		t.Errorf("confidence = %.2f, want at least %.2f", best.Confidence, AutoThreshold)
	}
}

func TestRankUsesTheFormat(t *testing.T) {
	best := bestOf(t,
		File{Title: "Spirited Away", Form: "movie", Year: number(2001)},
		spiritedAway, frieren,
	)

	if best.Candidate.MediaRef != spiritedAway.MediaRef {
		t.Fatalf("picked %s, want the film", best.Candidate.MediaRef)
	}
	if best.Confidence < AutoThreshold {
		t.Errorf("confidence = %.2f, want at least %.2f", best.Confidence, AutoThreshold)
	}
}

// Found against the live source: a chapter of "Berserk" went to "Berserk of
// Gluttony", which merely contains the word. An entry that says more than the file
// does is the weaker answer, and on an equal score the source's own relevance
// order decides — not whichever identifier sorts first.
func TestRankPrefersTheEntryThatSaysNoMoreThanTheFile(t *testing.T) {
	file := File{Title: "Berserk", Form: "manga", Episode: number(1)}

	ranked := Rank(file, []Candidate{berserkOfGluttony, berserk})
	if ranked[0].Candidate.MediaRef != berserk.MediaRef {
		t.Fatalf("picked %s, want Berserk itself", ranked[0].Candidate.MediaRef)
	}
	if ranked[0].Confidence <= ranked[1].Confidence {
		t.Errorf("Berserk scored %.3f against %.3f for Berserk of Gluttony, want a clear win",
			ranked[0].Confidence, ranked[1].Confidence)
	}
}

// A file whose title is a fragment of a real one must not be matched silently:
// "One" is not "One Piece".
func TestRankLeavesAFragmentBelowTheThreshold(t *testing.T) {
	best := bestOf(t, File{Title: "One", Form: "series", Episode: number(1)}, onePiece, frieren)

	if best.Confidence >= AutoThreshold {
		t.Errorf("confidence = %.2f for a one-word fragment, want it below %.2f so the user confirms",
			best.Confidence, AutoThreshold)
	}
}

func TestRankRejectsAnUnrelatedTitle(t *testing.T) {
	best := bestOf(t,
		File{Title: "Holiday Footage 2019", Form: "movie", Year: number(2019)},
		frieren, onePiece, spiritedAway,
	)

	if best.Confidence >= 0.5 {
		t.Errorf("confidence = %.2f for an unrelated file, want it low", best.Confidence)
	}
}

// The user's own list is where a file most often belongs, so it breaks a tie —
// but it must not turn a weak guess into an automatic match.
func TestRankPrefersWhatTheUserAlreadyTracks(t *testing.T) {
	tracked := frieren
	tracked.Tracked = true

	sameTitleElsewhere := Candidate{
		MediaRef: "anilist:999999",
		Titles:   []string{"Sousou no Frieren"},
		Format:   "TV", Year: number(2023), Episodes: number(28),
	}

	ranked := Rank(File{Title: "Sousou no Frieren", Form: "series", Episode: number(1)},
		[]Candidate{sameTitleElsewhere, tracked})

	if ranked[0].Candidate.MediaRef != tracked.MediaRef {
		t.Errorf("picked %s, want the entry from the user's own list", ranked[0].Candidate.MediaRef)
	}
}

// Long-running shows are numbered straight through, so a high episode number is
// normal; an episode past the end of a short entry is not.
func TestRankChecksTheEpisodeAgainstTheEntry(t *testing.T) {
	long := bestOf(t, File{Title: "One Piece", Form: "series", Episode: number(1085)}, onePiece)
	if long.Confidence < AutoThreshold {
		t.Errorf("confidence = %.2f for One Piece episode 1085, want it matched: the entry has no episode count",
			long.Confidence)
	}

	short := bestOf(t, File{Title: "Bocchi the Rock!", Form: "series", Episode: number(40)}, bocchi)
	full := bestOf(t, File{Title: "Bocchi the Rock!", Form: "series", Episode: number(4)}, bocchi)

	if short.Confidence >= full.Confidence {
		t.Errorf("episode 40 of a 12 episode entry scored %.2f, not below the %.2f of episode 4",
			short.Confidence, full.Confidence)
	}
}

// A localized synonym the community has only added to the first season's entry
// must still resolve a second season's file to the sequel it is actually named
// after, not fail it over a season number that the matched text never claimed.
func TestRankFollowsASequelForASynonymOnTheEarlierSeason(t *testing.T) {
	file := File{Title: "Клинок, рассекающий демонов", Form: "series", Season: number(2), Episode: number(1), Year: number(2021)}

	second := bestOf(t, file, kimetsuS1)

	if second.Candidate.MediaRef != "anilist:112151" {
		t.Fatalf("picked %s, want the sequel the relation points at", second.Candidate.MediaRef)
	}
	if second.Confidence < AutoThreshold {
		t.Errorf("confidence = %.2f, want at least %.2f", second.Confidence, AutoThreshold)
	}

	// Without the relation the file has nothing but the season 1 entry to score
	// against, and the season mismatch must still hold it below the threshold —
	// proof the win above comes from the sequel, not from relaxed scoring.
	noRelation := kimetsuS1
	noRelation.Sequels = nil

	if plain := bestOf(t, file, noRelation); plain.Confidence >= AutoThreshold {
		t.Errorf("confidence = %.2f without a sequel relation, want it below %.2f", plain.Confidence, AutoThreshold)
	}

	// The relation reaches one season forward, not two: a third season file must
	// not silently land on the second season's entry just because it is the
	// nearest thing with a relation.
	third := bestOf(t, File{Title: "Клинок, рассекающий демонов", Form: "series", Season: number(3), Episode: number(1)}, kimetsuS1)
	if third.Confidence >= AutoThreshold {
		t.Errorf("confidence = %.2f for a season the relation does not reach, want it below %.2f",
			third.Confidence, AutoThreshold)
	}
}

func TestRankReturnsNothingWithoutATitle(t *testing.T) {
	if ranked := Rank(File{Form: "series"}, []Candidate{frieren}); ranked != nil {
		t.Errorf("ranking without a title = %+v, want nothing to rank", ranked)
	}
}

func TestRankIsOrderedAndStable(t *testing.T) {
	file := File{Title: "Jujutsu Kaisen", Form: "series", Episode: number(1)}

	ranked := Rank(file, []Candidate{frieren, jujutsuS2, jujutsuS1, bocchi})
	if len(ranked) != 4 {
		t.Fatalf("ranked %d candidates, want all 4 so the user can pick from them", len(ranked))
	}

	for i := 1; i < len(ranked); i++ {
		if ranked[i-1].Confidence < ranked[i].Confidence {
			t.Fatalf("ranking is not ordered: %.2f before %.2f", ranked[i-1].Confidence, ranked[i].Confidence)
		}
	}
}

// A TMDB show holds every season, so a season 3 file belongs to it as much as a
// season 1 file does — where an AniList entry for season 1 would rightly lose it.
func TestRankMatchesAnyEpisodeOfAShowThatSpansSeasons(t *testing.T) {
	show := Candidate{MediaRef: "tmdb:tv:1396", Titles: []string{"Breaking Bad"}, Format: "TV", SpansSeasons: true}

	best := bestOf(t, File{Title: "Breaking Bad", Form: "series", Season: number(3), Episode: number(7)}, show)

	if best.Confidence < AutoThreshold {
		t.Errorf("confidence = %.2f, want at least %.2f", best.Confidence, AutoThreshold)
	}
}

// "Во все тяжкие" is Breaking Bad's Russian name and the start of a spin-off's.
// Both clear the threshold with room to spare, and the exact name has to win
// rather than whichever the source happened to list first.
func TestRankPrefersTheExactNameWhenBothClearTheTop(t *testing.T) {
	spinOff := Candidate{MediaRef: "tmdb:tv:208208", Titles: []string{"Breaking Bear", "Breaking Bear", "Во все тяжкие: Медведи"}, Format: "TV", SpansSeasons: true}
	show := Candidate{MediaRef: "tmdb:tv:1396", Titles: []string{"Breaking Bad", "Breaking Bad", "Во все тяжкие"}, Format: "TV", SpansSeasons: true}

	best := bestOf(t, File{Title: "Во все тяжкие", Form: "series", Season: number(1), Episode: number(3)}, spinOff, show)

	if best.Candidate.MediaRef != show.MediaRef {
		t.Fatalf("picked %s, want the show whose name is exactly the file's", best.Candidate.MediaRef)
	}
}
