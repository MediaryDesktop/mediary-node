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

// mediaTypeForForm maps what the file's name said onto the source that owns that
// kind of media. Books have no source in the node yet, and an extra belongs to no
// title at all, so both are left alone.
func mediaTypeForForm(form string) (string, bool) {
	switch form {
	case "series", "movie", "special":
		return "anime", true
	case "manga":
		return "manga", true
	default:
		return "", false
	}
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
		})
	}

	return converted
}
