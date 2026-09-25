package matcher

import (
	"regexp"
	"strconv"
	"strings"
)

// Normalization follows Seanime's scanner/title_normalization.go, condensed to
// the rules that change outcomes: a release name and a source title describe the
// same show in different spellings, and comparing them raw fails on punctuation,
// macrons and season markers alone.
var (
	seasonExplicit    = regexp.MustCompile(`(?i)\b(?:season|s|series)\s*0*(\d+)\b`)
	seasonOrdinal     = regexp.MustCompile(`(?i)\b(\d+)(?:st|nd|rd|th)\s*(?:season|series)\b`)
	seasonWordOrdinal = regexp.MustCompile(`(?i)\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+season\b`)
	seasonJapanese    = regexp.MustCompile(`(\d+)\s*(?:期|シーズン)`)

	partExplicit = regexp.MustCompile(`(?i)\b(?:part|cour)\s*0*(\d+)\b`)
	partOrdinal  = regexp.MustCompile(`(?i)\b(\d+)(?:st|nd|rd|th)\s*(?:part|cour)\b`)

	yearInParens = regexp.MustCompile(`\((\d{4})\)`)
	yearAnywhere = regexp.MustCompile(`\b(19\d{2}|20\d{2})\b`)
)

var ordinalWords = map[string]int{
	"first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5,
	"sixth": 6, "seventh": 7, "eighth": 8, "ninth": 9, "tenth": 10,
}

// Words that carry little identity. A shared "the" or "no" says nothing about two
// titles being the same show.
var noiseWords = map[string]struct{}{
	"the": {}, "a": {}, "an": {}, "of": {}, "to": {}, "in": {}, "for": {},
	"on": {}, "with": {}, "at": {}, "by": {}, "from": {}, "as": {}, "is": {},
	"it": {}, "that": {}, "this": {}, "be": {}, "are": {}, "was": {}, "were": {},
	"no": {}, "wa": {}, "wo": {}, "ga": {}, "ni": {}, "de": {}, "ka": {},
	"mo": {}, "ya": {}, "e": {}, "he": {},
	"anime": {}, "ova": {}, "ona": {}, "oad": {}, "tv": {}, "movie": {},
	"nc": {}, "nced": {}, "ncop": {}, "extras": {}, "ending": {}, "opening": {},
	"preview": {}, "special": {}, "specials": {}, "sp": {}, "finale": {},
	"season": {}, "uncensored": {}, "censored": {}, "bluray": {},
}

// Title is a title reduced to what can be compared, with the numbering it carried
// pulled out: "Title S2" must not match "Other Title 2" on the bare 2.
type Title struct {
	Original   string
	Normalized string
	Tokens     []string

	Season *int
	Year   *int
}

func NormalizeTitle(title string) Title {
	if strings.TrimSpace(title) == "" {
		return Title{}
	}

	normalized := normalize(title)

	return Title{
		Original:   title,
		Normalized: normalized,
		Tokens:     strings.Fields(normalized),
		Season:     extractSeason(title),
		Year:       extractYear(title),
	}
}

func normalize(value string) string {
	lowered := strings.ToLower(value)

	// Macrons spelled out: "Gekijōban" and "Gekijouban" are the same word.
	for from, to := range map[string]string{
		"ō": "ou", "ū": "uu", "ā": "aa", "ē": "ee", "ī": "ii",
		"@": "a", "×": " x ", "＊": " * ", "꞉": ":",
	} {
		lowered = strings.ReplaceAll(lowered, from, to)
	}

	for _, quote := range []string{"'s", "’s", "`s"} {
		lowered = strings.ReplaceAll(lowered, quote, " ")
	}
	for _, quote := range []string{"'", "’", "`", `"`, "“", "”"} {
		lowered = strings.ReplaceAll(lowered, quote, "")
	}

	// Words a source writes and a release group does not, or the other way round.
	for _, replacement := range []struct{ from, to string }{
		{"the animation", ""},
		{"the", ""},
		{"episode", ""},
		{"oad", "ova"},
		{"oav", "ova"},
		{"specials", "sp"},
		{"special", "sp"},
		{"&", "and"},
		{"(tv)", ""},
	} {
		lowered = replaceWord(lowered, replacement.from, replacement.to)
	}

	var builder strings.Builder
	builder.Grow(len(lowered))

	for _, symbol := range lowered {
		switch {
		case symbol >= 'a' && symbol <= 'z', symbol >= '0' && symbol <= '9':
			builder.WriteRune(symbol)
		case symbol > 127:
			// Japanese and other non-latin scripts are kept: a native title is
			// often the only one that matches.
			builder.WriteRune(symbol)
		default:
			builder.WriteByte(' ')
		}
	}

	stripped := builder.String()

	// The numbering is scored separately, so it leaves the compared text. Roman
	// numerals stay: they are what tells "Overlord II" from "Overlord".
	for _, pattern := range []*regexp.Regexp{
		seasonExplicit, seasonOrdinal, seasonWordOrdinal, seasonJapanese,
		partExplicit, partOrdinal,
	} {
		stripped = pattern.ReplaceAllString(stripped, " ")
	}

	return strings.Join(strings.Fields(stripped), " ")
}

// replaceWord replaces whole words only, so "the" does not eat the start of
// "theater".
func replaceWord(value, from, to string) string {
	if value == "" || from == "" {
		return value
	}

	var builder strings.Builder
	builder.Grow(len(value))

	start := 0

	for {
		index := strings.Index(value[start:], from)
		if index == -1 {
			builder.WriteString(value[start:])

			break
		}

		at := start + index

		atWordStart := at == 0 || !isWordByte(value[at-1])
		atWordEnd := at+len(from) == len(value) || !isWordByte(value[at+len(from)])

		if atWordStart && atWordEnd {
			builder.WriteString(value[start:at])
			builder.WriteString(to)
			start = at + len(from)

			continue
		}

		builder.WriteString(value[start : at+1])
		start = at + 1
	}

	return builder.String()
}

func isWordByte(symbol byte) bool {
	return (symbol >= 'a' && symbol <= 'z') ||
		(symbol >= 'A' && symbol <= 'Z') ||
		(symbol >= '0' && symbol <= '9')
}

func extractSeason(value string) *int {
	lowered := strings.ToLower(value)

	for _, pattern := range []*regexp.Regexp{seasonExplicit, seasonOrdinal, seasonJapanese} {
		if match := pattern.FindStringSubmatch(lowered); len(match) > 1 {
			if number, err := strconv.Atoi(match[1]); err == nil && number > 0 && number < 100 {
				return &number
			}
		}
	}

	if match := seasonWordOrdinal.FindStringSubmatch(lowered); len(match) > 1 {
		if number, ok := ordinalWords[match[1]]; ok {
			return &number
		}
	}

	return nil
}

func extractYear(value string) *int {
	for _, pattern := range []*regexp.Regexp{yearInParens, yearAnywhere} {
		if match := pattern.FindStringSubmatch(value); len(match) > 1 {
			if number, err := strconv.Atoi(match[1]); err == nil {
				return &number
			}
		}
	}

	return nil
}

func significantTokens(tokens []string) []string {
	kept := make([]string, 0, len(tokens))

	for _, token := range tokens {
		if _, noise := noiseWords[token]; noise {
			continue
		}
		if isYearToken(token) {
			continue
		}

		kept = append(kept, token)
	}

	if len(kept) == 0 {
		return tokens
	}

	return kept
}

func isYearToken(token string) bool {
	if len(token) != 4 {
		return false
	}

	number, err := strconv.Atoi(token)

	return err == nil && number >= 1900 && number <= 2200
}
