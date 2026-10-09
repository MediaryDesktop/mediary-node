package service

import (
	"context"
	"encoding/json"
	"math"
	"regexp"
	"strings"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/googlebooks"
)

const ProviderGoogleBooks = "googlebooks"

const (
	// Google's terms allow keeping a copy only as long as it serves the user, so
	// the ceiling is a month rather than Open Library's five: long enough for the
	// user's own list to stay named offline, short of a copy of the catalog.
	googleBookCeiling = 30 * 24 * time.Hour

	// Google answers past the first few pages with the same volumes over again.
	googleBooksMaxPage = 10
)

var paragraphEnd = regexp.MustCompile(`(?i)</p>\s*`)

func googleBookMediaRef(volumeID string) string {
	return ProviderGoogleBooks + ":" + volumeID
}

func (s *Service) googleBooks() (*googlebooks.Client, error) {
	if s.opts.GoogleBooks == nil {
		return nil, apperr.New(apperr.KindPrecondition, "Google Books is turned off on this node")
	}

	return s.opts.GoogleBooks, nil
}

func (s *Service) googleBookDetails(ctx context.Context, volumeID string) (*MediaDetails, error) {
	client, err := s.googleBooks()
	if err != nil {
		return nil, err
	}

	key := "volume:" + volumeID
	now := s.opts.Now()

	cached, err := s.store.Get(ctx, ProviderGoogleBooks, key)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read media cache")
	}

	if cached != nil && now.Sub(cached.FetchedAt) < bookMaxAge {
		if details := decodeCachedBook(cached.Payload); details != nil {
			return details, nil
		}
	}

	volume, err := client.Volume(ctx, volumeID)
	if err != nil {
		if cached != nil {
			if details := decodeCachedBook(cached.Payload); details != nil {
				return details, nil
			}
		}

		return nil, err
	}

	details := detailsFromGoogleBooks(volume, now)

	payload, err := json.Marshal(cachedBook{Version: bookCacheVersion, Details: details})
	if err == nil {
		if putErr := s.store.Put(ctx, ProviderGoogleBooks, key, payload, now); putErr != nil {
			s.logger.Warn().Err(putErr).Msg("store google books details")
		}
	}

	if purgeErr := s.store.PurgeOlderThan(ctx, ProviderGoogleBooks, now.Add(-googleBookCeiling)); purgeErr != nil {
		s.logger.Warn().Err(purgeErr).Msg("purge expired google books cache")
	}

	return &details, nil
}

// searchGoogleBooks answers a text search Open Library had nothing for. Google
// lists every edition apart, so editions of one book on a page are folded into
// the first, which is the one Google ranks highest.
func (s *Service) searchGoogleBooks(ctx context.Context, text string, page int) (*SearchPage, error) {
	client, err := s.googleBooks()
	if err != nil {
		return nil, err
	}

	if page > googleBooksMaxPage {
		return &SearchPage{Items: []MediaSummary{}, Page: page, PerPage: bookPerPage, Sources: []string{ProviderGoogleBooks}}, nil
	}

	result, err := client.Search(ctx, googlebooks.SearchParams{
		Query:      text,
		StartIndex: (page - 1) * bookPerPage,
		MaxResults: bookPerPage,
	})
	if err != nil {
		return nil, err
	}

	items := make([]MediaSummary, 0, len(result.Items))
	seen := map[string]bool{}

	for i := range result.Items {
		volume := &result.Items[i]
		if volume.VolumeInfo.Title == "" || !googlebooks.ValidVolumeID(volume.ID) {
			continue
		}

		edition := editionKey(&volume.VolumeInfo)
		if seen[edition] {
			continue
		}
		seen[edition] = true

		items = append(items, summaryFromGoogleBooks(volume))
	}

	return &SearchPage{
		Items:   items,
		Page:    page,
		PerPage: bookPerPage,
		Total:   result.TotalItems,
		// Google's total is an estimate that shrinks as one pages through it; a
		// full page is the better sign there is another.
		HasNextPage: len(result.Items) == bookPerPage && page < googleBooksMaxPage,
		Sources:     []string{ProviderGoogleBooks},
	}, nil
}

// editionKey is what two editions of one book share: the title and the first
// author, as words.
func editionKey(info *googlebooks.VolumeInfo) string {
	author := ""
	if len(info.Authors) > 0 {
		author = info.Authors[0]
	}

	return strings.Join(strings.FieldsFunc(strings.ToLower(info.Title+" "+author), func(r rune) bool {
		return r == ' ' || r == '.' || r == ',' || r == ':' || r == '-'
	}), " ")
}

func detailsFromGoogleBooks(volume *googlebooks.Volume, fetchedAt time.Time) MediaDetails {
	info := &volume.VolumeInfo
	format := "BOOK"
	description := paragraphEnd.ReplaceAllString(info.Description, "\n\n")

	details := MediaDetails{
		MediaRef:        googleBookMediaRef(volume.ID),
		MediaType:       MediaTypeBook,
		Format:          &format,
		Title:           TitleNames{UserPreferred: nonEmpty(info.Title), English: nonEmpty(info.Title)},
		Synonyms:        []string{},
		Description:     plainDescription(&description),
		CoverImage:      info.ImageLinks.Cover(),
		SeasonYear:      info.Year(),
		StartDate:       FuzzyDate{Year: info.Year()},
		AverageScore:    googleBookScore(info),
		Genres:          genresFromSubjects(info.Categories),
		Studios:         []string{},
		Authors:         uniqueStrings(info.Authors),
		Pages:           positive(info.PageCount),
		SiteURL:         firstNonBlank(info.CanonicalVolumeLink, info.InfoLink),
		Relations:       []RelatedMedia{},
		Recommendations: []RelatedMedia{},
		Similar:         []RelatedMedia{},
		FetchedAt:       fetchedAt.UTC(),
	}

	if info.Subtitle != "" {
		details.Synonyms = append(details.Synonyms, info.Title+": "+info.Subtitle)
	}

	return details
}

func summaryFromGoogleBooks(volume *googlebooks.Volume) MediaSummary {
	info := &volume.VolumeInfo
	format := "BOOK"
	description := paragraphEnd.ReplaceAllString(info.Description, "\n\n")

	return MediaSummary{
		MediaRef:     googleBookMediaRef(volume.ID),
		MediaType:    MediaTypeBook,
		Format:       &format,
		Title:        TitleNames{UserPreferred: nonEmpty(info.Title), English: nonEmpty(info.Title)},
		CoverImage:   info.ImageLinks.Cover(),
		SeasonYear:   info.Year(),
		StartDate:    FuzzyDate{Year: info.Year()},
		AverageScore: googleBookScore(info),
		Genres:       genresFromSubjects(info.Categories),
		Authors:      uniqueStrings(info.Authors),
		Pages:        positive(info.PageCount),
		SiteURL:      firstNonBlank(info.CanonicalVolumeLink, info.InfoLink),
		Description:  plainDescription(&description),
	}
}

// googleBookScore puts Google's 1–5 stars on the 0–100 scale every title uses.
func googleBookScore(info *googlebooks.VolumeInfo) *int {
	if info.AverageRating == nil || info.RatingsCount == 0 {
		return nil
	}

	score := int(math.Round(*info.AverageRating * 20))

	return &score
}

type GoogleBooksSettings struct {
	Enabled   bool   `json:"enabled" doc:"Whether this node reads Google Books at all. Off when the node was started with an empty Google Books endpoint."`
	KeySource string `json:"key_source" enum:"user,build,none" doc:"Which key the node sends: the user's own, the one this build ships with, or none — then books Open Library does not know cannot be found."`
}

func (s *Service) GoogleBooksSettings() (*GoogleBooksSettings, error) {
	if s.opts.GoogleBooks == nil {
		return &GoogleBooksSettings{KeySource: "none"}, nil
	}

	source, err := s.opts.GoogleBooks.Keys().Source()
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read google books api key")
	}

	return &GoogleBooksSettings{Enabled: true, KeySource: string(source)}, nil
}

// SetGoogleBooksKey stores the user's own key after Google has accepted it. An
// empty key forgets it and goes back to the build's.
func (s *Service) SetGoogleBooksKey(ctx context.Context, key string) (*GoogleBooksSettings, error) {
	client, err := s.googleBooks()
	if err != nil {
		return nil, err
	}

	key = strings.TrimSpace(key)

	if key != "" {
		if checkErr := client.Check(ctx, key); checkErr != nil {
			return nil, checkErr
		}
	}

	if err := client.Keys().SetUserKey(key); err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "store google books api key")
	}

	return s.GoogleBooksSettings()
}
