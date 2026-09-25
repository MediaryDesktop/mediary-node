// Package parser turns a file's path into what can be read off its name alone:
// which form of media it is, the title, and the numbering. It asks nothing of the
// network and knows nothing about the sources — deciding *which* title this is
// happens later, against AniList or TMDB.
//
// Release names for video are parsed by github.com/5rahim/habari, the tokenizer
// Seanime uses: those heuristics are years of accumulated edge cases, and
// rewriting them means repeating the same mistakes. Manga and book names it does
// not handle at all — it treats .cbz and .epub as part of the title — so chapter
// and volume numbering is ours.
package parser

import (
	"path"
	"regexp"
	"strconv"
	"strings"

	habari "github.com/5rahim/habari"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/scanner"
)

// Version is stored next to every parsed row. Bumping it makes the next scan
// re-parse names recorded by an older build, without re-reading the files: a
// better parser is worth nothing if the library keeps the old answers.
const Version = 1

// Form is what the file holds, as far as its name tells. Unlike scanner.Kind,
// which only looks at the extension, this separates an episode from a movie and
// both from the openings and extras that must never be tracked as an episode.
type Form string

const (
	FormSeries  Form = "series"
	FormMovie   Form = "movie"
	FormSpecial Form = "special"
	FormExtra   Form = "extra"
	FormManga   Form = "manga"
	FormBook    Form = "book"
)

type Result struct {
	Form  Form
	Title string

	Year    *int
	Season  *int
	Episode *int
	Chapter *int
	Volume  *int

	EpisodeTitle string
	ReleaseGroup string
	Resolution   string
}

// Openings, endings, trailers and menus. They carry episode-looking numbers
// ("NCOP01") and would otherwise be matched as the first episode of the show.
var extraTypes = map[string]struct{}{
	"OP": {}, "OPENING": {}, "NCOP": {}, "ED": {}, "ENDING": {}, "NCED": {},
	"OPED": {}, "PV": {}, "PREVIEW": {}, "CM": {}, "SPOT": {}, "TRAILER": {},
	"MENU": {}, "LOGO": {}, "EVENT": {}, "TOKUTEN": {},
	"映像特典": {}, "特典": {}, "特典アニメ": {},
}

var specialTypes = map[string]struct{}{
	"SP": {}, "SPECIAL": {}, "SPECIALS": {}, "OVA": {}, "OAV": {}, "ONA": {},
	"OAD": {}, "番外編": {}, "總集編": {},
}

var movieTypes = map[string]struct{}{
	"MOVIE": {}, "GEKIJOUBAN": {},
}

// Folder names that describe a shelf rather than a title. Taken from Seanime's
// comparison.IgnoredFilenames: a folder called "Specials" is not a show.
var ignoredTitles = map[string]struct{}{
	"extra": {}, "extras": {}, "ova": {}, "ovas": {}, "ona": {}, "onas": {},
	"oad": {}, "oads": {}, "other": {}, "others": {}, "special": {},
	"specials": {}, "movie": {}, "movies": {}, "season": {}, "seasons": {},
	"batch": {}, "complete": {}, "complete series": {}, "nc": {}, "music": {},
	"mv": {}, "trailer": {}, "promo": {}, "pv": {}, "commercial": {}, "ad": {},
	"opening": {}, "openings": {}, "ending": {}, "endings": {}, "op": {},
	"ed": {}, "ncop": {}, "nced": {}, "creditless": {}, "subs": {},
	"subtitles": {}, "sample": {}, "samples": {}, "anime": {}, "manga": {},
	"books": {}, "book": {}, "series": {}, "shows": {}, "tv": {}, "films": {},
	"film": {}, "downloads": {}, "media": {}, "library": {}, "video": {},
	"videos": {},
}

// Folder names that decide the form on their own. The common layout puts extras
// beside the episodes — Show/Season 1 next to Show/Specials — and the files
// inside those folders often carry no keyword of their own.
var folderForms = map[string]Form{
	"special": FormSpecial, "specials": FormSpecial, "sp": FormSpecial,
	"ova": FormSpecial, "ovas": FormSpecial, "ona": FormSpecial,
	"onas": FormSpecial, "oad": FormSpecial, "oads": FormSpecial,
	"extra": FormExtra, "extras": FormExtra, "nc": FormExtra,
	"creditless": FormExtra, "opening": FormExtra, "openings": FormExtra,
	"ending": FormExtra, "endings": FormExtra, "menu": FormExtra,
	"movie": FormMovie, "movies": FormMovie, "film": FormMovie, "films": FormMovie,
}

func Parse(relPath string, kind scanner.Kind) Result {
	dirs, filename := splitPath(relPath)

	switch kind {
	case scanner.KindManga:
		return parseManga(dirs, filename)
	case scanner.KindBook:
		return parseBook(dirs, filename)
	case scanner.KindVideo:
		return parseVideo(dirs, filename)
	default:
		return parseVideo(dirs, filename)
	}
}

type folder struct {
	original string
	title    string
	season   *int
	year     *int
	types    []string
}

func parseVideo(dirs []string, filename string) Result {
	meta := habari.Parse(filename)
	folders := parseFolders(dirs)

	result := Result{
		Title:        cleanTitle(meta.Title, meta.AnimeType),
		Year:         firstNumber(meta.Year),
		Season:       firstNumber(meta.SeasonNumber...),
		Episode:      firstNumber(meta.EpisodeNumber...),
		EpisodeTitle: strings.TrimSpace(meta.EpisodeTitle),
		ReleaseGroup: meta.ReleaseGroup,
		Resolution:   meta.VideoResolution,
	}

	if isIgnoredTitle(result.Title) {
		result.Title = ""
	}

	folderTitle := closestFolderTitle(folders)

	// Inside a shelf — Show/Extras, Show/Specials — the file name is the name of
	// the extra ("behind the scenes"), not of the show. The title standing above
	// the shelf is what the file belongs to.
	if result.Title == "" || (folderTitle != "" && nearestIsShelf(folders)) {
		result.Title = folderTitle
	}

	// A season or a year written on the folder rather than on every file is the
	// usual case for a tidy library: Show/Season 2/Show - 01.mkv.
	for i := len(folders) - 1; i >= 0; i-- {
		if result.Season == nil {
			result.Season = folders[i].season
		}
		if result.Year == nil {
			result.Year = folders[i].year
		}
	}

	result.Form = videoForm(meta.AnimeType, folders, result.Episode)

	// An extra keeps no episode number: "NCOP01" is the first opening, not the
	// first episode, and letting that number through is how an opening ends up
	// marking an episode watched.
	if result.Form == FormExtra || result.Form == FormMovie {
		result.Episode = nil
	}

	return result
}

func videoForm(fileTypes []string, folders []folder, episode *int) Form {
	types := make([]string, 0, len(fileTypes)+4)
	types = append(types, fileTypes...)
	for _, dir := range folders {
		types = append(types, dir.types...)
	}

	if containsType(types, extraTypes) {
		return FormExtra
	}
	if containsType(types, specialTypes) {
		return FormSpecial
	}

	// The nearest folder wins: Show/Specials/Show - 01.mkv is a special even
	// though nothing in the file name says so.
	for i := len(folders) - 1; i >= 0; i-- {
		if form, ok := folderForms[strings.ToLower(strings.TrimSpace(folders[i].original))]; ok {
			return form
		}
	}

	if containsType(types, movieTypes) {
		return FormMovie
	}

	if episode != nil {
		return FormSeries
	}

	// One video, no episode number: a film far more often than a show with a
	// single unnumbered episode.
	return FormMovie
}

var (
	volumePattern  = regexp.MustCompile(`(?i)(?:^|[\s_.\-\[(])v(?:ol(?:ume)?)?\.?\s*(\d{1,4})(?:\b|_)`)
	chapterPattern = regexp.MustCompile(`(?i)(?:^|[\s_.\-\[(])(?:c(?:h(?:apter|apitre)?)?|ep(?:isode)?)\.?\s*(\d{1,5})(?:\.\d+)?(?:\b|_)`)
	trailingNumber = regexp.MustCompile(`(\d{1,5})(?:\.\d+)?\s*$`)
	bracketPattern = regexp.MustCompile(`[\[({][^\])}]*[\])}]`)
)

func parseManga(dirs []string, filename string) Result {
	name := stripExtension(filename)
	folders := parseFolders(dirs)

	result := Result{Form: FormManga}

	if match := volumePattern.FindStringSubmatch(name); match != nil {
		result.Volume = parseNumber(match[1])
	}
	if match := chapterPattern.FindStringSubmatch(name); match != nil {
		result.Chapter = parseNumber(match[1])
	}

	title := titleBeforeNumbering(name)
	if result.Chapter == nil && result.Volume == nil {
		// Nothing labelled: a bare trailing number on a comic file is its
		// chapter, which is how most downloaders name them.
		if match := trailingNumber.FindStringSubmatch(title); match != nil {
			result.Chapter = parseNumber(match[1])
			title = strings.TrimSpace(strings.TrimSuffix(title, match[0]))
		}
	}

	result.Title = cleanTitle(title, nil)
	if isIgnoredTitle(result.Title) {
		result.Title = ""
	}
	if result.Title == "" {
		result.Title = closestFolderTitle(folders)
	}

	return result
}

func parseBook(dirs []string, filename string) Result {
	name := stripExtension(filename)

	result := Result{Form: FormBook, Title: cleanTitle(bracketPattern.ReplaceAllString(name, " "), nil)}

	if isIgnoredTitle(result.Title) {
		result.Title = ""
	}
	if result.Title == "" {
		result.Title = closestFolderTitle(parseFolders(dirs))
	}

	return result
}

// titleBeforeNumbering keeps what stands before the first volume or chapter
// marker, which is where the title lives in every common naming scheme.
func titleBeforeNumbering(name string) string {
	cut := len(name)

	for _, pattern := range []*regexp.Regexp{volumePattern, chapterPattern} {
		if loc := pattern.FindStringIndex(name); len(loc) == 2 && loc[0] < cut {
			cut = loc[0]
		}
	}

	return strings.TrimSpace(name[:cut])
}

func parseFolders(dirs []string) []folder {
	folders := make([]folder, 0, len(dirs))

	for _, dir := range dirs {
		if strings.TrimSpace(dir) == "" {
			continue
		}

		meta := habari.Parse(dir)
		folders = append(folders, folder{
			original: dir,
			title:    cleanTitle(meta.Title, meta.AnimeType),
			season:   firstNumber(meta.SeasonNumber...),
			year:     firstNumber(meta.Year),
			types:    meta.AnimeType,
		})
	}

	return folders
}

// closestFolderTitle walks up from the file: the folder next to it names the
// title more often than the one at the top of the library.
func closestFolderTitle(folders []folder) string {
	for i := len(folders) - 1; i >= 0; i-- {
		title := folders[i].title
		if title == "" || isIgnoredTitle(title) {
			continue
		}
		if _, isShelf := folderForms[strings.ToLower(strings.TrimSpace(folders[i].original))]; isShelf {
			continue
		}

		return title
	}

	return ""
}

// cleanTitle drops the type marker habari leaves inside the title of names like
// "Steins;Gate - OVA - 01" or "Show Movie". Only a marker the parser itself
// reported as a type is removed, so a show whose name really ends in that word
// keeps it.
func cleanTitle(title string, reportedTypes []string) string {
	parts := strings.Split(strings.TrimSpace(title), " - ")

	for len(parts) > 1 && isTypeKeyword(parts[len(parts)-1]) {
		parts = parts[:len(parts)-1]
	}

	cleaned := strings.TrimSpace(strings.Trim(strings.Join(parts, " - "), " -_."))

	for _, reported := range reportedTypes {
		marker := strings.TrimSpace(reported)
		if marker == "" || len(cleaned) <= len(marker) {
			continue
		}

		if !strings.EqualFold(cleaned[len(cleaned)-len(marker):], marker) {
			continue
		}

		if shortened := strings.Trim(cleaned[:len(cleaned)-len(marker)], " -_.:"); shortened != "" {
			cleaned = shortened
		}
	}

	return cleaned
}

// nearestIsShelf reports whether the folder holding the file is a shelf such as
// Specials or Extras rather than a title.
func nearestIsShelf(folders []folder) bool {
	if len(folders) == 0 {
		return false
	}

	_, shelf := folderForms[strings.ToLower(strings.TrimSpace(folders[len(folders)-1].original))]

	return shelf
}

func isTypeKeyword(value string) bool {
	upper := strings.ToUpper(strings.TrimSpace(value))

	for _, set := range []map[string]struct{}{extraTypes, specialTypes, movieTypes} {
		if _, ok := set[upper]; ok {
			return true
		}
	}

	return false
}

func containsType(values []string, set map[string]struct{}) bool {
	for _, value := range values {
		if _, ok := set[strings.ToUpper(strings.TrimSpace(value))]; ok {
			return true
		}
	}

	return false
}

func isIgnoredTitle(title string) bool {
	_, ignored := ignoredTitles[strings.ToLower(strings.TrimSpace(title))]

	return ignored
}

func splitPath(relPath string) (dirs []string, filename string) {
	cleaned := strings.TrimPrefix(path.Clean(strings.ReplaceAll(relPath, "\\", "/")), "/")

	segments := strings.Split(cleaned, "/")
	if len(segments) == 0 {
		return nil, cleaned
	}

	return segments[:len(segments)-1], segments[len(segments)-1]
}

func stripExtension(filename string) string {
	return strings.TrimSuffix(filename, path.Ext(filename))
}

func firstNumber(values ...string) *int {
	for _, value := range values {
		if number := parseNumber(value); number != nil {
			return number
		}
	}

	return nil
}

func parseNumber(value string) *int {
	number, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		return nil
	}

	return &number
}
