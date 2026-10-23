package service

import (
	"context"
	"encoding/json"
	"math"
	"strings"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

const keyProfile = "torrent.profile"

// TorrentProfile is what the user likes in a release; search ranks by it and
// names the best result.
type TorrentProfile struct {
	Resolution string   `json:"resolution" enum:",2160p,1080p,720p,480p" doc:"Preferred resolution; lower ones follow in order. Empty for any."`
	Codec      string   `json:"codec" enum:",HEVC,AVC,AV1" doc:"Preferred codec. Empty for any."`
	Preferred  []string `json:"preferred" maxItems:"20" doc:"Words a release name should have — groups, sites, \"multi-sub\" — best first."`
	Excluded   []string `json:"excluded" maxItems:"20" doc:"Words that keep a release from being the best, e.g. a dub or a codec the TV cannot play."`
	MinSeeders int      `json:"min_seeders" minimum:"0" doc:"Fewer seeders keeps a release from being the best."`
	// PreferCached matters only with a debrid service as the client.
	PreferCached bool `json:"prefer_cached" doc:"With a debrid service as the client, rank the releases it already holds higher: they arrive at once. Weighs about one step of resolution."`
}

// What a release the debrid service holds gains with PreferCached: more than a
// codec, less than a resolution's worth, so a held release one step below the
// preferred resolution wins and two steps below does not.
const cachedPoints = 100

var resolutionOrder = []string{"2160p", "1080p", "720p", "480p"}

func (s *Service) Profile(ctx context.Context) (*TorrentProfile, error) {
	raw, found, err := s.store.Meta(ctx, keyProfile)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read the release profile")
	}

	profile := &TorrentProfile{Preferred: []string{}, Excluded: []string{}}
	if !found || raw == "" {
		return profile, nil
	}

	if err := json.Unmarshal([]byte(raw), profile); err != nil {
		s.logger.Warn().Err(err).Msg("discarding an unreadable release profile")
		return &TorrentProfile{Preferred: []string{}, Excluded: []string{}}, nil
	}

	return profile, nil
}

func (s *Service) SetProfile(ctx context.Context, profile TorrentProfile) (*TorrentProfile, error) {
	if profile.MinSeeders < 0 {
		return nil, apperr.Invalid("min_seeders", "cannot be negative")
	}

	profile.Preferred = cleanWords(profile.Preferred)
	profile.Excluded = cleanWords(profile.Excluded)

	payload, err := json.Marshal(profile)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "encode the release profile")
	}

	if err := s.store.SetMeta(ctx, keyProfile, string(payload)); err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "save the release profile")
	}

	return &profile, nil
}

func cleanWords(words []string) []string {
	seen := map[string]bool{}
	cleaned := []string{}

	for _, word := range words {
		word = strings.TrimSpace(word)
		key := strings.ToLower(word)
		if word == "" || seen[key] {
			continue
		}
		seen[key] = true
		cleaned = append(cleaned, word)
	}

	return cleaned
}

// score ranks a release by the profile. Ineligible releases are listed but never
// named the best.
func score(found *TorrentRelease, profile *TorrentProfile) (points int, eligible bool) {
	name := strings.ToLower(found.Title)

	for _, word := range profile.Excluded {
		if strings.Contains(name, strings.ToLower(word)) {
			return 0, false
		}
	}

	eligible = found.Seeders >= profile.MinSeeders && found.Seeders > 0

	// Resolution weighs most: the preferred one, then each step below it, and
	// anything above it after those.
	if profile.Resolution != "" && found.Resolution != "" {
		points += resolutionPoints(profile.Resolution, found.Resolution)
	}

	if profile.Codec != "" && strings.EqualFold(profile.Codec, found.Codec) {
		points += 60
	}

	if profile.PreferCached && found.Cached != nil && *found.Cached {
		points += cachedPoints
	}

	for i, word := range profile.Preferred {
		if strings.Contains(name, strings.ToLower(word)) {
			points += 50 * (len(profile.Preferred) - i)
			break
		}
	}

	switch found.Match {
	case "episode":
		points += 15
	case "any":
		// Asked for the whole title, a range of its episodes or a season's pack
		// gets more of it than one episode does. Not any batch: a film's
		// "Complete Collection" is no better than the film.
		if found.Episodes != nil && found.Episodes.To > found.Episodes.From || found.Episodes == nil && found.Season != nil {
			points += 15
		}
	case "unknown":
		// A name without episodes may not hold the one asked for at all.
		points -= 40
	}

	// Seeders break ties without drowning out the preferences.
	points += int(math.Min(30, 10*math.Log10(float64(found.Seeders)+1)))

	return points, eligible
}

func resolutionPoints(preferred, got string) int {
	want := indexOf(resolutionOrder, preferred)
	have := indexOf(resolutionOrder, got)
	if want < 0 || have < 0 {
		return 0
	}

	switch {
	case have == want:
		return 200
	case have > want:
		return 200 - 60*(have-want)
	default:
		return 80
	}
}

func indexOf(list []string, value string) int {
	for i, item := range list {
		if strings.EqualFold(item, value) {
			return i
		}
	}

	return -1
}

func beats(a, b TorrentRelease) bool {
	if a.Score != b.Score {
		return a.Score > b.Score
	}

	return a.Seeders > b.Seeders
}

// rank scores every release and marks the best eligible one.
func rank(releases []TorrentRelease, profile *TorrentProfile) {
	var best *TorrentRelease

	for i := range releases {
		found := &releases[i]
		found.Score, found.Eligible = score(found, profile)

		if found.Eligible && (best == nil || beats(*found, *best)) {
			best = found
		}
	}

	if best != nil {
		best.Best = true
	}
}
