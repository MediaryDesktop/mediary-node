package service

import (
	"context"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/matcher"
)

// TitleCandidate is a title a file could belong to. The library does not know
// which sources exist or how to reach them: the composition root supplies
// something that can answer these two questions.
type TitleCandidate struct {
	MediaRef string

	// Titles the source knows the entry by, most authoritative first.
	Titles []string

	Format string

	Year     *int
	Episodes *int

	CoverImage *string
	CoverColor *string

	// SpansSeasons marks an entry that holds every season of a show, as TMDB's
	// do; AniList keeps one entry per season instead.
	SpansSeasons bool

	// Sequels this candidate's source knows about, one relation hop forward —
	// see matcher.Candidate.Sequels for what the matcher does with them. Only a
	// title that came from Search carries these; the user's own collection does
	// not know its own relations.
	Sequels []RelatedCandidate
}

// RelatedCandidate is enough of a sequel entry for the matcher to score a file
// against it once a season's own text falls short. See matcher.RelatedCandidate.
type RelatedCandidate struct {
	MediaRef string
	Format   string
	Year     *int
	Episodes *int

	CoverImage *string
	CoverColor *string
}

// TitleDescription is a matched title as the library shows it: a name, a poster
// and how many episodes there are. Unlike a candidate it answers "what is this",
// not "what could this be", and it is read from what the node already holds.
type TitleDescription struct {
	MediaRef  string
	MediaType string
	Title     string

	CoverImage *string
	CoverColor *string

	Format   *string
	Episodes *int
}

// TitleSource answers "what could this file be", and — once a file is matched —
// "what is this title". Tracked and Describe come from the node's own mirror and
// its details cache, so they work offline; Search goes to the source over the
// network.
type TitleSource interface {
	Tracked(ctx context.Context, mediaType string) ([]TitleCandidate, error)
	Search(ctx context.Context, query, mediaType string) ([]TitleCandidate, error)

	// Describe answers for the refs it knows and leaves out the rest: a title the
	// node has never fetched is not an error, it is a title with no poster yet.
	Describe(ctx context.Context, mediaRefs []string) ([]TitleDescription, error)
}

// MatchListener is told which titles a scan matched files to that the user's own
// list did not hold — titles the node may know nothing about yet. A TitleSource
// that implements it can fetch what the library will want to show for them.
type MatchListener interface {
	Matched(ctx context.Context, mediaRefs []string)
}

// mediaTypeForForm maps what the file's name said, and what its folder holds,
// onto the media type whose source matches it. A comic is manga wherever it
// lies. Books have no source in the node yet, and an extra belongs to no title at
// all, so both are left alone.
func mediaTypeForForm(form, content string) (string, bool) {
	switch form {
	case "manga":
		return "manga", true
	case "series", "movie", "special":
	default:
		return "", false
	}

	if content != ContentMoviesAndShows {
		return "anime", true
	}

	// A special of a live-action show is filed with the show; TMDB keeps no
	// separate entry for it.
	if form == "movie" {
		return "movie", true
	}

	return "series", true
}

func candidates(source []TitleCandidate, tracked bool) []matcher.Candidate {
	converted := make([]matcher.Candidate, 0, len(source))

	for i := range source {
		converted = append(converted, matcher.Candidate{
			MediaRef: source[i].MediaRef,
			Titles:   source[i].Titles,
			Format:   source[i].Format,
			Year:     source[i].Year,
			Episodes: source[i].Episodes,
			Tracked:  tracked,
			Sequels:  sequels(source[i].Sequels),

			SpansSeasons: source[i].SpansSeasons,
		})
	}

	return converted
}

type poster struct {
	image *string
	color *string
}

// postersByRef keeps the posters out of the matcher, which has no use for them:
// a suggestion looks its own up by ref once ranking is done. Sequels are
// included because a ranked candidate can be a sequel the search only reached
// through a relation.
func postersByRef(sources ...[]TitleCandidate) map[string]poster {
	posters := make(map[string]poster)

	keep := func(ref string, image, color *string) {
		if posters[ref].image == nil {
			posters[ref] = poster{image: image, color: color}
		}
	}

	for _, source := range sources {
		for i := range source {
			keep(source[i].MediaRef, source[i].CoverImage, source[i].CoverColor)

			for _, related := range source[i].Sequels {
				keep(related.MediaRef, related.CoverImage, related.CoverColor)
			}
		}
	}

	return posters
}

func sequels(source []RelatedCandidate) []matcher.RelatedCandidate {
	if len(source) == 0 {
		return nil
	}

	converted := make([]matcher.RelatedCandidate, 0, len(source))

	for _, related := range source {
		converted = append(converted, matcher.RelatedCandidate{
			MediaRef: related.MediaRef,
			Format:   related.Format,
			Year:     related.Year,
			Episodes: related.Episodes,
		})
	}

	return converted
}
