// Package matcher decides which title a scanned file belongs to. It is given the
// file as the parser read it and a set of candidates, and it only ranks them: no
// network, no database, no knowledge of who produced the candidates.
//
// The signals are Seanime's (scanner/matcher.go): normalized titles compared by
// Sørensen–Dice and by token overlap, adjusted by season, year and format
// agreement. The scale is not — Seanime scores in unbounded points, while a
// confidence written to file_match has to mean something on its own, so
// everything here lands in 0..1 and the threshold is a property of that scale.
package matcher

import (
	"cmp"
	"slices"
)

// AutoThreshold is where a guess becomes an automatic match. Below it the file
// stays unmatched and the ranking is offered to the user for confirmation —
// getting it wrong silently costs more than asking.
const AutoThreshold = 0.8

type File struct {
	Title string
	Form  string

	Season  *int
	Year    *int
	Episode *int

	// Authors are who a book file's own metadata says wrote it.
	Authors []string
}

type Candidate struct {
	MediaRef string

	// Titles the source knows the entry by, most authoritative first: romaji and
	// english before native and synonyms.
	Titles []string

	Format string
	Year   *int

	// Episodes the entry has, or chapters for a comic. Used only as a sanity
	// check against the number read off the file.
	Episodes *int

	// Tracked marks a candidate taken from the user's own list. A file most often
	// belongs to something they are already watching.
	Tracked bool

	// Season overrides the number Rank would otherwise read out of this
	// candidate's own title text. Left nil for an ordinary candidate — AniList
	// has no season field, so the text is all there is. Set only on a synthetic
	// candidate produced by withSequelCandidates, where the season is known by
	// construction rather than guessed from a string.
	Season *int

	// Sequels this candidate's source knows about, one relation hop forward.
	// Only a title that came from a source search carries these — see
	// withSequelCandidates for what they are used for.
	Sequels []RelatedCandidate

	// SpansSeasons marks an entry holding every season of a show, as TMDB's do:
	// a season 3 file belongs to it as much as a season 1 file does.
	SpansSeasons bool

	// Authors are who wrote a book entry.
	Authors []string
}

// RelatedCandidate is enough of a sequel entry to score a file against it: its
// own identity and the facts Rank checks structurally. Its titles are not
// included — withSequelCandidates borrows the originating candidate's instead,
// since that is the text that matched the file in the first place.
type RelatedCandidate struct {
	MediaRef string
	Format   string
	Year     *int
	Episodes *int
}

type Scored struct {
	Candidate  Candidate
	Confidence float64

	// raw is the score before it is clamped into 0..1. Two candidates can both
	// clear 1 — an exact name and a longer one that contains it, each with a
	// season and a format that agree — and ranking them by the clamped value would
	// leave the order to chance.
	raw float64
}

// Rank scores every candidate against the file, best first. The caller decides
// what to do with the ranking: store the top one when it clears AutoThreshold,
// or show the first few and let the user pick.
func Rank(file File, candidates []Candidate) []Scored {
	if len(candidates) == 0 {
		return nil
	}

	fileTitle := NormalizeTitle(file.Title)
	if fileTitle.Normalized == "" {
		return nil
	}

	candidates = withSequelCandidates(file, candidates)

	scored := make([]Scored, 0, len(candidates))
	for i := range candidates {
		raw := score(file, fileTitle, &candidates[i])
		scored = append(scored, Scored{
			Candidate:  candidates[i],
			Confidence: clamp(raw),
			raw:        raw,
		})
	}

	// A stable sort is the point: candidates arrive in the source's own relevance
	// order, and on an equal score that order is better evidence than anything
	// else here — certainly better than comparing identifiers, which once put
	// "Berserk of Gluttony" ahead of "Berserk" for having a smaller id.
	slices.SortStableFunc(scored, func(left, right Scored) int {
		if byConfidence := cmp.Compare(right.raw, left.raw); byConfidence != 0 {
			return byConfidence
		}

		// A tie between something the user already tracks and something they do
		// not is not really a tie.
		if left.Candidate.Tracked != right.Candidate.Tracked {
			if left.Candidate.Tracked {
				return -1
			}

			return 1
		}

		return 0
	})

	return scored
}

const (
	// Above this the two strings are the same title spelled differently, so
	// comparing their word counts says nothing.
	nearIdentical = 0.9

	synonymWeight = 0.95

	seasonAgrees    = 0.06
	seasonDisagrees = -0.3

	yearAgrees    = 0.05
	yearDisagrees = -0.2

	formatAgrees    = 0.05
	formatDisagrees = -0.15

	episodeOutOfRange = -0.25

	trackedBonus = 0.05
)

func score(file File, fileTitle Title, candidate *Candidate) float64 {
	best := 0.0

	titles := append(append([]string{}, candidate.Titles...), authorSpellings(candidate)...)

	for i, raw := range titles {
		candidateTitle := NormalizeTitle(raw)
		if candidateTitle.Normalized == "" {
			continue
		}

		similarity := titleSimilarity(fileTitle, candidateTitle)

		// Romaji and english come first and are what a release group writes; a
		// synonym matching is weaker evidence than a main title matching. A book's
		// title written together with its author is not: it names the book and who
		// wrote it, where "Ray Bradbury's Fahrenheit 451" is a study guide.
		if i >= 2 && i < len(candidate.Titles) {
			similarity *= synonymWeight
		}

		similarity += numberingAdjustment(file, candidateTitle, candidate)

		if similarity > best {
			best = similarity
		}
	}

	best += yearAdjustment(file.Year, candidate.Year)
	best += formatAdjustment(file.Form, candidate.Format)
	best += episodeAdjustment(file.Episode, candidate.Episodes)
	best += authorAdjustment(file.Authors, candidate.Authors)
	best += authorNamed(file, fileTitle, candidate.Authors)

	if candidate.Tracked {
		best += trackedBonus
	}

	return best
}

func titleSimilarity(file, candidate Title) float64 {
	if file.Normalized == candidate.Normalized {
		return 1
	}

	fileTokens := significantTokens(file.Tokens)
	candidateTokens := significantTokens(candidate.Tokens)

	dice := diceSimilarity(file.Normalized, candidate.Normalized)

	// Nothing of substance in common: whatever the strings share is punctuation
	// and particles, and a title must not be matched on those.
	if !hasStrongToken(fileTokens, candidateTokens) {
		return dice * 0.5
	}

	shared := sharedTokens(fileTokens, candidateTokens)

	// How much of the file's title the entry accounts for, and how much of the
	// entry's title the file does. Both matter, but not equally: a release name
	// legitimately shortens an official title, while a release name that says more
	// than the entry does is usually pointing at a different entry.
	precision := float64(shared) / float64(len(fileTokens))
	recall := float64(shared) / float64(len(candidateTokens))

	tokenScore := precisionWeighted(precision, recall)
	similarity := max(dice, tokenScore)

	// Words the file has and the candidate has not — "Shingeki no Kyojin Final
	// Season" is not "Shingeki no Kyojin", and "Berserk of Gluttony" is not
	// "Berserk". Sharing most of the letters does not make up for it, so dice is
	// not allowed to rescue the score here; above nearIdentical the two strings
	// are one title spelled two ways and none of this applies.
	if precision < 1 && dice < nearIdentical {
		similarity = tokenScore * precision
	}

	// One short word in common is how "One" ends up matched to "One Piece". It
	// stays a candidate, but not one the node acts on by itself.
	if smallest(fileTokens, candidateTokens) == 1 && shortestToken(fileTokens, candidateTokens) < 4 {
		similarity *= 0.6
	}

	return similarity
}

// precisionWeighted is an F-measure with beta 0.5: matching every word of the file
// counts for about four times as much as matching every word of the entry.
func precisionWeighted(precision, recall float64) float64 {
	if precision+recall == 0 {
		return 0
	}

	const beta2 = 0.25

	return (1 + beta2) * precision * recall / (beta2*precision + recall)
}

// numberingAdjustment compares the season the file claims with the season this
// title stands for. Ordinarily that is read out of the title text itself —
// AniList has no season field, the number is part of the name, and a first
// season is usually left unwritten on both sides. A synthetic sequel candidate
// knows its season by construction instead, and overrides the text.
func numberingAdjustment(file File, candidateTitle Title, owner *Candidate) float64 {
	if owner.SpansSeasons {
		return seasonAgrees
	}

	candidateSeason := orOne(candidateTitle.Season)
	if owner.Season != nil {
		candidateSeason = *owner.Season
	}

	if orOne(file.Season) == candidateSeason {
		return seasonAgrees
	}

	return seasonDisagrees
}

// withSequelCandidates follows a sequel relation when the file names a season
// one past what a candidate's own titles claim. A localized synonym tends to
// land on AniList's earliest season first — the one most people search for and
// add synonyms to — so a season 2 file can score well on text against the
// season 1 entry and still lose on numberingAdjustment alone. The synthetic
// candidate keeps that text, since it is still the best evidence of which show
// this is, but is judged everywhere else — its ref, its format, its episode
// count, its season — as the sequel it actually points at.
func withSequelCandidates(file File, candidates []Candidate) []Candidate {
	if file.Season == nil || *file.Season < 2 {
		return candidates
	}

	expanded := candidates

	for i := range candidates {
		origin := &candidates[i]
		if len(origin.Sequels) == 0 {
			continue
		}

		if bestOwnSeason(origin)+1 != *file.Season {
			continue
		}

		for _, sequel := range origin.Sequels {
			season := *file.Season

			expanded = append(expanded, Candidate{
				MediaRef: sequel.MediaRef,
				Titles:   origin.Titles,
				Format:   sequel.Format,
				Year:     sequel.Year,
				Episodes: sequel.Episodes,
				Tracked:  origin.Tracked,
				Season:   &season,
			})
		}
	}

	return expanded
}

// bestOwnSeason is the season a candidate's own titles claim, read the same way
// numberingAdjustment reads it for an ordinary candidate — the highest one any
// of its titles name, or 1 when none of them say otherwise.
func bestOwnSeason(candidate *Candidate) int {
	season := 1

	for _, raw := range candidate.Titles {
		if found := NormalizeTitle(raw).Season; found != nil && *found > season {
			season = *found
		}
	}

	return season
}

func yearAdjustment(file, candidate *int) float64 {
	if file == nil || candidate == nil {
		return 0
	}

	switch *file - *candidate {
	case 0:
		return yearAgrees
	case 1, -1:
		// A season that starts in autumn and ends in winter is listed under one
		// year and named after the other.
		return 0
	default:
		return yearDisagrees
	}
}

var formatsByForm = map[string]map[string]struct{}{
	"series":  {"TV": {}, "TV_SHORT": {}, "ONA": {}},
	"movie":   {"MOVIE": {}},
	"special": {"SPECIAL": {}, "OVA": {}, "ONA": {}},
	"manga":   {"MANGA": {}, "ONE_SHOT": {}},
	"book":    {"NOVEL": {}, "BOOK": {}},
}

func formatAdjustment(form, format string) float64 {
	if form == "" || format == "" {
		return 0
	}

	expected, known := formatsByForm[form]
	if !known {
		return 0
	}

	if _, ok := expected[format]; ok {
		return formatAgrees
	}

	return formatDisagrees
}

// episodeAdjustment catches the file numbered past the end of the entry: either
// the numbering runs across seasons or this is the wrong entry. Both mean the
// node should not decide on its own.
func episodeAdjustment(episode, episodes *int) float64 {
	if episode == nil || episodes == nil || *episodes == 0 {
		return 0
	}

	if *episode > *episodes {
		return episodeOutOfRange
	}

	return 0
}

func clamp(value float64) float64 {
	if value < 0 {
		return 0
	}
	if value > 1 {
		return 1
	}

	return value
}

func orOne(value *int) int {
	if value == nil {
		return 1
	}

	return *value
}

func smallest(left, right []string) int {
	if len(right) < len(left) {
		return len(right)
	}

	return len(left)
}

func shortestToken(left, right []string) int {
	shortest := 0

	for _, tokens := range [][]string{left, right} {
		for _, token := range tokens {
			length := len([]rune(token))
			if shortest == 0 || length < shortest {
				shortest = length
			}
		}
	}

	return shortest
}
