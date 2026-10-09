package service

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/media/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anilist"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anizip"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/openlibrary"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/tmdb"
)

const aniListMaxAge = 24 * time.Hour

// Bump when MediaDetails gains a field, so payloads cached by an older build
// are fetched again instead of being served without it for up to a day.
const detailsCacheVersion = 4

type cachedDetails struct {
	Version int          `json:"version"`
	Details MediaDetails `json:"details"`

	// Streaming is kept beside the details rather than in them: the title page
	// never shows it, only the episode list falls back on it.
	Streaming []anilist.StreamingEpisode `json:"streaming,omitempty"`
}

type Options struct {
	AniList *anilist.Client
	AniZip  *anizip.Client

	// TMDB is nil when the node turned it off; movies and shows then have no source.
	TMDB *tmdb.Client

	// OpenLibrary is nil when the node turned it off; books then have no source.
	OpenLibrary *openlibrary.Client

	Now func() time.Time
}

type Service struct {
	store  *store.Store
	logger zerolog.Logger
	opts   Options
}

func New(st *store.Store, logger zerolog.Logger, opts Options) *Service {
	if opts.Now == nil {
		opts.Now = time.Now
	}

	return &Service{store: st, logger: logger, opts: opts}
}

func parseMediaRef(mediaRef string) (int, error) {
	ref, err := parseRef(mediaRef)
	if err != nil {
		return 0, err
	}

	if ref.provider != ProviderAniList {
		return 0, apperr.Invalid("media_ref", "%q is not an AniList title", mediaRef)
	}

	return ref.id, nil
}

func (s *Service) Details(ctx context.Context, mediaRef string) (*MediaDetails, error) {
	ref, err := parseRef(mediaRef)
	if err != nil {
		return nil, err
	}

	if ref.provider == ProviderOpenLibrary {
		return s.bookDetails(ctx, ref.work)
	}

	if ref.provider == ProviderTMDB {
		entry, tmdbErr := s.tmdbTitle(ctx, ref)
		if tmdbErr != nil {
			return nil, tmdbErr
		}

		return &entry.Details, nil
	}

	entry, err := s.details(ctx, mediaRef)
	if err != nil {
		return nil, err
	}

	return &entry.Details, nil
}

func (s *Service) details(ctx context.Context, mediaRef string) (*cachedDetails, error) {
	mediaID, err := parseMediaRef(mediaRef)
	if err != nil {
		return nil, err
	}

	externalID := strconv.Itoa(mediaID)
	now := s.opts.Now()

	cached, err := s.store.Get(ctx, ProviderAniList, externalID)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read media cache")
	}

	if cached != nil && now.Sub(cached.FetchedAt) < aniListMaxAge {
		var entry cachedDetails
		if decodeErr := json.Unmarshal(cached.Payload, &entry); decodeErr == nil && entry.Version == detailsCacheVersion {
			return &entry, nil
		}
	}

	source, err := s.opts.AniList.MediaDetails(ctx, mediaID)
	if err != nil {
		return nil, err
	}

	entry := cachedDetails{
		Version:   detailsCacheVersion,
		Details:   detailsFromAniList(source, now),
		Streaming: source.StreamingEpisodes,
	}

	payload, err := json.Marshal(entry)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "encode media details")
	}

	if putErr := s.store.Put(ctx, ProviderAniList, externalID, payload, now); putErr != nil {
		return nil, apperr.Wrap(putErr, apperr.KindInternal, "store media details")
	}

	if purgeErr := s.store.PurgeOlderThan(ctx, ProviderAniList, now.Add(-aniListMaxAge)); purgeErr != nil {
		s.logger.Warn().Err(purgeErr).Msg("purge expired anilist cache")
	}

	return &entry, nil
}

// CachedDetails returns what the node already holds about a title and never goes
// to the source. It is for the parts of the app that decorate a list — a library
// page naming the titles its files were matched to — where one request per title
// would be a burst the source would rightly throttle, and where a missing poster
// is no reason to fail.
//
// A stale payload is still returned: the age limit exists to keep the details
// page current, and a poster does not go out of date.
func (s *Service) CachedDetails(ctx context.Context, mediaRef string) (*MediaDetails, error) {
	ref, err := parseRef(mediaRef)
	if err != nil {
		return nil, err
	}

	if ref.provider == ProviderOpenLibrary {
		cached, readErr := s.store.Get(ctx, ProviderOpenLibrary, "work:"+ref.work)
		if readErr != nil {
			return nil, apperr.Wrap(readErr, apperr.KindInternal, "read media cache")
		}
		if cached == nil {
			return nil, nil
		}

		return decodeCachedBook(cached.Payload), nil
	}

	if ref.provider == ProviderTMDB {
		cached, readErr := s.store.Get(ctx, ProviderTMDB, ref.cacheKey())
		if readErr != nil {
			return nil, apperr.Wrap(readErr, apperr.KindInternal, "read media cache")
		}
		if cached == nil {
			return nil, nil
		}

		return decodeCachedTMDB(cached.Payload), nil
	}

	cached, err := s.store.Get(ctx, ProviderAniList, strconv.Itoa(ref.id))
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read media cache")
	}
	if cached == nil {
		return nil, nil
	}

	return decodeCachedDetails(cached.Payload), nil
}

// decodeCachedDetails reads a stored payload back. A payload an older build
// wrote, or one that will not decode at all, is a cache miss rather than a
// failure: the caller asked for whatever is on hand.
func decodeCachedDetails(payload []byte) *MediaDetails {
	var entry cachedDetails
	if err := json.Unmarshal(payload, &entry); err != nil || entry.Version != detailsCacheVersion {
		return nil
	}

	return &entry.Details
}

const (
	defaultPerPage = 30
	maxPerPage     = 50

	// AniList answers with at most 5000 titles per query, so paging further
	// returns nothing useful and only spends the request budget.
	maxPage = 5000 / maxPerPage

	filterOptionsCacheKey = "filter-options"

	browseSort = "POPULARITY_DESC"
)

func aniListMediaType(mediaType string) (anilist.MediaType, error) {
	switch mediaType {
	case "anime":
		return anilist.MediaTypeAnime, nil
	case "manga":
		return anilist.MediaTypeManga, nil
	default:
		return "", apperr.Invalid("type", "unknown media type %q", mediaType)
	}
}

// searchSort keeps AniList's own default: relevance while the user is typing,
// popularity while they are only browsing filters.
func searchSort(params SearchParams) []string {
	if params.Sort != "" {
		return []string{params.Sort}
	}

	if params.Query != "" {
		return []string{"SEARCH_MATCH"}
	}

	return []string{browseSort}
}

func (s *Service) Search(ctx context.Context, params SearchParams) (*SearchPage, error) {
	if isTMDBType(params.MediaType) {
		return s.searchTMDB(ctx, params)
	}

	if params.MediaType == MediaTypeBook {
		return s.searchBooks(ctx, params)
	}

	mediaType, err := aniListMediaType(params.MediaType)
	if err != nil {
		return nil, err
	}

	perPage := params.PerPage
	if perPage <= 0 {
		perPage = defaultPerPage
	}
	if perPage > maxPerPage {
		perPage = maxPerPage
	}

	page := params.Page
	if page <= 0 {
		page = 1
	}
	if page > maxPage {
		return nil, apperr.Invalid("page", "anilist serves at most %d pages of this size", maxPage)
	}

	var adult *bool
	if !params.Adult {
		excluded := false
		adult = &excluded
	}

	result, err := s.opts.AniList.Search(ctx, anilist.SearchParams{
		Page:       page,
		PerPage:    perPage,
		Search:     strings.TrimSpace(params.Query),
		Type:       mediaType,
		Sort:       searchSort(params),
		Genres:     params.Genres,
		Tags:       params.Tags,
		Formats:    params.Formats,
		Statuses:   params.Statuses,
		Season:     params.Season,
		SeasonYear: params.Year,
		MinScore:   params.MinScore,
		Adult:      adult,
	})
	if err != nil {
		return nil, err
	}

	items := make([]MediaSummary, 0, len(result.Media))
	for i := range result.Media {
		items = append(items, summaryFromAniList(&result.Media[i]))
	}

	return &SearchPage{
		Items:       items,
		Page:        page,
		PerPage:     perPage,
		Total:       result.PageInfo.Total,
		HasNextPage: result.PageInfo.HasNextPage && page < maxPage,
	}, nil
}

// FilterOptions is the one list the node keeps without a user asking for a
// title: AniList's genre and tag vocabulary, which the filter panel cannot be
// drawn without. It follows the same one-day ceiling as every other AniList
// payload.
func (s *Service) FilterOptions(ctx context.Context, mediaType string) (*FilterOptions, error) {
	if isTMDBType(mediaType) {
		return s.tmdbFilterOptions(ctx, mediaType)
	}

	if mediaType == MediaTypeBook {
		return s.bookFilterOptions(), nil
	}

	now := s.opts.Now()

	cached, err := s.store.Get(ctx, ProviderAniList, filterOptionsCacheKey)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read filter options cache")
	}

	if cached != nil && now.Sub(cached.FetchedAt) < aniListMaxAge {
		var options FilterOptions
		if decodeErr := json.Unmarshal(cached.Payload, &options); decodeErr == nil {
			return &options, nil
		}
	}

	source, err := s.opts.AniList.FilterOptions(ctx)
	if err != nil {
		return nil, err
	}

	options := FilterOptions{
		Genres:    nonNilStrings(source.Genres),
		Tags:      make([]FilterTag, 0, len(source.Tags)),
		FetchedAt: now.UTC(),
	}

	for _, tag := range source.Tags {
		options.Tags = append(options.Tags, FilterTag{Name: tag.Name, Category: tag.Category, IsAdult: tag.IsAdult})
	}

	payload, err := json.Marshal(options)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "encode filter options")
	}

	if putErr := s.store.Put(ctx, ProviderAniList, filterOptionsCacheKey, payload, now); putErr != nil {
		return nil, apperr.Wrap(putErr, apperr.KindInternal, "store filter options")
	}

	return &options, nil
}
