package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/media/internal/store"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

const (
	ProviderManual = "manual"

	mediaTypeAnime = "anime"
	mediaTypeManga = "manga"
)

var manualID = regexp.MustCompile(`^[0-9a-f]{20}$`)

// Formats each kind of title may be given, in the vocabulary its source uses, so
// a manual title is labelled the way its neighbours from AniList or TMDB are.
var manualFormats = map[string][]string{
	mediaTypeAnime:  {"TV", "TV_SHORT", "MOVIE", "SPECIAL", "OVA", "ONA", "MUSIC"},
	mediaTypeManga:  {"MANGA", "NOVEL", "ONE_SHOT"},
	MediaTypeMovie:  {"MOVIE"},
	MediaTypeSeries: {"TV"},
	MediaTypeDorama: {"TV"},
	MediaTypeBook:   {"BOOK"},
}

var manualStatuses = []string{"FINISHED", "RELEASING", "NOT_YET_RELEASED", "CANCELLED", "HIATUS"}

const (
	maxManualTitle       = 300
	maxManualDescription = 10000
	maxManualListItems   = 30
	maxManualListItem    = 100
	maxManualCount       = 100000
	maxManualDuration    = 1000
)

// ManualDraft is what the user says about a title no source knows. It is stored
// as given; the title page is built from it on every read.
type ManualDraft struct {
	MediaType       string   `json:"media_type" enum:"anime,manga,movie,series,dorama,book" doc:"Which kind of title this is. It decides the list it is tracked on and what its progress counts."`
	Title           string   `json:"title" minLength:"1" maxLength:"300" doc:"The name shown everywhere in the app."`
	OriginalTitle   *string  `json:"original_title,omitempty" maxLength:"300" doc:"The name in the original language, when it differs."`
	Synonyms        []string `json:"synonyms,omitempty" maxItems:"30" doc:"Other names the title goes by. Library files are matched against these too."`
	Description     string   `json:"description,omitempty" maxLength:"10000" doc:"Plain-text synopsis."`
	Format          *string  `json:"format,omitempty" enum:"TV,TV_SHORT,MOVIE,SPECIAL,OVA,ONA,MUSIC,MANGA,NOVEL,ONE_SHOT,BOOK" doc:"The source vocabulary's format for this kind of title: TV, MOVIE, OVA… for anime, MANGA, NOVEL, ONE_SHOT for manga, BOOK for a book. Left out it is the kind's usual one."`
	Status          *string  `json:"status,omitempty" enum:"FINISHED,RELEASING,NOT_YET_RELEASED,CANCELLED,HIATUS" doc:"Release status."`
	Year            *int     `json:"year,omitempty" minimum:"1800" maximum:"2100" doc:"Year it came out."`
	StartMonth      *int     `json:"start_month,omitempty" minimum:"1" maximum:"12" doc:"Month it came out; needs the year."`
	StartDay        *int     `json:"start_day,omitempty" minimum:"1" maximum:"31" doc:"Day it came out; needs the month."`
	EndYear         *int     `json:"end_year,omitempty" minimum:"1800" maximum:"2100" doc:"Year it finished; not before it came out."`
	EndMonth        *int     `json:"end_month,omitempty" minimum:"1" maximum:"12" doc:"Month it finished; needs the end year."`
	EndDay          *int     `json:"end_day,omitempty" minimum:"1" maximum:"31" doc:"Day it finished; needs the end month."`
	Score           *int     `json:"score,omitempty" minimum:"0" maximum:"100" doc:"How good it is, out of 100, shown where a source's average score would be. Zero is no score."`
	Seasons         *int     `json:"seasons,omitempty" minimum:"0" doc:"Seasons it has; anime, series and dorama only."`
	Episodes        *int     `json:"episodes,omitempty" minimum:"0" doc:"Episodes it has. A movie always has one."`
	Chapters        *int     `json:"chapters,omitempty" minimum:"0" doc:"Chapters; manga only."`
	Volumes         *int     `json:"volumes,omitempty" minimum:"0" doc:"Volumes; manga only."`
	Pages           *int     `json:"pages,omitempty" minimum:"0" doc:"Pages; a book only, whose progress counts them."`
	Duration        *int     `json:"duration,omitempty" minimum:"0" maximum:"1000" doc:"Minutes per episode, or the runtime of a movie."`
	Genres          []string `json:"genres,omitempty" maxItems:"30" doc:"Genres, in whatever words the user chose."`
	Studios         []string `json:"studios,omitempty" maxItems:"30" doc:"Who made it."`
	Authors         []string `json:"authors,omitempty" maxItems:"30" doc:"Who wrote it; manga and books."`
	CountryOfOrigin *string  `json:"country_of_origin,omitempty" pattern:"^[A-Z]{2}$" doc:"ISO 3166-1 alpha-2 code of where it comes from."`
	IsAdult         bool     `json:"is_adult,omitempty" doc:"Adult content."`
}

// manualRecord is the stored form. The version lets a later build read drafts an
// older one wrote.
type manualRecord struct {
	Version int         `json:"version"`
	Draft   ManualDraft `json:"draft"`
}

const manualRecordVersion = 1

func manualMediaRef(id string) string {
	return ProviderManual + ":" + id
}

func newManualID() (string, error) {
	var raw [10]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "", apperr.Wrap(err, apperr.KindInternal, "generate manual title id")
	}

	return hex.EncodeToString(raw[:]), nil
}

func (s *Service) CreateManual(ctx context.Context, draft ManualDraft) (*MediaDetails, error) {
	draft, err := normalizeManual(draft)
	if err != nil {
		return nil, err
	}

	id, err := newManualID()
	if err != nil {
		return nil, err
	}

	now := s.opts.Now()

	payload, err := encodeManual(draft)
	if err != nil {
		return nil, err
	}

	row := store.ManualTitle{ID: id, MediaType: draft.MediaType, Details: payload, CreatedAt: now, UpdatedAt: now}
	if err := s.store.InsertManualTitle(ctx, row); err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "store manual title")
	}

	details := s.manualDetails(id, draft, now, store.ManualCover{})

	return &details, nil
}

func (s *Service) UpdateManual(ctx context.Context, id string, draft ManualDraft) (*MediaDetails, error) {
	if !manualID.MatchString(id) {
		return nil, apperr.Invalid("id", "malformed manual title id %q", id)
	}

	draft, err := normalizeManual(draft)
	if err != nil {
		return nil, err
	}

	existing, err := s.store.ManualTitle(ctx, id)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read manual title")
	}
	if existing == nil {
		return nil, apperr.New(apperr.KindNotFound, "no manual title %q", id)
	}

	// The tracker keeps the title on the list of its kind; moving it to another
	// kind would leave the entry on a list the title no longer belongs to.
	if existing.MediaType != draft.MediaType {
		return nil, apperr.Invalid("media_type", "a manual title cannot change from %s to %s", existing.MediaType, draft.MediaType)
	}

	payload, err := encodeManual(draft)
	if err != nil {
		return nil, err
	}

	now := s.opts.Now()

	updated, err := s.store.UpdateManualTitle(ctx, store.ManualTitle{
		ID: id, MediaType: draft.MediaType, Details: payload, UpdatedAt: now,
	})
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "update manual title")
	}
	if !updated {
		return nil, apperr.New(apperr.KindNotFound, "no manual title %q", id)
	}

	details := s.manualDetails(id, draft, now, existing.Cover)

	return &details, nil
}

// DeleteManual removes the title and, through the Forget port, everything the
// rest of the node keeps under its reference.
func (s *Service) DeleteManual(ctx context.Context, id string) error {
	if !manualID.MatchString(id) {
		return apperr.Invalid("id", "malformed manual title id %q", id)
	}

	existing, err := s.store.ManualTitle(ctx, id)
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "read manual title")
	}

	deleted, err := s.store.DeleteManualTitle(ctx, id)
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "delete manual title")
	}
	if !deleted || existing == nil {
		return apperr.New(apperr.KindNotFound, "no manual title %q", id)
	}

	s.removeCoverFile(existing.Cover.File)

	if s.opts.Forget != nil {
		if forgetErr := s.opts.Forget.Forget(ctx, manualMediaRef(id)); forgetErr != nil {
			s.logger.Warn().Err(forgetErr).Str("id", id).Msg("forget a deleted manual title")
		}
	}

	return nil
}

// ManualTitles lists the user's own titles of one kind, for the file matcher.
func (s *Service) ManualTitles(ctx context.Context, mediaType string) ([]MediaDetails, error) {
	rows, err := s.store.ManualTitles(ctx, mediaType)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "list manual titles")
	}

	titles := make([]MediaDetails, 0, len(rows))

	for i := range rows {
		draft, decodeErr := decodeManual(rows[i].Details)
		if decodeErr != nil {
			s.logger.Warn().Err(decodeErr).Str("id", rows[i].ID).Msg("skip an unreadable manual title")
			continue
		}

		titles = append(titles, s.manualDetails(rows[i].ID, draft, rows[i].UpdatedAt, rows[i].Cover))
	}

	return titles, nil
}

// manualTitle reads one title; nil when there is none.
func (s *Service) manualTitle(ctx context.Context, id string) (*MediaDetails, error) {
	row, err := s.store.ManualTitle(ctx, id)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read manual title")
	}
	if row == nil {
		return nil, nil
	}

	draft, err := decodeManual(row.Details)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "decode manual title %s", row.ID)
	}

	details := s.manualDetails(row.ID, draft, row.UpdatedAt, row.Cover)

	return &details, nil
}

// searchManual finds the user's own titles of a kind whose names contain the
// query, for the first page of a search: a title the user made should be found
// where they look for every other one.
func (s *Service) searchManual(ctx context.Context, mediaType, query string) []MediaSummary {
	query = strings.ToLower(strings.TrimSpace(query))
	if query == "" {
		return nil
	}

	titles, err := s.ManualTitles(ctx, mediaType)
	if err != nil {
		s.logger.Warn().Err(err).Msg("search manual titles")
		return nil
	}

	var found []MediaSummary

	for i := range titles {
		if manualNameContains(&titles[i], query) {
			found = append(found, summaryOf(&titles[i]))
		}
	}

	return found
}

func manualNameContains(details *MediaDetails, query string) bool {
	names := append([]string{}, details.Synonyms...)

	for _, name := range []*string{details.Title.UserPreferred, details.Title.Native} {
		if name != nil {
			names = append(names, *name)
		}
	}

	return slices.ContainsFunc(names, func(name string) bool {
		return strings.Contains(strings.ToLower(name), query)
	})
}

func summaryOf(details *MediaDetails) MediaSummary {
	return MediaSummary{
		MediaRef:     details.MediaRef,
		MediaType:    details.MediaType,
		Format:       details.Format,
		Status:       details.Status,
		Title:        details.Title,
		CoverImage:   details.CoverImage,
		CoverColor:   details.CoverColor,
		BannerImage:  details.BannerImage,
		Episodes:     details.Episodes,
		Chapters:     details.Chapters,
		Volumes:      details.Volumes,
		SeasonYear:   details.SeasonYear,
		StartDate:    details.StartDate,
		AverageScore: details.AverageScore,
		Genres:       details.Genres,
		Authors:      details.Authors,
		Pages:        details.Pages,
		IsAdult:      details.IsAdult,
		SiteURL:      details.SiteURL,
		Description:  details.Description,
		Editable:     details.Editable,
	}
}

// manualEpisodes numbers the episodes the user said the title has. Nothing else is
// known of each, which is how the page already draws an episode no source has.
func manualEpisodes(details *MediaDetails) (*EpisodeList, error) {
	switch details.MediaType {
	case mediaTypeManga, MediaTypeBook:
		return nil, apperr.Invalid("media_ref", "a %s has no episodes", details.MediaType)
	}

	list := &EpisodeList{MediaRef: details.MediaRef, Total: details.Episodes, Episodes: []Episode{}, Sources: []string{}}

	if details.Episodes == nil {
		return list, nil
	}

	for number := 1; number <= *details.Episodes; number++ {
		list.Episodes = append(list.Episodes, Episode{Number: number, RuntimeMinutes: details.Duration})
	}

	return list, nil
}

func (s *Service) manualDetails(id string, draft ManualDraft, updatedAt time.Time, cover store.ManualCover) MediaDetails {
	title := draft.Title

	details := MediaDetails{
		MediaRef:  manualMediaRef(id),
		MediaType: draft.MediaType,
		Format:    draft.Format,
		Status:    draft.Status,
		Title: TitleNames{
			UserPreferred: &title,
			English:       &title,
			Native:        draft.OriginalTitle,
		},
		Synonyms:        nonNilStrings(draft.Synonyms),
		Description:     draft.Description,
		Duration:        draft.Duration,
		SeasonYear:      draft.Year,
		StartDate:       FuzzyDate{Year: draft.Year, Month: draft.StartMonth, Day: draft.StartDay},
		EndDate:         FuzzyDate{Year: draft.EndYear, Month: draft.EndMonth, Day: draft.EndDay},
		AverageScore:    draft.Score,
		Genres:          nonNilStrings(draft.Genres),
		Studios:         nonNilStrings(draft.Studios),
		Authors:         nonNilStrings(draft.Authors),
		CountryOfOrigin: draft.CountryOfOrigin,
		IsAdult:         draft.IsAdult,
		Relations:       []RelatedMedia{},
		Recommendations: []RelatedMedia{},
		Similar:         []RelatedMedia{},
		Editable:        true,
		FetchedAt:       updatedAt.UTC(),
	}

	if cover.File != "" && s.opts.CoverURL != nil {
		address := s.opts.CoverURL(id, cover.Version)
		details.CoverImage = &address

		if cover.Color != "" {
			color := cover.Color
			details.CoverColor = &color
		}
	}

	switch draft.MediaType {
	case mediaTypeManga:
		details.Chapters = draft.Chapters
		details.Volumes = draft.Volumes
	case MediaTypeBook:
		details.Pages = draft.Pages
	default:
		details.Episodes = draft.Episodes
		details.Seasons = draft.Seasons
	}

	return details
}

// normalizeManual trims what the user typed and rejects what no title page could
// show. Counts that make no sense for the kind are dropped rather than refused:
// a form switched from series to movie still carries the episode count it had.
func normalizeManual(draft ManualDraft) (ManualDraft, error) {
	formats, known := manualFormats[draft.MediaType]
	if !known {
		return draft, apperr.Invalid("media_type", "unknown media type %q", draft.MediaType)
	}

	draft.Title = strings.TrimSpace(draft.Title)
	if draft.Title == "" {
		return draft, apperr.Invalid("title", "a title needs a name")
	}
	if utf8.RuneCountInString(draft.Title) > maxManualTitle {
		return draft, apperr.Invalid("title", "a name is at most %d characters", maxManualTitle)
	}

	if draft.OriginalTitle != nil {
		draft.OriginalTitle = nonEmpty(*draft.OriginalTitle)
	}
	if draft.OriginalTitle != nil && *draft.OriginalTitle == draft.Title {
		draft.OriginalTitle = nil
	}
	if draft.OriginalTitle != nil && utf8.RuneCountInString(*draft.OriginalTitle) > maxManualTitle {
		return draft, apperr.Invalid("original_title", "a name is at most %d characters", maxManualTitle)
	}

	draft.Description = strings.TrimSpace(draft.Description)
	if utf8.RuneCountInString(draft.Description) > maxManualDescription {
		return draft, apperr.Invalid("description", "a description is at most %d characters", maxManualDescription)
	}

	for field, list := range map[string]*[]string{
		"synonyms": &draft.Synonyms, "genres": &draft.Genres, "studios": &draft.Studios, "authors": &draft.Authors,
	} {
		cleaned, err := manualList(field, *list)
		if err != nil {
			return draft, err
		}

		*list = cleaned
	}

	draft.Synonyms = slices.DeleteFunc(draft.Synonyms, func(name string) bool { return name == draft.Title })

	if draft.Format == nil {
		usual := formats[0]
		draft.Format = &usual
	} else if !slices.Contains(formats, *draft.Format) {
		return draft, apperr.Invalid("format", "a %s is one of %s", draft.MediaType, strings.Join(formats, ", "))
	}

	if draft.Status != nil && !slices.Contains(manualStatuses, *draft.Status) {
		return draft, apperr.Invalid("status", "unknown status %q", *draft.Status)
	}

	if err := checkManualDate("year", "start_month", "start_day", draft.Year, draft.StartMonth, draft.StartDay); err != nil {
		return draft, err
	}
	if err := checkManualDate("end_year", "end_month", "end_day", draft.EndYear, draft.EndMonth, draft.EndDay); err != nil {
		return draft, err
	}
	if draft.EndYear != nil && draft.Year != nil && manualDateBefore(draft) {
		return draft, apperr.Invalid("end_year", "a title cannot finish before it came out")
	}

	if draft.Score != nil && (*draft.Score < 0 || *draft.Score > 100) {
		return draft, apperr.Invalid("score", "a score is between 0 and 100")
	}

	for field, count := range map[string]*int{
		"episodes": draft.Episodes, "chapters": draft.Chapters, "volumes": draft.Volumes, "pages": draft.Pages,
		"seasons": draft.Seasons,
	} {
		if count != nil && (*count < 0 || *count > maxManualCount) {
			return draft, apperr.Invalid(field, "%s is between 0 and %d", field, maxManualCount)
		}
	}

	if draft.Duration != nil && (*draft.Duration < 0 || *draft.Duration > maxManualDuration) {
		return draft, apperr.Invalid("duration", "a duration is between 0 and %d minutes", maxManualDuration)
	}

	draft.Episodes = positive(draft.Episodes)
	draft.Chapters = positive(draft.Chapters)
	draft.Volumes = positive(draft.Volumes)
	draft.Pages = positive(draft.Pages)
	draft.Duration = positive(draft.Duration)
	draft.Score = positive(draft.Score)
	draft.Seasons = positive(draft.Seasons)

	switch draft.MediaType {
	case MediaTypeMovie:
		one := 1
		draft.Episodes, draft.Chapters, draft.Volumes, draft.Pages, draft.Seasons = &one, nil, nil, nil, nil
	case mediaTypeManga:
		draft.Episodes, draft.Pages, draft.Duration, draft.Seasons = nil, nil, nil, nil
	case MediaTypeBook:
		draft.Episodes, draft.Chapters, draft.Volumes, draft.Duration, draft.Seasons = nil, nil, nil, nil, nil
	default:
		draft.Chapters, draft.Volumes, draft.Pages = nil, nil, nil
	}

	return draft, nil
}

// checkManualDate accepts a date known down to the year, month or day, but not a
// day without its month or a month without its year.
func checkManualDate(yearField, monthField, dayField string, year, month, day *int) error {
	if year != nil && (*year < 1800 || *year > 2100) {
		return apperr.Invalid(yearField, "a year is between 1800 and 2100")
	}

	if month != nil {
		if year == nil {
			return apperr.Invalid(monthField, "a month needs its year")
		}
		if *month < 1 || *month > 12 {
			return apperr.Invalid(monthField, "a month is between 1 and 12")
		}
	}

	if day != nil {
		if month == nil {
			return apperr.Invalid(dayField, "a day needs its month")
		}

		last := time.Date(*year, time.Month(*month)+1, 0, 0, 0, 0, 0, time.UTC).Day()
		if *day < 1 || *day > last {
			return apperr.Invalid(dayField, "a day of that month is between 1 and %d", last)
		}
	}

	return nil
}

// manualDateBefore compares only as far as both dates are known.
func manualDateBefore(draft ManualDraft) bool {
	end := []*int{draft.EndYear, draft.EndMonth, draft.EndDay}
	start := []*int{draft.Year, draft.StartMonth, draft.StartDay}

	for i := range end {
		if end[i] == nil || start[i] == nil {
			return false
		}
		if *end[i] != *start[i] {
			return *end[i] < *start[i]
		}
	}

	return false
}

func manualList(field string, values []string) ([]string, error) {
	cleaned := uniqueStrings(values)

	if len(cleaned) > maxManualListItems {
		return nil, apperr.Invalid(field, "at most %d %s", maxManualListItems, field)
	}

	for _, value := range cleaned {
		if utf8.RuneCountInString(value) > maxManualListItem {
			return nil, apperr.Invalid(field, "each of %s is at most %d characters", field, maxManualListItem)
		}
	}

	return cleaned, nil
}

func encodeManual(draft ManualDraft) ([]byte, error) {
	payload, err := json.Marshal(manualRecord{Version: manualRecordVersion, Draft: draft})
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "encode manual title")
	}

	return payload, nil
}

func decodeManual(payload []byte) (ManualDraft, error) {
	var record manualRecord
	if err := json.Unmarshal(payload, &record); err != nil {
		return ManualDraft{}, err
	}

	return record.Draft, nil
}
