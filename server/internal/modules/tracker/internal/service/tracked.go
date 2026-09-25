package service

import (
	"context"
)

// TrackedTitle is one entry of the user's collection, reduced to what it takes to
// recognize the title elsewhere in the node.
type TrackedTitle struct {
	MediaRef string
	Titles   []string
	Format   string

	Year *int

	// Episodes the entry has, or chapters for a comic.
	Episodes *int
}

// TrackedTitles lists the user's own collection by title, from the mirror only.
// Whoever matches local files against it has to work offline, and looking at the
// list is not a reason to spend a request on refreshing it.
func (s *Service) TrackedTitles(ctx context.Context, mediaType MediaType) ([]TrackedTitle, error) {
	collection, err := s.mirroredCollection(ctx, mediaType)
	if err != nil {
		return nil, err
	}
	if collection == nil {
		return nil, nil
	}

	titles := make([]TrackedTitle, 0, len(collection.Entries))

	for i := range collection.Entries {
		entry := &collection.Entries[i]

		count := entry.Media.Episodes
		if mediaType == MediaTypeManga {
			count = entry.Media.Chapters
		}

		titles = append(titles, TrackedTitle{
			MediaRef: entry.MediaRef,
			Titles:   spellings(entry.Media.Title),
			Format:   value(entry.Media.Format),
			Year:     entry.Media.SeasonYear,
			Episodes: count,
		})
	}

	return titles, nil
}

// spellings orders the titles by how a release group is likely to write them:
// romaji first, then english, then native. userPreferred is left out — it is one
// of the three under another name.
func spellings(title Title) []string {
	ordered := make([]string, 0, 3)

	for _, spelling := range []*string{title.Romaji, title.English, title.Native} {
		if spelling != nil && *spelling != "" {
			ordered = append(ordered, *spelling)
		}
	}

	return ordered
}

func value(pointer *string) string {
	if pointer == nil {
		return ""
	}

	return *pointer
}
