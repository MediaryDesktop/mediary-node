package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/openlibrary"
)

const (
	ProviderOpenLibrary = "openlibrary"

	MediaTypeBook = "book"
)

const (
	// A title page asks again after a day. Open Library's data is openly
	// licensed and its terms set no limit on keeping it, so what is older still
	// names the books on the user's own list, offline too, until the ceiling.
	bookMaxAge  = 24 * time.Hour
	bookCeiling = 150 * 24 * time.Hour

	// Bump when cachedBook changes shape.
	bookCacheVersion = 1

	bookPerPage = 20
	bookMaxPage = 50

	// Browsing needs some query, and one rating keeps out records nobody reads.
	browseFloor = "ratings_count:[1 TO *]"
	// A best-rated list over a handful of ratings is noise.
	ratedFloor = "ratings_count:[100 TO *]"
)

// bookGenres turn Open Library's free-form subjects into a short vocabulary: a
// subject belongs to a genre when it holds one of the words and none of the
// exclusions. The first word is what a search asks Open Library for.
type bookGenre struct {
	name     string
	words    []string
	excluded []string
}

var bookGenres = []bookGenre{
	{name: "Fantasy", words: []string{"fantasy"}},
	{name: "Science fiction", words: []string{"science fiction", "sci fi"}},
	{name: "Mystery", words: []string{"mystery", "detective"}},
	{name: "Thriller", words: []string{"thriller", "suspense"}},
	{name: "Horror", words: []string{"horror"}},
	{name: "Romance", words: []string{"romance", "love stories"}},
	{name: "Historical fiction", words: []string{"historical fiction"}},
	{name: "Young adult", words: []string{"young adult"}},
	{name: "Children's", words: []string{"juvenile fiction", "children's"}},
	{name: "Classics", words: []string{"classic"}},
	{name: "Poetry", words: []string{"poetry"}},
	{name: "Drama", words: []string{"drama", "plays"}},
	{name: "Humor", words: []string{"humor", "humorous"}},
	{name: "Comics", words: []string{"comic", "graphic novel"}},
	{name: "Biography", words: []string{"biography", "autobiography", "memoir"}},
	{name: "History", words: []string{"history"}, excluded: []string{"fiction"}},
	{name: "Philosophy", words: []string{"philosophy"}},
	{name: "Psychology", words: []string{"psychology"}},
	{name: "Self-help", words: []string{"self help"}},
	{name: "Business", words: []string{"business", "economics"}},
	{name: "Science", words: []string{"science"}, excluded: []string{"fiction"}},
}

type cachedBook struct {
	Version int          `json:"version"`
	Details MediaDetails `json:"details"`
}

func bookMediaRef(workID string) string {
	return ProviderOpenLibrary + ":" + workID
}

func (s *Service) openLibrary() (*openlibrary.Client, error) {
	if s.opts.OpenLibrary == nil {
		return nil, apperr.New(apperr.KindPrecondition, "Open Library is turned off on this node")
	}

	return s.opts.OpenLibrary, nil
}

func (s *Service) bookDetails(ctx context.Context, workID string) (*MediaDetails, error) {
	client, err := s.openLibrary()
	if err != nil {
		return nil, err
	}

	key := "work:" + workID
	now := s.opts.Now()

	cached, err := s.store.Get(ctx, ProviderOpenLibrary, key)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read media cache")
	}

	if cached != nil && now.Sub(cached.FetchedAt) < bookMaxAge {
		if details := decodeCachedBook(cached.Payload); details != nil {
			return details, nil
		}
	}

	work, err := client.Work(ctx, workID)
	if err != nil {
		return nil, err
	}

	// The work names its authors only by key; the search index has their names,
	// the page count and the rating. Without it the page still stands.
	doc, docErr := client.WorkDoc(ctx, workID)
	if docErr != nil {
		s.logger.Warn().Err(docErr).Str("work", workID).Msg("open library search entry is unavailable")
		doc = &openlibrary.Doc{}
	}

	details := detailsFromOpenLibrary(workID, work, doc, now)

	payload, err := json.Marshal(cachedBook{Version: bookCacheVersion, Details: details})
	if err == nil {
		if putErr := s.store.Put(ctx, ProviderOpenLibrary, key, payload, now); putErr != nil {
			s.logger.Warn().Err(putErr).Msg("store open library details")
		}
	}

	if purgeErr := s.store.PurgeOlderThan(ctx, ProviderOpenLibrary, now.Add(-bookCeiling)); purgeErr != nil {
		s.logger.Warn().Err(purgeErr).Msg("purge expired open library cache")
	}

	return &details, nil
}

func decodeCachedBook(payload []byte) *MediaDetails {
	var entry cachedBook
	if err := json.Unmarshal(payload, &entry); err != nil || entry.Version != bookCacheVersion {
		return nil
	}

	return &entry.Details
}

func (s *Service) searchBooks(ctx context.Context, params SearchParams) (*SearchPage, error) {
	client, err := s.openLibrary()
	if err != nil {
		return nil, err
	}

	page := max(params.Page, 1)
	if page > bookMaxPage {
		return nil, apperr.Invalid("page", "Open Library serves at most %d pages here", bookMaxPage)
	}

	query, sort, err := bookQuery(params)
	if err != nil {
		return nil, err
	}

	result, err := client.Search(ctx, openlibrary.SearchParams{Query: query, Sort: sort, Page: page, Limit: bookPerPage})

	// Google Books stands in for a text search Open Library has nothing for, or
	// cannot answer. Only for a plain one: its filters are not Open Library's.
	if s.opts.GoogleBooks != nil && plainTextSearch(params) && (err != nil || result.NumFound == 0) {
		found, googleErr := s.searchGoogleBooks(ctx, strings.TrimSpace(params.Query), page)
		if googleErr == nil && len(found.Items) > 0 {
			return found, nil
		}

		s.logger.Debug().Err(googleErr).Msg("google books search failed")
	}

	if err != nil {
		return nil, err
	}

	items := make([]MediaSummary, 0, len(result.Docs))
	for i := range result.Docs {
		items = append(items, summaryFromOpenLibrary(&result.Docs[i]))
	}

	return &SearchPage{
		Items:       items,
		Page:        page,
		PerPage:     bookPerPage,
		Total:       result.NumFound,
		HasNextPage: page*bookPerPage < result.NumFound && page < bookMaxPage,
	}, nil
}

func plainTextSearch(params SearchParams) bool {
	return strings.TrimSpace(params.Query) != "" && len(params.Genres) == 0 && params.Year == 0 && params.MinScore == 0
}

// bookQuery builds Open Library's query: the text, then every filter as a field
// clause of the same query. Without text it browses, which Open Library allows
// only with some clause, so a floor of one rating stands in.
func bookQuery(params SearchParams) (query, sort string, err error) {
	var clauses []string

	text := strings.TrimSpace(params.Query)
	if text != "" {
		clauses = append(clauses, text)
	}

	for _, name := range params.Genres {
		at := slices.IndexFunc(bookGenres, func(genre bookGenre) bool { return strings.EqualFold(genre.name, name) })
		if at < 0 {
			return "", "", apperr.Invalid("genres", "no book genre %q", name)
		}

		clauses = append(clauses, fmt.Sprintf("subject:%q", bookGenres[at].words[0]))
	}

	if params.Year > 0 {
		clauses = append(clauses, fmt.Sprintf("first_publish_year:%d", params.Year))
	}

	if params.MinScore > 0 {
		clauses = append(clauses, fmt.Sprintf("ratings_average:[%.1f TO *]", float64(params.MinScore)/20))
	}

	switch params.Sort {
	case "SCORE_DESC":
		sort = "rating"
		clauses = append(clauses, ratedFloor)
	case "START_DATE_DESC":
		sort = "new"
	case "FAVOURITES_DESC":
		sort = "want_to_read"
	case "TITLE_ROMAJI":
		sort = "title"
	case "POPULARITY_DESC", "TRENDING_DESC":
		sort = "readinglog"
	case "SEARCH_MATCH":
	default:
		if text == "" {
			sort = "readinglog"
		}
	}

	if text == "" {
		clauses = append(clauses, browseFloor)
	}

	return strings.Join(clauses, " "), sort, nil
}

func (s *Service) bookFilterOptions() *FilterOptions {
	options := &FilterOptions{Genres: make([]string, 0, len(bookGenres)), Tags: []FilterTag{}, FetchedAt: s.opts.Now().UTC()}

	for _, genre := range bookGenres {
		options.Genres = append(options.Genres, genre.name)
	}

	return options
}

var separators = regexp.MustCompile(`[-_/]+`)

// genresFromSubjects names the genres a book's subjects point at, each once, in
// the vocabulary's order.
func genresFromSubjects(subjects ...[]string) []string {
	matched := map[string]bool{}

	for _, list := range subjects {
		for _, subject := range list {
			normalized := strings.ToLower(separators.ReplaceAllString(subject, " "))

			for _, genre := range bookGenres {
				if matched[genre.name] || !containsAny(normalized, genre.words) || containsAny(normalized, genre.excluded) {
					continue
				}

				matched[genre.name] = true
			}
		}
	}

	genres := []string{}
	for _, genre := range bookGenres {
		if matched[genre.name] {
			genres = append(genres, genre.name)
		}
	}

	return genres
}

func containsAny(text string, words []string) bool {
	for _, word := range words {
		if strings.Contains(text, word) {
			return true
		}
	}

	return false
}

var (
	// "----------" starts the list of other editions or sources some
	// descriptions trail with; "[1]: https://…" is a markdown link target.
	descriptionRule  = regexp.MustCompile(`(?m)^\s*-{3,}\s*$`)
	linkTargets      = regexp.MustCompile(`(?m)^\s*\[\d+\]:\s*\S+\s*$`)
	inlineReferences = regexp.MustCompile(`\s*\(\[[^\]]*\]\[\d+\]\)`)
)

// bookDescription keeps the description and drops what Open Library's editors
// append to it: the list of other editions and markdown reference links.
func bookDescription(raw string) string {
	text := strings.ReplaceAll(raw, "\r\n", "\n")

	if loc := descriptionRule.FindStringIndex(text); loc != nil {
		text = text[:loc[0]]
	}

	text = linkTargets.ReplaceAllString(text, "")
	text = inlineReferences.ReplaceAllString(text, "")
	text = blankLineRuns.ReplaceAllString(text, "\n\n")

	return strings.TrimSpace(text)
}

func detailsFromOpenLibrary(workID string, work *openlibrary.Work, doc *openlibrary.Doc, fetchedAt time.Time) MediaDetails {
	format := "BOOK"
	title := firstNonBlank(work.Title, doc.Title)

	cover := doc.CoverID
	if len(work.Covers) > 0 && work.Covers[0] > 0 {
		cover = &work.Covers[0]
	}

	details := MediaDetails{
		MediaRef:        bookMediaRef(workID),
		MediaType:       MediaTypeBook,
		Format:          &format,
		Title:           TitleNames{UserPreferred: nonEmpty(title), English: nonEmpty(title)},
		Synonyms:        []string{},
		Description:     bookDescription(string(work.Description)),
		CoverImage:      openlibrary.CoverURL(cover, "L"),
		SeasonYear:      doc.FirstPublishYear,
		StartDate:       FuzzyDate{Year: doc.FirstPublishYear},
		AverageScore:    bookScore(doc),
		Genres:          genresFromSubjects(work.Subjects, doc.Subject),
		Studios:         []string{},
		Authors:         uniqueStrings(doc.AuthorName),
		Pages:           positive(doc.Pages),
		SiteURL:         "https://openlibrary.org/works/" + workID,
		Relations:       []RelatedMedia{},
		Recommendations: []RelatedMedia{},
		Similar:         []RelatedMedia{},
		FetchedAt:       fetchedAt.UTC(),
	}

	if subtitle := nonEmpty(firstNonBlank(work.Subtitle, doc.Subtitle)); subtitle != nil {
		details.Synonyms = append(details.Synonyms, title+": "+*subtitle)
	}

	return details
}

func summaryFromOpenLibrary(doc *openlibrary.Doc) MediaSummary {
	format := "BOOK"

	return MediaSummary{
		MediaRef:     bookMediaRef(doc.WorkID()),
		MediaType:    MediaTypeBook,
		Format:       &format,
		Title:        TitleNames{UserPreferred: nonEmpty(doc.Title), English: nonEmpty(doc.Title)},
		CoverImage:   openlibrary.CoverURL(doc.CoverID, "L"),
		SeasonYear:   doc.FirstPublishYear,
		StartDate:    FuzzyDate{Year: doc.FirstPublishYear},
		AverageScore: bookScore(doc),
		Genres:       genresFromSubjects(doc.Subject),
		Authors:      uniqueStrings(doc.AuthorName),
		Pages:        positive(doc.Pages),
		SiteURL:      "https://openlibrary.org/works/" + doc.WorkID(),
	}
}

// bookScore puts Open Library's 1–5 stars on the 0–100 scale every title uses.
// Without ratings there is no score, not a zero.
func bookScore(doc *openlibrary.Doc) *int {
	if doc.RatingsAverage == nil || doc.RatingsCount == 0 {
		return nil
	}

	score := int(math.Round(*doc.RatingsAverage * 20))

	return &score
}

func uniqueStrings(values []string) []string {
	unique := []string{}

	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" && !slices.Contains(unique, value) {
			unique = append(unique, value)
		}
	}

	return unique
}

func firstNonBlank(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}

	return ""
}
