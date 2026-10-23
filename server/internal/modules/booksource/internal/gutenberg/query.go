package gutenberg

import (
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/source"
)

const (
	maxQueryWords = 12
	// A surname this long is matched by its start, so the catalogue's
	// "Dostoyevsky" is found for "Dostoevsky" and "Tolstoy" for "Tolstoi".
	surnameStem = 5
)

// suffixes after a surname that are not the surname.
var suffixes = map[string]bool{"jr": true, "sr": true, "ii": true, "iii": true, "iv": true}

// matchOf is the full-text query for a search. From a book's page every word of
// its title must be in the title and one of its authors' surnames among the
// authors, so a book of the same name by someone else is not offered as this
// one. Typed text matches words by their start, anywhere.
func matchOf(query source.Query) string {
	var clauses []string

	// "Frankenstein: or, the Modern Prometheus" is found by "Frankenstein"; a
	// subtitle one edition has and another lacks would hide the book.
	title, _, _ := strings.Cut(query.Title, ":")
	if words := wordsOf(title); len(words) > 0 {
		clauses = append(clauses, "title : ("+strings.Join(quoted(words, false), " ")+")")
	}

	if surnames := surnamesOf(query.Authors); len(surnames) > 0 {
		clauses = append(clauses, "authors : ("+strings.Join(surnames, " OR ")+")")
	}

	if words := wordsOf(query.Text); len(words) > 0 {
		clauses = append(clauses, strings.Join(quoted(words, true), " "))
	}

	return strings.Join(clauses, " AND ")
}

// wordsOf splits text the way the index does: letters and digits, the rest
// separates. "Alice's" is "alice" and "s", as in the catalogue.
func wordsOf(text string) []string {
	words := strings.FieldsFunc(strings.ToLower(text), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	})

	if len(words) > maxQueryWords {
		words = words[:maxQueryWords]
	}

	return words
}

// quoted makes words safe in a query: a word in double quotes is never read as
// an operator, a column or a NEAR group.
func quoted(words []string, prefix bool) []string {
	out := make([]string, 0, len(words))
	for _, word := range words {
		term := `"` + word + `"`
		if prefix {
			term += "*"
		}
		out = append(out, term)
	}

	return out
}

func surnamesOf(authors []string) []string {
	var out []string

	seen := map[string]bool{}
	for _, author := range authors {
		words := wordsOf(author)

		surname := ""
		for i := len(words) - 1; i >= 0; i-- {
			if utf8.RuneCountInString(words[i]) > 2 && !suffixes[words[i]] {
				surname = words[i]
				break
			}
		}
		if surname == "" {
			continue
		}

		term := `"` + surname + `"`
		if utf8.RuneCountInString(surname) > surnameStem {
			term = `"` + string([]rune(surname)[:surnameStem]) + `"*`
		}

		if !seen[term] {
			seen[term] = true
			out = append(out, term)
		}
	}

	return out
}
