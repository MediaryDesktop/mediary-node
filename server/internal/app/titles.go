package app

import (
	"context"
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library"
	"github.com/mediaryorg/mediary-node/server/internal/modules/media"
	"github.com/mediaryorg/mediary-node/server/internal/modules/tracker"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anilist"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/googlebooks"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/openlibrary"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/tmdb"
)

// titleSource answers the library's "what could this file be" with the user's own
// collection and, when that is not enough, with a search at the source.
//
// It lives here because it is the seam between two modules: the library owns the
// matching, the tracker owns the collection, and neither imports the other. The
// composition root is the one place allowed to know both.
type titleSource struct {
	tracker *tracker.Module
	media   *media.Module
	aniList *anilist.Client

	// tmdb answers for folders of movies and shows; nil leaves them unmatched.
	tmdb *tmdb.Client

	// openLibrary answers for books, googleBooks for what it does not know; with
	// both nil books stay unmatched.
	openLibrary *openlibrary.Client
	googleBooks *googlebooks.Client
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
			MediaRef:     tracked[i].MediaRef,
			Titles:       tracked[i].Titles,
			Format:       tracked[i].Format,
			Year:         tracked[i].Year,
			Episodes:     tracked[i].Episodes,
			CoverImage:   tracked[i].CoverImage,
			CoverColor:   tracked[i].CoverColor,
			SpansSeasons: strings.HasPrefix(tracked[i].MediaRef, "tmdb:tv:"),
			Authors:      tracked[i].Authors,
		})
	}

	return candidates, nil
}

func (s titleSource) Search(ctx context.Context, query, mediaType string) ([]library.TitleCandidate, error) {
	switch mediaType {
	case "movie":
		return s.searchTMDB(ctx, query, tmdb.KindMovie)
	case "series":
		return s.searchTMDB(ctx, query, tmdb.KindTV)
	case "dorama":
		return s.searchDoramas(ctx, query)
	case "book":
		return s.searchBooks(ctx, query)
	}

	sourceType := anilist.MediaTypeAnime
	if mediaType == "manga" {
		sourceType = anilist.MediaTypeManga
	}

	// Relevance, not popularity: the node is not browsing, it is identifying one
	// file whose name it already has.
	result, err := s.aniList.SearchMatchCandidates(ctx, anilist.SearchParams{
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
		found := &result.Media[i]

		candidates = append(candidates, library.TitleCandidate{
			MediaRef:   fmt.Sprintf("anilist:%d", found.ID),
			Titles:     append(spellings(found.Title), found.Synonyms...),
			Format:     value(found.Format),
			Year:       found.SeasonYear,
			Episodes:   episodeCount(sourceType, found.Episodes, found.Chapters),
			CoverImage: found.CoverImage.Large,
			CoverColor: found.CoverImage.Color,
			Sequels:    sequelsOf(sourceType, found.Relations.Edges),
		})
	}

	return candidates, nil
}

// searchTMDB finds what a folder of movies or shows could hold. TMDB matches a
// name in any language but answers in the one asked for, so a folder named in
// Cyrillic is searched in Ukrainian and Russian too: the names that come back are
// what the folder's name is compared with.
func (s titleSource) searchTMDB(ctx context.Context, query string, kind tmdb.Kind) ([]library.TitleCandidate, error) {
	return s.searchTMDBPreferring(ctx, query, kind, nil)
}

// searchTMDBPreferring is searchTMDB with the results prefer approves of moved
// ahead of the rest, each group in TMDB's own order.
func (s titleSource) searchTMDBPreferring(
	ctx context.Context, query string, kind tmdb.Kind, prefer func(*tmdb.Result) bool,
) ([]library.TitleCandidate, error) {
	if s.tmdb == nil {
		return nil, nil
	}

	languages := []string{"en-US"}
	if !latin(query) {
		languages = append(languages, "uk-UA", "ru-RU")
	}

	var candidates []library.TitleCandidate
	at := map[int]int{}
	preferred := map[int]bool{}

	for _, language := range languages {
		page, err := s.tmdb.Search(ctx, kind, tmdb.SearchParams{Query: query, Page: 1, Language: language})
		if err != nil {
			if len(candidates) == 0 && language == languages[0] {
				return nil, fmt.Errorf("search tmdb %s: %w", kind, err)
			}

			continue
		}

		for i := range page.Results[:min(len(page.Results), searchCandidates)] {
			found := &page.Results[i]
			name, original, date := found.Name, found.OriginalName, found.FirstAirDate
			if kind == tmdb.KindMovie {
				name, original, date = found.Title, found.OriginalTitle, found.ReleaseDate
			}

			if index, seen := at[found.ID]; seen {
				if name != "" && !slices.Contains(candidates[index].Titles, name) {
					candidates[index].Titles = append(candidates[index].Titles, name)
				}

				continue
			}

			at[found.ID] = len(candidates)
			preferred[len(candidates)] = prefer != nil && prefer(found)
			candidates = append(candidates, tmdbCandidate(kind, found, name, original, date))
		}
	}

	if prefer == nil {
		return candidates, nil
	}

	ordered := make([]library.TitleCandidate, 0, len(candidates))
	for _, first := range []bool{true, false} {
		for i := range candidates {
			if preferred[i] == first {
				ordered = append(ordered, candidates[i])
			}
		}
	}

	return ordered, nil
}

// searchDoramas finds what a folder of doramas could hold: TMDB's shows, those
// from East Asia first. The matcher keeps the source's order between equal
// scores, so a dorama wins a tie with a remake of the same name; a show from
// elsewhere is still offered — the folder's type is the user's word, not a
// guarantee.
func (s titleSource) searchDoramas(ctx context.Context, query string) ([]library.TitleCandidate, error) {
	return s.searchTMDBPreferring(ctx, query, tmdb.KindTV, isDorama)
}

func isDorama(found *tmdb.Result) bool {
	return slices.ContainsFunc(found.OriginCountry, func(country string) bool {
		return slices.Contains(media.DoramaCountries, country)
	})
}

func tmdbCandidate(kind tmdb.Kind, found *tmdb.Result, name, original, date string) library.TitleCandidate {
	candidate := library.TitleCandidate{
		MediaRef:     fmt.Sprintf("tmdb:%s:%d", kind, found.ID),
		Format:       "TV",
		CoverImage:   tmdb.ImageURL(found.PosterPath, "w500"),
		SpansSeasons: kind == tmdb.KindTV,
	}

	for _, title := range []string{name, original} {
		if title != "" && !slices.Contains(candidate.Titles, title) {
			candidate.Titles = append(candidate.Titles, title)
		}
	}

	if kind == tmdb.KindMovie {
		one := 1
		candidate.Format = "MOVIE"
		candidate.Episodes = &one
	}

	if year, err := strconv.Atoi(date[:min(len(date), 4)]); err == nil && year > 0 {
		candidate.Year = &year
	}

	return candidate
}

// Matched fetches the details of TMDB and Open Library titles a scan matched
// files to, so the library can name them and show their posters. The scan is the
// user's own action, which is when the node may ask the source. AniList titles
// are left to the title page: its request budget is far smaller, and a first scan
// of a large anime library would spend it all. Open Library answers one request a
// second, so only the first few books of a scan are fetched here.
func (s titleSource) Matched(ctx context.Context, mediaRefs []string) {
	books := 0

	for _, ref := range mediaRefs {
		switch {
		case strings.HasPrefix(ref, "tmdb:"):
		case (strings.HasPrefix(ref, "openlibrary:") || strings.HasPrefix(ref, "googlebooks:")) && books < warmedBooks:
			books++
		default:
			continue
		}

		if cached, err := s.media.Cached(ctx, ref); err == nil && cached != nil {
			continue
		}

		if _, err := s.media.Details(ctx, ref); err != nil && ctx.Err() != nil {
			return
		}
	}
}

// sequelsOf keeps the edges AniList calls a direct sequel — the one hop a
// season's own text falling short can be resolved across, see
// matcher.Candidate.Sequels. Everything else (prequels, side stories, the
// source material) answers a different question than "what season is this".
func sequelsOf(sourceType anilist.MediaType, edges []anilist.MatchRelation) []library.RelatedCandidate {
	var sequels []library.RelatedCandidate

	for _, edge := range edges {
		if edge.RelationType != "SEQUEL" {
			continue
		}

		sequels = append(sequels, library.RelatedCandidate{
			MediaRef:   fmt.Sprintf("anilist:%d", edge.Node.ID),
			Format:     value(edge.Node.Format),
			Year:       edge.Node.SeasonYear,
			Episodes:   episodeCount(sourceType, edge.Node.Episodes, edge.Node.Chapters),
			CoverImage: edge.Node.CoverImage.Large,
			CoverColor: edge.Node.CoverImage.Color,
		})
	}

	return sequels
}

func episodeCount(sourceType anilist.MediaType, episodes, chapters *int) *int {
	if sourceType == anilist.MediaTypeManga {
		return chapters
	}

	return episodes
}

// Describe names the titles a page of matched files belongs to. It reads the
// user's mirrored collection first — most of a library is on it, and the mirror
// answers offline — and falls back to the details the node cached when a title
// page was opened. Neither path goes to the network: a list of a hundred files
// must not become a hundred requests.
func (s titleSource) Describe(ctx context.Context, mediaRefs []string) ([]library.TitleDescription, error) {
	wanted := make(map[string]struct{}, len(mediaRefs))
	for _, ref := range mediaRefs {
		wanted[ref] = struct{}{}
	}

	described := make([]library.TitleDescription, 0, len(mediaRefs))

	for _, mediaType := range []string{"anime", "manga"} {
		if len(wanted) == 0 {
			break
		}

		tracked, err := s.tracker.TrackedTitles(ctx, mediaType)
		if err != nil {
			return nil, fmt.Errorf("read tracked %s titles: %w", mediaType, err)
		}

		for i := range tracked {
			entry := &tracked[i]

			if _, want := wanted[entry.MediaRef]; !want {
				continue
			}

			delete(wanted, entry.MediaRef)

			described = append(described, library.TitleDescription{
				MediaRef:   entry.MediaRef,
				MediaType:  mediaType,
				Title:      firstNonEmpty(entry.Display, entry.Titles...),
				CoverImage: entry.CoverImage,
				CoverColor: entry.CoverColor,
				Format:     optional(entry.Format),
				Episodes:   entry.Episodes,
			})
		}
	}

	for ref := range wanted {
		details, err := s.media.Cached(ctx, ref)

		// A ref the media module cannot even parse belongs to a provider it does
		// not own. That is not a reason to fail the page it appears on.
		if err != nil || details == nil {
			continue
		}

		count := details.Episodes
		if details.MediaType == "manga" {
			count = details.Chapters
		}

		described = append(described, library.TitleDescription{
			MediaRef:   details.MediaRef,
			MediaType:  details.MediaType,
			Title:      firstNonEmpty("", spellings(anilist.Titles(details.Title))...),
			CoverImage: details.CoverImage,
			CoverColor: details.CoverColor,
			Format:     details.Format,
			Episodes:   count,
		})
	}

	return described, nil
}

func firstNonEmpty(preferred string, fallbacks ...string) string {
	if strings.TrimSpace(preferred) != "" {
		return preferred
	}

	for _, spelling := range fallbacks {
		if strings.TrimSpace(spelling) != "" {
			return spelling
		}
	}

	return ""
}

func optional(text string) *string {
	if text == "" {
		return nil
	}

	return &text
}

// spellings orders the titles the way a release group is likely to write them.
// The source's synonyms are appended by the caller: they carry the localized names
// a user's own folders are likely to use, and the matcher weighs them lower than
// the main titles on purpose.
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
