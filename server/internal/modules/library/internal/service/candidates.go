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

// TitleSource answers "what could this file be". Tracked comes from the node's own
// mirror and works offline; Search goes to the source over the network.
type TitleSource interface {
	Tracked(ctx context.Context, mediaType string) ([]TitleCandidate, error)
	Search(ctx context.Context, query, mediaType string) ([]TitleCandidate, error)
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
