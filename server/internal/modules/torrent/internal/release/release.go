// Package release reads what a torrent's name says about it: which episodes, in
// what quality, from which group. Indexers rarely say any of it in fields of their
// own, and the name is all a search result has before it is downloaded.
package release

import (
	"regexp"
	"strconv"
	"strings"
)

// Episodes is the range of episodes a release holds, inclusive.
type Episodes struct {
	From int `json:"from"`
	To   int `json:"to"`
}

// Contains reports whether the release holds the episode.
func (e Episodes) Contains(episode int) bool {
	return episode >= e.From && episode <= e.To
}

type Info struct {
	Group      string    `json:"group,omitempty"`
	Resolution string    `json:"resolution,omitempty" doc:"e.g. 1080p"`
	Codec      string    `json:"codec,omitempty" doc:"e.g. HEVC"`
	Episodes   *Episodes `json:"episodes,omitempty" doc:"Absent when the name gives no episode."`
	// Batch is a release of several episodes, or one that calls itself complete.
	Batch bool `json:"batch"`
}

var (
	// [Group] at the very start.
	leadingGroup = regexp.MustCompile(`^\s*\[([^\]]+)\]`)

	resolutionPattern = regexp.MustCompile(`(?i)\b(2160|1440|1080|720|576|540|480|360)[pi]\b`)
	widthPattern      = regexp.MustCompile(`(?i)\b(?:3840x2160|1920x1080|1280x720)\b`)

	codecs = []struct {
		pattern *regexp.Regexp
		name    string
	}{
		{regexp.MustCompile(`(?i)\b(?:x265|h\.?265|hevc)\b`), "HEVC"},
		{regexp.MustCompile(`(?i)\bav1\b`), "AV1"},
		{regexp.MustCompile(`(?i)\b(?:x264|h\.?264|avc)\b`), "AVC"},
	}

	// 01-12, 01~12, E01-E12, 1-2 — a dash with spaces around it is a separator
	// ("Title - 13"), never a range, so the dash here has none.
	rangePattern = regexp.MustCompile(`(?i)(?:^|[\s\[(_.])(?:e|ep|episodes?\s*)?(\d{1,4})\s?[-~]\s?(?:e|ep)?(\d{1,4})(?:$|[\s\])_.v])`)

	// S01E05, E05, EP05, Episode 5.
	taggedEpisode = regexp.MustCompile(`(?i)(?:\bs\d{1,2}\s?e|\bep?\.?\s?|\bepisode\s)(\d{1,4})\b`)

	// "Title - 13", "Title - 13v2", "Title - 13 (1080p)".
	dashEpisode = regexp.MustCompile(`\s-\s(\d{1,4})(?:v\d)?(?:\s|$|[\[(.])`)

	// [13] or (13) on its own.
	bracketEpisode = regexp.MustCompile(`[\[(](\d{1,4})(?:v\d)?[\])]`)

	batchWords = regexp.MustCompile(`(?i)\b(?:batch|complete|season\s*pack|full\s*season)\b`)

	// Numbers that look like episodes but are not.
	notEpisode = regexp.MustCompile(`(?i)\b(?:19|20)\d{2}\b|\b\d{3,4}[pi]\b|\b(?:10|8)[\s-]?bit\b|\bx26[45]\b|\bh\.?26[45]\b|\b\d+(?:\.\d+)?\s?(?:mb|gb|gib|mib)\b`)
)

// Parse reads a release name.
func Parse(name string) Info {
	var info Info

	if match := leadingGroup.FindStringSubmatch(name); match != nil {
		info.Group = strings.TrimSpace(match[1])
	}

	if match := resolutionPattern.FindStringSubmatch(name); match != nil {
		info.Resolution = match[1] + "p"
	} else if match := widthPattern.FindString(name); match != "" {
		info.Resolution = match[strings.IndexByte(match, 'x')+1:] + "p"
	}

	for _, codec := range codecs {
		if codec.pattern.MatchString(name) {
			info.Codec = codec.name
			break
		}
	}

	// Years, resolutions and sizes would otherwise read as episodes or ranges.
	clean := notEpisode.ReplaceAllString(name, " ")
	clean = strings.TrimSuffix(clean, extension(clean))

	info.Episodes = episodes(clean)

	if info.Episodes != nil && info.Episodes.To > info.Episodes.From {
		info.Batch = true
	}
	if batchWords.MatchString(name) {
		info.Batch = true
	}

	return info
}

func episodes(name string) *Episodes {
	if match := rangePattern.FindStringSubmatch(name); match != nil {
		from, _ := strconv.Atoi(match[1])
		to, _ := strconv.Atoi(match[2])
		if from > 0 && to >= from && to-from < 2000 {
			return &Episodes{From: from, To: to}
		}
	}

	for _, pattern := range []*regexp.Regexp{taggedEpisode, dashEpisode, bracketEpisode} {
		if match := pattern.FindStringSubmatch(name); match != nil {
			if episode, err := strconv.Atoi(match[1]); err == nil && episode > 0 {
				return &Episodes{From: episode, To: episode}
			}
		}
	}

	return nil
}

// extension is a video extension at the end of a single-file release's name.
func extension(name string) string {
	for _, ext := range []string{".mkv", ".mp4", ".avi", ".webm", ".m2ts"} {
		if strings.HasSuffix(strings.ToLower(name), ext) {
			return name[len(name)-len(ext):]
		}
	}

	return ""
}
