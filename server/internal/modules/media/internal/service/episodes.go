package service

import (
	"context"
	"encoding/json"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anilist"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anizip"
)

const (
	ProviderAniZip = "anizip"

	aniZipMaxAge = 24 * time.Hour

	// Bump when cachedEpisodes changes shape.
	episodesCacheVersion = 1
)

// The languages the desktop is translated into, plus the romanisation and the
// original: everything else ani.zip carries would only make the payload heavier.
var episodeTitleLanguages = []string{"en", "uk", "ru", "x-jat", "ja"}

// "Episode 12 - Name", "Episode 12: Name", "Ep. 12 – Name" — the shapes streaming
// sites give AniList.
var streamingTitle = regexp.MustCompile(`(?i)^\s*ep(?:isode|\.)?\s*(\d+)\s*(?:[-–—:]\s*(.*))?$`)

type cachedEpisodes struct {
	Version int `json:"version"`

	// Mapping is nil when ani.zip has no listing for the title. That answer is
	// cached too: asking again on every visit would not change it.
	Mapping *anizip.Mapping `json:"mapping"`
}

// Episodes lists a title's episodes with whatever the node can learn about each.
// Sources are tried per field, not per title: a listing with titles but no
// stills still gets its stills from a streaming site where one has them.
//
// Nothing past the title's details is required. A source that fails or knows
// nothing leaves its fields empty, and the list is still one entry per episode,
// so the page always has something to draw and the library its files to attach.
func (s *Service) Episodes(ctx context.Context, mediaRef string) (*EpisodeList, error) {
	ref, err := parseRef(mediaRef)
	if err != nil {
		return nil, err
	}

	if ref.provider == ProviderTMDB {
		return s.tmdbEpisodes(ctx, ref)
	}

	if ref.provider == ProviderOpenLibrary || ref.provider == ProviderGoogleBooks {
		return nil, apperr.Invalid("media_ref", "a book has no episodes")
	}

	mediaID := ref.id

	entry, err := s.details(ctx, mediaRef)
	if err != nil {
		return nil, err
	}

	if entry.Details.MediaType != "anime" {
		return nil, apperr.Invalid("media_ref", "only anime titles have episodes")
	}

	list := &EpisodeList{MediaRef: mediaRef, Episodes: []Episode{}, Sources: []string{ProviderAniList}}

	byNumber := map[int]*Episode{}
	at := func(number int) *Episode {
		if episode, ok := byNumber[number]; ok {
			return episode
		}

		episode := &Episode{Number: number}
		byNumber[number] = episode

		return episode
	}

	if mapping := s.aniZip(ctx, mediaID); mapping != nil && fillFromAniZip(mapping, at) {
		list.Sources = append(list.Sources, ProviderAniZip)
	}

	fillFromStreaming(entry.Streaming, at)

	list.Total = episodeTotal(&entry.Details)

	last := 0
	if list.Total != nil {
		last = *list.Total
	}
	for number := range byNumber {
		last = max(last, number)
	}

	runtime := entry.Details.Duration

	for number := 1; number <= last; number++ {
		episode := at(number)
		if episode.RuntimeMinutes == nil {
			episode.RuntimeMinutes = runtime
		}

		list.Episodes = append(list.Episodes, *episode)
	}

	return list, nil
}

// episodeTotal is how many episodes the title has or, while it airs and the
// source does not know the final count, how many are out.
func episodeTotal(details *MediaDetails) *int {
	if details.Episodes != nil {
		return details.Episodes
	}

	if details.NextAiringEpisode != nil && details.NextAiringEpisode.Episode > 1 {
		aired := details.NextAiringEpisode.Episode - 1
		return &aired
	}

	return nil
}

// aniZip is a cached ani.zip listing. Any failure is logged and read as "no
// listing": ani.zip only adds to an episode list that stands without it.
func (s *Service) aniZip(ctx context.Context, mediaID int) *anizip.Mapping {
	if s.opts.AniZip == nil {
		return nil
	}

	externalID := strconv.Itoa(mediaID)
	now := s.opts.Now()

	cached, err := s.store.Get(ctx, ProviderAniZip, externalID)
	if err != nil {
		s.logger.Warn().Err(err).Msg("read ani.zip cache")
	}

	var stale *anizip.Mapping

	if cached != nil {
		var entry cachedEpisodes
		if decodeErr := json.Unmarshal(cached.Payload, &entry); decodeErr == nil && entry.Version == episodesCacheVersion {
			if now.Sub(cached.FetchedAt) < aniZipMaxAge {
				return entry.Mapping
			}

			stale = entry.Mapping
		}
	}

	mapping, err := s.opts.AniZip.ByAniList(ctx, mediaID)
	if err != nil {
		s.logger.Warn().Err(err).Int("anilist_id", mediaID).Msg("ani.zip episode listing is unavailable")

		// Past its age the entry is still better than nothing while ani.zip is
		// down. Expired entries are purged on the next answer that does arrive.
		return stale
	}

	payload, err := json.Marshal(cachedEpisodes{Version: episodesCacheVersion, Mapping: mapping})
	if err == nil {
		if putErr := s.store.Put(ctx, ProviderAniZip, externalID, payload, now); putErr != nil {
			s.logger.Warn().Err(putErr).Msg("store ani.zip listing")
		}
	}

	if purgeErr := s.store.PurgeOlderThan(ctx, ProviderAniZip, now.Add(-aniZipMaxAge)); purgeErr != nil {
		s.logger.Warn().Err(purgeErr).Msg("purge expired ani.zip cache")
	}

	return mapping
}

// fillFromAniZip copies the season's own episodes. Specials ("S1") are left out:
// AniList lists most of them as titles of their own, and numbering them into
// this one would collide with its episodes. It reports whether anything was used.
func fillFromAniZip(mapping *anizip.Mapping, at func(int) *Episode) bool {
	used := false

	for key, source := range mapping.Episodes {
		number, err := strconv.Atoi(key)
		if err != nil || number <= 0 {
			continue
		}

		episode := at(number)

		if titles := episodeTitles(source.Title); len(titles) > 0 {
			episode.Titles = titles
			episode.Title = firstOf(titles, episodeTitleLanguages...)
			used = true
		}

		if text := firstPresent(source.Overview, source.Summary); text != nil {
			overview := strings.TrimSpace(*text)
			if overview != "" {
				episode.Overview = &overview
				used = true
			}
		}

		if source.Image != nil && *source.Image != "" {
			episode.Image = source.Image
			used = true
		}

		if minutes := firstPositive(source.Runtime, source.Length); minutes != nil {
			episode.RuntimeMinutes = minutes
		}

		if source.AirDate != nil && *source.AirDate != "" {
			episode.AirDate = source.AirDate
		}
	}

	return used
}

// fillFromStreaming fills what ani.zip left empty from a streaming site's own
// listing. Its order is the site's, so the number is read from the title, and an
// entry whose title carries no number is skipped rather than guessed at.
func fillFromStreaming(streaming []anilist.StreamingEpisode, at func(int) *Episode) {
	for _, source := range streaming {
		if source.Title == nil {
			continue
		}

		found := streamingTitle.FindStringSubmatch(*source.Title)
		if found == nil {
			continue
		}

		number, err := strconv.Atoi(found[1])
		if err != nil || number <= 0 {
			continue
		}

		episode := at(number)

		if name := strings.TrimSpace(found[2]); name != "" && episode.Title == nil {
			episode.Title = &name
		}

		if source.Thumbnail != nil && *source.Thumbnail != "" && episode.Image == nil {
			episode.Image = source.Thumbnail
		}
	}
}

func episodeTitles(source map[string]string) map[string]string {
	titles := map[string]string{}

	for _, language := range episodeTitleLanguages {
		if title := strings.TrimSpace(source[language]); title != "" {
			titles[language] = title
		}
	}

	return titles
}

func firstOf(titles map[string]string, languages ...string) *string {
	for _, language := range languages {
		if title, ok := titles[language]; ok {
			return &title
		}
	}

	return nil
}

func firstPositive(values ...*float64) *int {
	for _, value := range values {
		if value != nil && *value > 0 {
			minutes := int(math.Round(*value))
			return &minutes
		}
	}

	return nil
}
