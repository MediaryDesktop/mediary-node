package service

import (
	"context"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
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

	// What it takes to show the title rather than only recognize it: the name the
	// user reads everywhere else, the poster they already see in their lists, and
	// the colour behind it while it loads.
	Display    string
	CoverImage *string
	CoverColor *string
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
			MediaRef:   entry.MediaRef,
			Titles:     append(spellings(entry.Media.Title), entry.Media.Synonyms...),
			Format:     value(entry.Media.Format),
			Year:       entry.Media.SeasonYear,
			Episodes:   count,
			Display:    displayTitle(entry.Media.Title),
			CoverImage: entry.Media.CoverImage,
			CoverColor: entry.Media.CoverColor,
		})
	}

	return titles, nil
}

// MarkWatched records that an episode was watched. It is the same path a user's own
// edit takes, deliberately: the rule that progress is never silently lowered — and
// the queue that carries the change while AniList is unreachable — already live
// there, and a second way in would be a second place for them to be forgotten.
func (s *Service) MarkWatched(ctx context.Context, mediaRef string, episode int) error {
	if episode <= 0 {
		return apperr.Invalid("episode", "an episode number starts at 1")
	}

	_, err := s.UpdateEntry(ctx, mediaRef, EntryPatch{Progress: &episode})

	return err
}

// spellings orders the titles by how a release group is likely to write them:
// romaji first, then english, then native. userPreferred is left out — it is one
// of the three under another name. The source's synonyms follow, and they are what
// lets a library named in the user's own language be recognized at all: AniList
// carries those spellings, and nothing else here does.
func spellings(title Title) []string {
	ordered := make([]string, 0, 3)

	for _, spelling := range []*string{title.Romaji, title.English, title.Native} {
		if spelling != nil && *spelling != "" {
			ordered = append(ordered, *spelling)
		}
	}

	return ordered
}

// displayTitle is the spelling the rest of the app shows: the one the user chose
// in their account, falling back the way the source itself does.
func displayTitle(title Title) string {
	for _, spelling := range []*string{title.UserPreferred, title.Romaji, title.English, title.Native} {
		if spelling != nil && *spelling != "" {
			return *spelling
		}
	}

	return ""
}

func value(pointer *string) string {
	if pointer == nil {
		return ""
	}

	return *pointer
}
