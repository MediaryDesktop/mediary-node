package service

import (
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

// A sequel marker right after a title's name in a release name: "2nd Season",
// "Season 2", "S2", "II", or a bare number — "Frieren 2 - 05". A separator comes
// first in "Frieren - 13", so the episode number there is not one.
var sequelMarker = regexp.MustCompile(`(?i)^(?:\d+(?:st|nd|rd|th)?\s*season\b|season\s*\d+\b|s\d+\b|ii+\b|\d+\b)`)

// namesTitle reports whether a release is of the title: its name holds one of the
// title's names, and what follows that name is not another season's number.
// Indexers search loosely — a query for one "Tensei …" title finds every other —
// so a rule that downloads by itself takes only what names its title.
func namesTitle(release string, names []string) bool {
	for _, name := range names {
		pattern := namePattern(name)
		if pattern == nil {
			continue
		}

		for _, span := range pattern.FindAllStringIndex(release, -1) {
			if !boundary(release, span[0], -1) || !boundary(release, span[1], 1) {
				continue
			}

			tail := strings.TrimLeft(release[span[1]:], " _.")
			if !sequelMarker.MatchString(tail) {
				return true
			}
		}
	}

	return false
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
