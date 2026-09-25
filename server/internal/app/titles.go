package app

import (
	"context"
	"fmt"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library"
	"github.com/mediaryorg/mediary-node/server/internal/modules/tracker"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anilist"
)

// titleSource answers the library's "what could this file be" with the user's own
// collection and, when that is not enough, with a search at the source.
//
// It lives here because it is the seam between two modules: the library owns the
// matching, the tracker owns the collection, and neither imports the other. The
// composition root is the one place allowed to know both.
type titleSource struct {
	tracker *tracker.Module
	aniList *anilist.Client
}

const searchCandidates = 15

func (s titleSource) Tracked(ctx context.Context, mediaType string) ([]library.TitleCandidate, error) {
	tracked, err := s.tracker.TrackedTitles(ctx, mediaType)
	if err != nil {
		return nil, fmt.Errorf("read tracked %s titles: %w", mediaType, err)
	}

	candidates := make([]library.TitleCandidate, 0, len(tracked))
	for i := range tracked {
		candidates = append(candidates, library.TitleCandidate{
			MediaRef: tracked[i].MediaRef,
			Titles:   tracked[i].Titles,
			Format:   tracked[i].Format,
			Year:     tracked[i].Year,
			Episodes: tracked[i].Episodes,
		})
	}

	return candidates, nil
}

func (s titleSource) Search(ctx context.Context, query, mediaType string) ([]library.TitleCandidate, error) {
	sourceType := anilist.MediaTypeAnime
	if mediaType == "manga" {
		sourceType = anilist.MediaTypeManga
	}

	// Relevance, not popularity: the node is not browsing, it is identifying one
	// file whose name it already has.
	result, err := s.aniList.Search(ctx, anilist.SearchParams{
		Page:    1,
		PerPage: searchCandidates,
		Search:  query,
		Type:    sourceType,
		Sort:    []string{"SEARCH_MATCH"},
	})
	if err != nil {
		return nil, fmt.Errorf("search %s titles: %w", mediaType, err)
	}

	candidates := make([]library.TitleCandidate, 0, len(result.Media))

	for i := range result.Media {
		media := &result.Media[i]

		count := media.Episodes
		if sourceType == anilist.MediaTypeManga {
			count = media.Chapters
		}

		candidates = append(candidates, library.TitleCandidate{
			MediaRef: fmt.Sprintf("anilist:%d", media.ID),
			Titles:   spellings(media.Title),
			Format:   value(media.Format),
			Year:     media.SeasonYear,
			Episodes: count,
		})
	}

	return candidates, nil
}

// spellings orders the titles the way a release group is likely to write them.
func spellings(title anilist.Titles) []string {
	ordered := make([]string, 0, 4)

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
