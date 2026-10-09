package matcher

import (
	"unicode"
)

const (
	authorAgrees    = 0.05
	authorDisagrees = -0.3

	// A file named "Frank Herbert - Dune" tries the entry's title with its first
	// few authors on either side; past that the combinations only cost time.
	maxAuthorSpellings = 2
)

// authorSpellings are the entry's main title written the way a book file is
// often named: with the author before or after it.
func authorSpellings(candidate *Candidate) []string {
	if len(candidate.Authors) == 0 || len(candidate.Titles) == 0 {
		return nil
	}

	title := candidate.Titles[0]
	spellings := make([]string, 0, 2*min(len(candidate.Authors), maxAuthorSpellings))

	for _, author := range candidate.Authors[:min(len(candidate.Authors), maxAuthorSpellings)] {
		spellings = append(spellings, author+" "+title, title+" "+author)
	}

	return spellings
}

// authorAdjustment compares who the file says wrote it with who the entry says.
// A shared name is a small confirmation; none in common is a strong objection,
// but only between names in one script: "Булгаков" and "Bulgakov" are the same
// man, and nothing here can tell.
func authorAdjustment(file, candidate []string) float64 {
	if len(file) == 0 || len(candidate) == 0 {
		return 0
	}

	fileNames := nameTokens(file)
	candidateNames := nameTokens(candidate)

	for token := range fileNames {
		if _, ok := candidateNames[token]; ok {
			return authorAgrees
		}
	}

	if latinNames(file) != latinNames(candidate) {
		return 0
	}

	return authorDisagrees
}

// nameTokens are the words of the names worth comparing: initials and
// particles say nothing about who wrote a book.
func nameTokens(names []string) map[string]struct{} {
	tokens := map[string]struct{}{}

	for _, name := range names {
		for _, token := range NormalizeTitle(name).Tokens {
			if len([]rune(token)) >= 3 {
				tokens[token] = struct{}{}
			}
		}
	}

	return tokens
}

func latinNames(names []string) bool {
	for _, name := range names {
		for _, r := range name {
			if unicode.IsLetter(r) {
				return r <= unicode.MaxLatin1 || unicode.Is(unicode.Latin, r)
			}
		}
	}

	return true
}

// authorNamed credits an entry whose author the file's name mentions, when the
// file has no metadata to say who wrote it. "Ray Bradbury - Fahrenheit 451" is
// Bradbury's novel, not a guide to it that carries his name in its title.
func authorNamed(file File, fileTitle Title, candidate []string) float64 {
	if len(file.Authors) > 0 || len(candidate) == 0 {
		return 0
	}

	names := nameTokens(candidate)
	for _, token := range fileTitle.Tokens {
		if _, ok := names[token]; ok {
			return authorAgrees
		}
	}

	return 0
}
