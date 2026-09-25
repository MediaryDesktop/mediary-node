package service

import (
	"context"
	"strconv"
	"strings"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/matcher"
	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

const (
	// How many unmatched files one scan takes on. A library that has just been
	// added can hold tens of thousands, and asking the source about all of them in
	// one pass would spend the whole request budget at once; what is left over is
	// picked up by the next scan.
	matchBatchSize = 2000

	// How many suggestions the user is offered for a file. Past the first few the
	// list stops helping anyone choose.
	maxSuggestions = 10
)

type Suggestion struct {
	MediaRef   string  `json:"media_ref" doc:"Reference to pass to setLibraryFileMatch."`
	Title      string  `json:"title" doc:"The title as the source spells it."`
	Format     string  `json:"format,omitempty" doc:"The source's format: TV, MOVIE, OVA, MANGA and so on."`
	Year       *int    `json:"year,omitempty" doc:"Year the entry is listed under."`
	Confidence float64 `json:"confidence" doc:"How well this entry fits the file's name, from 0 to 1."`
	Tracked    bool    `json:"tracked" doc:"True when the entry is already on the user's own list."`
}

// Suggestions ranks what a file could be, for the user to confirm. It is the other
// half of the threshold: what the node would not decide on its own, it offers.
func (s *Service) Suggestions(ctx context.Context, fileID int64) ([]Suggestion, error) {
	if s.opts.Titles == nil {
		return nil, apperr.New(apperr.KindPrecondition, "no metadata source is connected")
	}

	file, err := s.store.File(ctx, fileID)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read library file")
	}
	if file == nil {
		return nil, apperr.New(apperr.KindNotFound, "library file %d does not exist", fileID)
	}

	if strings.TrimSpace(file.Parsed.Title) == "" {
		return nil, apperr.New(apperr.KindPrecondition, "nothing in this file's name to search by")
	}

	mediaType, supported := mediaTypeForForm(file.Parsed.Form)
	if !supported {
		return nil, apperr.New(apperr.KindPrecondition,
			"the node has no source for %q files yet", file.Parsed.Form)
	}

	target := matcher.File{
		Title:   file.Parsed.Title,
		Form:    file.Parsed.Form,
		Season:  file.Parsed.Season,
		Year:    file.Parsed.Year,
		Episode: episodeOrChapter(file.Parsed),
	}

	pool, err := s.trackedCandidates(ctx, mediaType, map[string][]matcher.Candidate{})
	if err != nil {
		return nil, err
	}

	found, err := s.opts.Titles.Search(ctx, file.Parsed.Title, mediaType)
	if err != nil {
		// The list from the user's own collection is still worth offering while the
		// source is unreachable.
		s.logger.Debug().Err(err).Msg("search for suggestions failed")
	}

	ranked := matcher.Rank(target, append(pool, candidates(found, false)...))

	suggestions := make([]Suggestion, 0, min(len(ranked), maxSuggestions))
	for _, scored := range ranked[:min(len(ranked), maxSuggestions)] {
		suggestions = append(suggestions, Suggestion{
			MediaRef:   scored.Candidate.MediaRef,
			Title:      firstTitle(scored.Candidate.Titles),
			Format:     scored.Candidate.Format,
			Year:       scored.Candidate.Year,
			Confidence: scored.Confidence,
			Tracked:    scored.Candidate.Tracked,
		})
	}

	return suggestions, nil
}

type matchOutcome struct {
	Considered int
	Matched    int
}

// matchFiles works through the files no one has matched yet. Files of one title
// are grouped first, so a season of 24 episodes costs one lookup rather than 24 —
// the source's request budget is the scarce resource here, not the comparisons.
func (s *Service) matchFiles(ctx context.Context) matchOutcome {
	outcome := matchOutcome{}

	if s.opts.Titles == nil {
		return outcome
	}

	files, err := s.store.UnmatchedFiles(ctx, matchBatchSize)
	if err != nil {
		s.logger.Error().Err(err).Msg("read unmatched files")

		return outcome
	}
	if len(files) == 0 {
		return outcome
	}

	outcome.Considered = len(files)
	trackedByType := map[string][]matcher.Candidate{}

	for _, group := range groupUnmatched(files) {
		if ctx.Err() != nil {
			break
		}

		mediaType, supported := mediaTypeForForm(group.form)
		if !supported {
			continue
		}

		match := s.bestForGroup(ctx, group, mediaType, trackedByType)
		if match == nil {
			continue
		}

		for _, file := range group.files {
			stored := store.Match{
				MediaRef:   match.Candidate.MediaRef,
				Season:     file.Parsed.Season,
				Episode:    episodeOrChapter(file.Parsed),
				Confidence: match.Confidence,
			}

			if err := s.store.SetAutoMatch(ctx, file.ID, stored, s.opts.Now()); err != nil {
				s.logger.Error().Err(err).Int64("file_id", file.ID).Msg("store automatic match")

				continue
			}

			outcome.Matched++
		}

		s.publishScan("matching", map[string]any{
			"title":   group.title,
			"matched": outcome.Matched,
			"total":   outcome.Considered,
		})
	}

	return outcome
}

func (s *Service) bestForGroup(
	ctx context.Context,
	group unmatchedGroup,
	mediaType string,
	trackedByType map[string][]matcher.Candidate,
) *matcher.Scored {
	target := matcher.File{
		Title:   group.title,
		Form:    group.form,
		Season:  group.season,
		Year:    group.year,
		Episode: group.highestEpisode,
	}

	tracked, err := s.trackedCandidates(ctx, mediaType, trackedByType)
	if err != nil {
		s.logger.Warn().Err(err).Msg("read tracked titles")
	}

	best := firstScored(matcher.Rank(target, tracked))

	// The user's own list answers most files, and it answers them offline. The
	// source is only asked about what the list could not explain.
	if best == nil || best.Confidence < matcher.AutoThreshold {
		found, searchErr := s.opts.Titles.Search(ctx, group.title, mediaType)
		if searchErr != nil {
			s.logger.Debug().Err(searchErr).Str("title", group.title).Msg("search for candidates failed")
		}

		if searched := firstScored(matcher.Rank(target, candidates(found, false))); searched != nil {
			if best == nil || searched.Confidence > best.Confidence {
				best = searched
			}
		}
	}

	if best == nil || best.Confidence < matcher.AutoThreshold {
		return nil
	}

	return best
}

func (s *Service) trackedCandidates(
	ctx context.Context,
	mediaType string,
	cache map[string][]matcher.Candidate,
) ([]matcher.Candidate, error) {
	if cached, ok := cache[mediaType]; ok {
		return cached, nil
	}

	tracked, err := s.opts.Titles.Tracked(ctx, mediaType)
	if err != nil {
		cache[mediaType] = nil

		return nil, apperr.Wrap(err, apperr.KindUnavailable, "read tracked titles")
	}

	converted := candidates(tracked, true)
	cache[mediaType] = converted

	return converted, nil
}

type unmatchedGroup struct {
	form   string
	title  string
	season *int
	year   *int

	// The highest episode in the group: if that one fits inside the entry, the
	// rest do too.
	highestEpisode *int

	files []store.Unmatched
}

// groupUnmatched collects files that name the same title, season and form. The
// query already returns them next to each other.
func groupUnmatched(files []store.Unmatched) []unmatchedGroup {
	groups := make([]unmatchedGroup, 0, 8)
	index := make(map[string]int, 8)

	for _, file := range files {
		key := file.Parsed.Form + "\x00" + strings.ToLower(file.Parsed.Title) + "\x00" + seasonKey(file.Parsed.Season)

		position, seen := index[key]
		if !seen {
			groups = append(groups, unmatchedGroup{
				form:   file.Parsed.Form,
				title:  file.Parsed.Title,
				season: file.Parsed.Season,
				year:   file.Parsed.Year,
			})
			position = len(groups) - 1
			index[key] = position
		}

		group := &groups[position]
		group.files = append(group.files, file)

		if episode := episodeOrChapter(file.Parsed); episode != nil {
			if group.highestEpisode == nil || *episode > *group.highestEpisode {
				group.highestEpisode = episode
			}
		}

		if group.year == nil {
			group.year = file.Parsed.Year
		}
	}

	return groups
}

// episodeOrChapter is the number within the title, whatever the medium calls it.
func episodeOrChapter(parsed store.Parsed) *int {
	if parsed.Episode != nil {
		return parsed.Episode
	}

	return parsed.Chapter
}

func seasonKey(season *int) string {
	if season == nil {
		return ""
	}

	return strconv.Itoa(*season)
}

func firstScored(ranked []matcher.Scored) *matcher.Scored {
	if len(ranked) == 0 {
		return nil
	}

	best := ranked[0]

	return &best
}

func firstTitle(titles []string) string {
	for _, title := range titles {
		if strings.TrimSpace(title) != "" {
			return title
		}
	}

	return ""
}

func (s *Service) publishMatched(outcome matchOutcome) {
	if outcome.Matched == 0 {
		return
	}

	s.hub.Publish(events.TopicLibraryUpdate, map[string]any{
		"reason":  "matched",
		"matched": outcome.Matched,
	})
}
