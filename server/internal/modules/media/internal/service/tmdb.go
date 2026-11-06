package service

import (
	"context"
	"encoding/json"
	"math"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/tmdb"
)

const (
	MediaTypeMovie  = "movie"
	MediaTypeSeries = "series"
	MediaTypeDorama = "dorama"
)

const (
	// A title page asks TMDB again after a day, so a show that is airing stays
	// current. What is older still names the titles on the user's own list,
	// offline too, until the ceiling — TMDB's terms allow six months.
	tmdbMaxAge  = 24 * time.Hour
	tmdbCeiling = 150 * 24 * time.Hour

	// Bump when cachedTMDB or cachedTMDBEpisodes changes shape.
	tmdbCacheVersion = 2

	// How many suggestions a title page shows; TMDB returns twenty a page.
	maxSuggestions = 16

	tmdbLanguage = "en-US"
	tmdbPerPage  = 20

	posterSize   = "w500"
	backdropSize = "w1280"
	stillSize    = "w300"

	// A score sort or floor over a handful of votes is noise: one 10 out of 10
	// would outrank every classic.
	scoreSortMinVotes  = 200
	scoreFloorMinVotes = 50

	// TMDB's popularity among shows counts long-running local soaps and sport
	// broadcasts nobody rates; a handful of votes keeps the browse on shows.
	popularShowMinVotes = 50
)

// A show from these countries that is not animation is a dorama. Japanese
// animation is AniList's, so it is never one.
var DoramaCountries = []string{"KR", "CN", "TW", "HK", "JP", "TH"}

type cachedTMDB struct {
	Version int          `json:"version"`
	Details MediaDetails `json:"details"`

	// Seasons are the show's regular season numbers, specials left out, for the
	// episode list to fetch.
	Seasons []int `json:"seasons,omitempty"`
}

type cachedTMDBEpisodes struct {
	Version  int       `json:"version"`
	Episodes []Episode `json:"episodes"`
}

type cachedGenres struct {
	Version int          `json:"version"`
	Genres  []tmdb.Genre `json:"genres"`
}

func isTMDBType(mediaType string) bool {
	return mediaType == MediaTypeMovie || mediaType == MediaTypeSeries || mediaType == MediaTypeDorama
}

func tmdbKind(mediaType string) tmdb.Kind {
	if mediaType == MediaTypeMovie {
		return tmdb.KindMovie
	}

	return tmdb.KindTV
}

func (s *Service) tmdbClient() (*tmdb.Client, error) {
	if s.opts.TMDB == nil {
		return nil, apperr.New(apperr.KindPrecondition, "TMDB is turned off on this node")
	}

	return s.opts.TMDB, nil
}

func (s *Service) tmdbTitle(ctx context.Context, ref titleRef) (*cachedTMDB, error) {
	client, err := s.tmdbClient()
	if err != nil {
		return nil, err
	}

	now := s.opts.Now()

	cached, err := s.store.Get(ctx, ProviderTMDB, ref.cacheKey())
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read media cache")
	}

	if cached != nil && now.Sub(cached.FetchedAt) < tmdbMaxAge {
		var entry cachedTMDB
		if decodeErr := json.Unmarshal(cached.Payload, &entry); decodeErr == nil && entry.Version == tmdbCacheVersion {
			return &entry, nil
		}
	}

	source, err := client.Title(ctx, ref.kind, ref.id, tmdbLanguage)
	if err != nil {
		return nil, err
	}

	entry := cachedTMDB{
		Version: tmdbCacheVersion,
		Details: detailsFromTMDB(ref.kind, source, now),
		Seasons: regularSeasons(source.Seasons),
	}

	// The other films of a series are its relations. Without them the page is
	// still whole, so a failure only leaves the section out.
	if source.Collection != nil {
		collection, collectionErr := client.Collection(ctx, source.Collection.ID, tmdbLanguage)
		if collectionErr != nil {
			s.logger.Warn().Err(collectionErr).Int("collection", source.Collection.ID).Msg("tmdb collection is unavailable")
		} else {
			entry.Details.Relations = collectionRelations(source, collection.Parts)
		}
	}

	s.putTMDB(ctx, ref.cacheKey(), entry, now)

	return &entry, nil
}

// putTMDB caches a TMDB answer and drops whatever is past the ceiling. A failure
// is logged and not returned: the caller already has its answer.
func (s *Service) putTMDB(ctx context.Context, key string, value any, now time.Time) {
	payload, err := json.Marshal(value)
	if err != nil {
		s.logger.Warn().Err(err).Str("key", key).Msg("encode tmdb payload")
		return
	}

	if putErr := s.store.Put(ctx, ProviderTMDB, key, payload, now); putErr != nil {
		s.logger.Warn().Err(putErr).Str("key", key).Msg("store tmdb payload")
	}

	if purgeErr := s.store.PurgeOlderThan(ctx, ProviderTMDB, now.Add(-tmdbCeiling)); purgeErr != nil {
		s.logger.Warn().Err(purgeErr).Msg("purge expired tmdb cache")
	}
}

func decodeCachedTMDB(payload []byte) *MediaDetails {
	var entry cachedTMDB
	if err := json.Unmarshal(payload, &entry); err != nil || entry.Version != tmdbCacheVersion {
		return nil
	}

	return &entry.Details
}

func regularSeasons(seasons []tmdb.SeasonSummary) []int {
	numbers := []int{}

	for _, season := range seasons {
		if season.SeasonNumber > 0 && season.EpisodeCount > 0 {
			numbers = append(numbers, season.SeasonNumber)
		}
	}

	slices.Sort(numbers)

	return slices.Compact(numbers)
}

func (s *Service) searchTMDB(ctx context.Context, params SearchParams) (*SearchPage, error) {
	client, err := s.tmdbClient()
	if err != nil {
		return nil, err
	}

	kind := tmdbKind(params.MediaType)

	page := max(params.Page, 1)
	if page > tmdb.MaxPage {
		return nil, apperr.Invalid("page", "TMDB serves at most %d pages", tmdb.MaxPage)
	}

	genres := s.tmdbGenreNames(ctx, kind)

	var result *tmdb.Page

	if query := strings.TrimSpace(params.Query); query != "" {
		result, err = client.Search(ctx, kind, tmdb.SearchParams{
			Query:    query,
			Page:     page,
			Year:     params.Year,
			Adult:    params.Adult,
			Language: tmdbLanguage,
		})
	} else {
		var discover tmdb.DiscoverParams

		discover, err = s.discoverParams(ctx, kind, params, page)
		if err == nil {
			result, err = client.Discover(ctx, kind, discover)
		}
	}

	if err != nil {
		return nil, err
	}

	items := make([]MediaSummary, 0, len(result.Results))

	for i := range result.Results {
		found := &result.Results[i]

		if ownedByAniList(found.GenreIDs, found.OriginalLanguage) {
			continue
		}

		summary := summaryFromTMDB(kind, found, genres)

		// A text search cannot ask TMDB for doramas only, so the page is narrowed
		// here. Every dorama is also a series, which is why series keeps them.
		if params.MediaType == MediaTypeDorama && summary.MediaType != MediaTypeDorama {
			continue
		}

		items = append(items, summary)
	}

	return &SearchPage{
		Items:       items,
		Page:        page,
		PerPage:     tmdbPerPage,
		Total:       result.TotalResults,
		HasNextPage: page < result.TotalPages && page < tmdb.MaxPage,
	}, nil
}

func (s *Service) discoverParams(ctx context.Context, kind tmdb.Kind, params SearchParams, page int) (tmdb.DiscoverParams, error) {
	discover := tmdb.DiscoverParams{
		Page:     page,
		Year:     params.Year,
		Adult:    params.Adult,
		Language: tmdbLanguage,
		SortBy:   tmdbSort(kind, params.Sort),
	}

	switch params.Sort {
	case "SCORE_DESC":
		discover.MinVoteCount = scoreSortMinVotes
	case "START_DATE_DESC":
		discover.ReleasedBefore = s.opts.Now().UTC().Format(time.DateOnly)
	}

	if params.MinScore > 0 {
		discover.MinVoteAverage = float64(params.MinScore) / 10
		discover.MinVoteCount = max(discover.MinVoteCount, scoreFloorMinVotes)
	}

	if len(params.Genres) > 0 {
		ids, err := s.tmdbGenreIDs(ctx, kind, params.Genres)
		if err != nil {
			return tmdb.DiscoverParams{}, err
		}
		discover.Genres = ids
	}

	if kind == tmdb.KindTV && discover.SortBy == "popularity.desc" {
		discover.MinVoteCount = max(discover.MinVoteCount, popularShowMinVotes)
	}

	if kind == tmdb.KindTV {
		// Talk shows, the news and reality TV top TMDB's popularity; a user who
		// browses shows is looking for something else, unless they asked for one.
		for _, genre := range []int{tmdb.GenreNews, tmdb.GenreReality, tmdb.GenreTalk} {
			if !slices.Contains(discover.Genres, genre) {
				discover.WithoutGenres = append(discover.WithoutGenres, genre)
			}
		}
	}

	if params.MediaType == MediaTypeDorama {
		discover.OriginCountries = DoramaCountries
		discover.WithoutGenres = append(discover.WithoutGenres, tmdb.GenreAnimation)
	}

	return discover, nil
}

// tmdbSort maps the sorts the search offers onto TMDB's. A text search keeps
// TMDB's own relevance order and never reaches here.
func tmdbSort(kind tmdb.Kind, sort string) string {
	date, title := "first_air_date.desc", "name.asc"
	if kind == tmdb.KindMovie {
		date, title = "primary_release_date.desc", "title.asc"
	}

	switch sort {
	case "SCORE_DESC":
		return "vote_average.desc"
	case "FAVOURITES_DESC":
		return "vote_count.desc"
	case "START_DATE_DESC":
		return date
	case "TITLE_ROMAJI":
		return title
	default:
		return "popularity.desc"
	}
}

func (s *Service) tmdbGenres(ctx context.Context, kind tmdb.Kind) ([]tmdb.Genre, error) {
	client, err := s.tmdbClient()
	if err != nil {
		return nil, err
	}

	key := "genres:" + string(kind)
	now := s.opts.Now()

	cached, err := s.store.Get(ctx, ProviderTMDB, key)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read genre cache")
	}

	if cached != nil && now.Sub(cached.FetchedAt) < tmdbMaxAge {
		var entry cachedGenres
		if decodeErr := json.Unmarshal(cached.Payload, &entry); decodeErr == nil && entry.Version == tmdbCacheVersion {
			return entry.Genres, nil
		}
	}

	genres, err := client.Genres(ctx, kind, tmdbLanguage)
	if err != nil {
		return nil, err
	}

	s.putTMDB(ctx, key, cachedGenres{Version: tmdbCacheVersion, Genres: genres}, now)

	return genres, nil
}

// tmdbGenreNames names the genre ids a search result carries. Without the list
// the results are still worth showing, only without their genres.
func (s *Service) tmdbGenreNames(ctx context.Context, kind tmdb.Kind) map[int]string {
	genres, err := s.tmdbGenres(ctx, kind)
	if err != nil {
		s.logger.Warn().Err(err).Str("kind", string(kind)).Msg("tmdb genre list is unavailable")
		return nil
	}

	names := make(map[int]string, len(genres))
	for _, genre := range genres {
		names[genre.ID] = genre.Name
	}

	return names
}

func (s *Service) tmdbGenreIDs(ctx context.Context, kind tmdb.Kind, names []string) ([]int, error) {
	genres, err := s.tmdbGenres(ctx, kind)
	if err != nil {
		return nil, err
	}

	ids := make([]int, 0, len(names))

	for _, name := range names {
		at := slices.IndexFunc(genres, func(genre tmdb.Genre) bool { return strings.EqualFold(genre.Name, name) })
		if at < 0 {
			return nil, apperr.Invalid("genres", "TMDB has no %s genre %q", kind, name)
		}

		ids = append(ids, genres[at].ID)
	}

	return ids, nil
}

func (s *Service) tmdbFilterOptions(ctx context.Context, mediaType string) (*FilterOptions, error) {
	genres, err := s.tmdbGenres(ctx, tmdbKind(mediaType))
	if err != nil {
		return nil, err
	}

	options := &FilterOptions{Genres: []string{}, Tags: []FilterTag{}, FetchedAt: s.opts.Now().UTC()}

	for _, genre := range genres {
		// Animation from Japan is AniList's; elsewhere it stays a genre, but a
		// dorama is live action by definition.
		if mediaType == MediaTypeDorama && genre.ID == tmdb.GenreAnimation {
			continue
		}

		options.Genres = append(options.Genres, genre.Name)
	}

	return options, nil
}

func (s *Service) tmdbEpisodes(ctx context.Context, ref titleRef) (*EpisodeList, error) {
	entry, err := s.tmdbTitle(ctx, ref)
	if err != nil {
		return nil, err
	}

	list := &EpisodeList{MediaRef: tmdbMediaRef(ref.kind, ref.id), Sources: []string{ProviderTMDB}}

	// A movie is its own one episode, as AniList counts an anime film: the
	// library attaches the file to it and the player marks it watched.
	if ref.kind == tmdb.KindMovie {
		one := 1
		list.Total = &one
		list.Episodes = []Episode{{
			Number:         1,
			Title:          entry.Details.Title.UserPreferred,
			RuntimeMinutes: entry.Details.Duration,
			AirDate:        dateString(entry.Details.StartDate),
		}}

		return list, nil
	}

	episodes, err := s.tmdbSeasonEpisodes(ctx, ref, entry)
	if err != nil {
		return nil, err
	}

	total := len(episodes)
	list.Total = &total
	list.Episodes = episodes

	return list, nil
}

func (s *Service) tmdbSeasonEpisodes(ctx context.Context, ref titleRef, entry *cachedTMDB) ([]Episode, error) {
	key := ref.cacheKey() + ":episodes"
	now := s.opts.Now()

	cached, err := s.store.Get(ctx, ProviderTMDB, key)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read episode cache")
	}

	if cached != nil && now.Sub(cached.FetchedAt) < tmdbMaxAge {
		var stored cachedTMDBEpisodes
		if decodeErr := json.Unmarshal(cached.Payload, &stored); decodeErr == nil && stored.Version == tmdbCacheVersion {
			return stored.Episodes, nil
		}
	}

	episodes := []Episode{}

	if len(entry.Seasons) > 0 {
		client, clientErr := s.tmdbClient()
		if clientErr != nil {
			return nil, clientErr
		}

		seasons, fetchErr := client.Seasons(ctx, ref.id, entry.Seasons, tmdbLanguage)
		if fetchErr != nil {
			return nil, fetchErr
		}

		episodes = episodesFromTMDB(seasons, entry.Details.Duration)
	}

	s.putTMDB(ctx, key, cachedTMDBEpisodes{Version: tmdbCacheVersion, Episodes: episodes}, now)

	return episodes, nil
}

func episodesFromTMDB(seasons []tmdb.Season, runtime *int) []Episode {
	episodes := []Episode{}

	for _, season := range seasons {
		for _, source := range season.Episodes {
			if source.EpisodeNumber <= 0 {
				continue
			}

			number := season.SeasonNumber
			episode := Episode{
				Season:         &number,
				Number:         source.EpisodeNumber,
				Title:          nonEmpty(source.Name),
				Overview:       nonEmpty(source.Overview),
				Image:          tmdb.ImageURL(source.StillPath, stillSize),
				RuntimeMinutes: positive(source.Runtime),
				AirDate:        nonEmpty(source.AirDate),
			}

			if episode.Title != nil {
				episode.Titles = map[string]string{"en": *episode.Title}
			}

			if episode.RuntimeMinutes == nil {
				episode.RuntimeMinutes = runtime
			}

			episodes = append(episodes, episode)
		}
	}

	slices.SortStableFunc(episodes, func(a, b Episode) int {
		if *a.Season != *b.Season {
			return *a.Season - *b.Season
		}

		return a.Number - b.Number
	})

	return episodes
}

// IsDorama says whether a TMDB show is a dorama in Mediary — the one rule for
// it, so the catalog and the file matcher never disagree.
func IsDorama(genreIDs []int, countries []string) bool {
	return classifyTMDB(tmdb.KindTV, genreIDs, countries) == MediaTypeDorama
}

// classifyTMDB names the media type a TMDB title belongs to in Mediary.
func classifyTMDB(kind tmdb.Kind, genreIDs []int, countries []string) string {
	if kind == tmdb.KindMovie {
		return MediaTypeMovie
	}

	if slices.Contains(genreIDs, tmdb.GenreAnimation) {
		return MediaTypeSeries
	}

	for _, country := range countries {
		if slices.Contains(DoramaCountries, country) {
			return MediaTypeDorama
		}
	}

	return MediaTypeSeries
}

// ownedByAniList is Japanese animation: the anime catalog already has it, with
// the user's own list attached.
func ownedByAniList(genreIDs []int, originalLanguage string) bool {
	return originalLanguage == "ja" && slices.Contains(genreIDs, tmdb.GenreAnimation)
}

func tmdbStatus(kind tmdb.Kind, status string) *string {
	var mapped string

	switch status {
	case "Released", "Ended":
		mapped = "FINISHED"
	case "Returning Series":
		mapped = "RELEASING"
	case "Canceled":
		mapped = "CANCELLED"
	case "Rumored", "Planned", "In Production", "Post Production", "Pilot":
		mapped = "NOT_YET_RELEASED"
	default:
		return nil
	}

	if kind == tmdb.KindMovie && mapped == "RELEASING" {
		mapped = "FINISHED"
	}

	return &mapped
}

func detailsFromTMDB(kind tmdb.Kind, source *tmdb.Details, fetchedAt time.Time) MediaDetails {
	title, original, startDate := source.Name, source.OriginalName, source.FirstAirDate
	if kind == tmdb.KindMovie {
		title, original, startDate = source.Title, source.OriginalTitle, source.ReleaseDate
	}

	genreIDs := make([]int, 0, len(source.Genres))
	genres := make([]string, 0, len(source.Genres))
	for _, genre := range source.Genres {
		genreIDs = append(genreIDs, genre.ID)
		genres = append(genres, genre.Name)
	}

	countries := source.OriginCountry
	if len(countries) == 0 {
		for _, country := range source.Production {
			countries = append(countries, country.Code)
		}
	}

	format := "TV"
	if kind == tmdb.KindMovie {
		format = "MOVIE"
	}

	start := parseDate(startDate)

	details := MediaDetails{
		MediaRef:        tmdbMediaRef(kind, source.ID),
		MediaType:       classifyTMDB(kind, genreIDs, countries),
		Format:          &format,
		Status:          tmdbStatus(kind, source.Status),
		Title:           tmdbTitleNames(title, original),
		Synonyms:        alternativeTitles(source.AlternativeTitles.All(), title, original),
		Description:     strings.TrimSpace(source.Overview),
		CoverImage:      tmdb.ImageURL(source.PosterPath, posterSize),
		BannerImage:     tmdb.ImageURL(source.BackdropPath, backdropSize),
		Duration:        tmdbRuntime(kind, source),
		SeasonYear:      start.Year,
		StartDate:       start,
		AverageScore:    tmdbScore(source.VoteAverage, source.VoteCount),
		Genres:          genres,
		Studios:         tmdbStudios(kind, source),
		CountryOfOrigin: firstString(countries),
		IsAdult:         source.Adult,
		SiteURL:         "https://www.themoviedb.org/" + string(kind) + "/" + strconv.Itoa(source.ID),
		Trailer:         tmdbTrailer(source.Videos.Results),
		Relations:       []RelatedMedia{},
		Recommendations: suggestionsFromTMDB(kind, "RECOMMENDATION", source.Recommendations.Results),
		Similar:         suggestionsFromTMDB(kind, "SIMILAR", source.Similar.Results),
		FetchedAt:       fetchedAt.UTC(),
	}

	if kind == tmdb.KindMovie {
		one := 1
		details.Episodes = &one
	} else {
		details.Episodes = source.NumberOfEpisodes

		if source.Status == "Ended" || source.Status == "Canceled" {
			details.EndDate = parseDate(source.LastAirDate)
		}

		if next := source.NextEpisode; next != nil && next.EpisodeNumber > 0 {
			if airing, err := time.Parse(time.DateOnly, next.AirDate); err == nil {
				season := next.SeasonNumber
				details.NextAiringEpisode = &AiringEpisode{Season: &season, Episode: next.EpisodeNumber, AiringAt: airing.UTC()}
			}
		}
	}

	return details
}

// suggestionsFromTMDB keeps what the user can open: Japanese animation is
// AniList's, so it is left to that catalog.
func suggestionsFromTMDB(kind tmdb.Kind, relationType string, results []tmdb.Result) []RelatedMedia {
	suggestions := []RelatedMedia{}

	for i := range results {
		found := &results[i]
		if ownedByAniList(found.GenreIDs, found.OriginalLanguage) || found.Adult {
			continue
		}

		suggestions = append(suggestions, relatedFromTMDB(kind, relationType, found))

		if len(suggestions) == maxSuggestions {
			break
		}
	}

	return suggestions
}

// collectionRelations names the other films of a series by when they came out:
// earlier ones are prequels, later ones sequels, as AniList calls them.
func collectionRelations(movie *tmdb.Details, parts []tmdb.Result) []RelatedMedia {
	others := make([]tmdb.Result, 0, len(parts))
	for i := range parts {
		if parts[i].ID != movie.ID {
			others = append(others, parts[i])
		}
	}

	slices.SortStableFunc(others, func(a, b tmdb.Result) int { return strings.Compare(a.ReleaseDate, b.ReleaseDate) })

	relations := make([]RelatedMedia, 0, len(others))

	for i := range others {
		part := &others[i]

		relationType := "OTHER"
		switch {
		case part.ReleaseDate == "" || movie.ReleaseDate == "":
		case part.ReleaseDate < movie.ReleaseDate:
			relationType = "PREQUEL"
		default:
			relationType = "SEQUEL"
		}

		relations = append(relations, relatedFromTMDB(tmdb.KindMovie, relationType, part))
	}

	return relations
}

func relatedFromTMDB(kind tmdb.Kind, relationType string, found *tmdb.Result) RelatedMedia {
	title, original, date := found.Name, found.OriginalName, found.FirstAirDate
	format := "TV"
	if kind == tmdb.KindMovie {
		title, original, date, format = found.Title, found.OriginalTitle, found.ReleaseDate, "MOVIE"
	}

	return RelatedMedia{
		RelationType: relationType,
		MediaRef:     tmdbMediaRef(kind, found.ID),
		MediaType:    classifyTMDB(kind, found.GenreIDs, found.OriginCountry),
		Format:       &format,
		SeasonYear:   parseDate(date).Year,
		Title:        tmdbTitleNames(title, original),
		CoverImage:   tmdb.ImageURL(found.PosterPath, posterSize),
	}
}

func summaryFromTMDB(kind tmdb.Kind, source *tmdb.Result, genreNames map[int]string) MediaSummary {
	title, original, startDate := source.Name, source.OriginalName, source.FirstAirDate
	if kind == tmdb.KindMovie {
		title, original, startDate = source.Title, source.OriginalTitle, source.ReleaseDate
	}

	format := "TV"
	if kind == tmdb.KindMovie {
		format = "MOVIE"
	}

	genres := []string{}
	for _, id := range source.GenreIDs {
		if name, ok := genreNames[id]; ok {
			genres = append(genres, name)
		}
	}

	start := parseDate(startDate)

	summary := MediaSummary{
		MediaRef:     tmdbMediaRef(kind, source.ID),
		MediaType:    classifyTMDB(kind, source.GenreIDs, source.OriginCountry),
		Format:       &format,
		Title:        tmdbTitleNames(title, original),
		CoverImage:   tmdb.ImageURL(source.PosterPath, posterSize),
		BannerImage:  tmdb.ImageURL(source.BackdropPath, backdropSize),
		SeasonYear:   start.Year,
		StartDate:    start,
		AverageScore: tmdbScore(source.VoteAverage, source.VoteCount),
		Genres:       genres,
		IsAdult:      source.Adult,
		SiteURL:      "https://www.themoviedb.org/" + string(kind) + "/" + strconv.Itoa(source.ID),
		Description:  strings.TrimSpace(source.Overview),
	}

	if kind == tmdb.KindMovie {
		one := 1
		summary.Episodes = &one
	}

	return summary
}

// tmdbTitleNames fills the slots AniList's titles use: the English title is what
// the user sees, the original stands where a native title would.
func tmdbTitleNames(title, original string) TitleNames {
	names := TitleNames{UserPreferred: nonEmpty(title), English: nonEmpty(title)}

	if original != "" && original != title {
		names.Native = &original
	}

	if names.UserPreferred == nil {
		names.UserPreferred = names.Native
	}

	return names
}

func alternativeTitles(titles []tmdb.AlternativeTitle, main ...string) []string {
	seen := map[string]bool{}
	for _, name := range main {
		seen[strings.ToLower(strings.TrimSpace(name))] = true
	}

	synonyms := []string{}

	for _, alternative := range titles {
		name := strings.TrimSpace(alternative.Title)
		key := strings.ToLower(name)

		if name == "" || seen[key] {
			continue
		}

		seen[key] = true
		synonyms = append(synonyms, name)
	}

	return synonyms
}

func tmdbRuntime(kind tmdb.Kind, source *tmdb.Details) *int {
	if kind == tmdb.KindMovie {
		return positive(source.Runtime)
	}

	for _, minutes := range source.EpisodeRunTime {
		if minutes > 0 {
			return &minutes
		}
	}

	if source.LastEpisode != nil {
		return positive(source.LastEpisode.Runtime)
	}

	return nil
}

func tmdbStudios(kind tmdb.Kind, source *tmdb.Details) []string {
	companies := source.ProductionCompanies
	if kind == tmdb.KindTV {
		companies = append(append([]tmdb.Company{}, source.Networks...), companies...)
	}

	studios := []string{}
	for _, company := range companies {
		if company.Name != "" && !slices.Contains(studios, company.Name) {
			studios = append(studios, company.Name)
		}
	}

	return studios
}

// tmdbScore puts TMDB's 0-10 vote average on the 0-100 scale every title uses.
// Without votes there is no score, not a zero.
func tmdbScore(average float64, votes int) *int {
	if votes == 0 {
		return nil
	}

	score := int(math.Round(average * 10))

	return &score
}

// tmdbTrailer prefers the studio's own trailer; a teaser or a fan upload is a
// worse answer than none only when nothing better exists.
func tmdbTrailer(videos []tmdb.Video) *Trailer {
	var best *tmdb.Video

	for i := range videos {
		video := &videos[i]
		if video.Site != "YouTube" || video.Key == "" || video.Type != "Trailer" {
			continue
		}

		if best == nil || (video.Official && !best.Official) {
			best = video
		}
	}

	if best == nil {
		return nil
	}

	thumbnail := "https://i.ytimg.com/vi/" + best.Key + "/hqdefault.jpg"

	return &Trailer{ID: best.Key, Site: "youtube", Thumbnail: &thumbnail}
}

func parseDate(raw string) FuzzyDate {
	parsed, err := time.Parse(time.DateOnly, raw)
	if err != nil {
		return FuzzyDate{}
	}

	year, month, day := parsed.Year(), int(parsed.Month()), parsed.Day()

	return FuzzyDate{Year: &year, Month: &month, Day: &day}
}

func dateString(date FuzzyDate) *string {
	if date.Year == nil || date.Month == nil || date.Day == nil {
		return nil
	}

	formatted := time.Date(*date.Year, time.Month(*date.Month), *date.Day, 0, 0, 0, 0, time.UTC).Format(time.DateOnly)

	return &formatted
}

func nonEmpty(text string) *string {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return nil
	}

	return &trimmed
}

func positive(value *int) *int {
	if value == nil || *value <= 0 {
		return nil
	}

	return value
}

func firstString(values []string) *string {
	for _, value := range values {
		if value != "" {
			return &value
		}
	}

	return nil
}
