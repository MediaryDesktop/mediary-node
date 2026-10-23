package service

import (
	"regexp"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

// A sequel marker right after a title's name in a release name: "2nd Season",
// "Season 2", "S2", "II", or a bare number — "Frieren 2 - 05". A separator comes
// first in "Frieren - 13", so the episode number there is not one.
var sequelMarker = regexp.MustCompile(`(?i)^(?:\d+(?:st|nd|rd|th)?\s*season\b|season\s*\d+\b|s\d+\b|ii+\b|\d+\b)`)

// A season named outright. Unlike sequelMarker, never a bare number, which is as
// often the episode: "Frieren 05".
var seasonMarker = regexp.MustCompile(`(?i)^(?:(\d+)(?:st|nd|rd|th)?\s*season\b|season\s*(\d+)\b|s(\d+)\b|ii+\b)`)

// laterSeason reports whether a tail begins by naming a season after the
// first: "S01" or "Season 1" is the title itself.
func laterSeason(tail string) bool {
	match := seasonMarker.FindStringSubmatch(tail)
	if match == nil {
		return false
	}

	for _, number := range match[1:] {
		if number != "" {
			n, err := strconv.Atoi(number)
			return err == nil && n > 1
		}
	}

	return true
}

// namesTitle reports whether a release is of the title: its name holds one of the
// title's names, and what follows that name is not another season's number.
// Indexers search loosely — a query for one "Tensei …" title finds every other —
// so a rule that downloads by itself takes only what names its title.
func namesTitle(release string, names []string) bool {
	for _, tail := range tails(release, names) {
		if !sequelMarker.MatchString(tail) {
			return true
		}
	}

	return false
}

// namesAnotherSeason reports whether a release names the title only to go on
// to another season: "Sousou no Frieren 2nd Season" when the title is "Sousou no
// Frieren". Looser than !namesTitle: a release that names none of the title's
// names — "[Erai-raws] Frieren - 01 ~ 28" — is not taken for another season.
func namesAnotherSeason(release string, names []string) bool {
	found := tails(release, names)
	for _, tail := range found {
		if !laterSeason(tail) {
			return false
		}
	}

	return len(found) > 0
}

// tails are what follows each place a release name holds one of the title's
// names as whole words.
func tails(release string, names []string) []string {
	var found []string

	for _, name := range names {
		pattern := namePattern(name)
		if pattern == nil {
			continue
		}

		for _, span := range pattern.FindAllStringIndex(release, -1) {
			if boundary(release, span[0], -1) && boundary(release, span[1], 1) {
				found = append(found, strings.TrimLeft(release[span[1]:], " _."))
			}
		}
	}

	return found
}

// namePattern finds a name's words in that order, with any punctuation or spaces
// between them: "Kantei Skill de Nariagaru, 3rd Season" and "Kantei.Skill.de.
// Nariagaru.3rd.Season" are the same name.
func namePattern(name string) *regexp.Regexp {
	words := strings.FieldsFunc(name, func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsDigit(r) })

	letters := 0
	for _, word := range words {
		letters += utf8.RuneCountInString(word)
	}
	if letters < 3 {
		return nil
	}

	quoted := make([]string, len(words))
	for i, word := range words {
		quoted[i] = regexp.QuoteMeta(word)
	}

	return regexp.MustCompile(`(?i)` + strings.Join(quoted, `[^\p{L}\p{N}]+`))
}

// boundary reports whether the match edge at i is not inside a word: the rune on
// the outer side, if any, is neither a letter nor a digit.
func boundary(text string, i, side int) bool {
	var r rune
	if side < 0 {
		if i == 0 {
			return true
		}
		r, _ = utf8.DecodeLastRuneInString(text[:i])
	} else {
		if i == len(text) {
			return true
		}
		r, _ = utf8.DecodeRuneInString(text[i:])
	}

	return !unicode.IsLetter(r) && !unicode.IsDigit(r)
}
