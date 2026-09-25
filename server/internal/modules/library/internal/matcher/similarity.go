package matcher

import "strings"

// Sørensen–Dice over bigrams, the same measure Seanime compares titles with. It
// is forgiving of the small spelling differences between a release name and a
// source title, and cheap enough to run over every candidate of every file.
func diceSimilarity(left, right string) float64 {
	if left == "" && right == "" {
		return 1
	}
	if left == "" || right == "" {
		return 0
	}
	if left == right {
		return 1
	}

	leftGrams := bigrams(left)
	rightGrams := bigrams(right)

	if len(leftGrams) == 0 || len(rightGrams) == 0 {
		return 0
	}

	leftCounts := make(map[uint64]int, len(leftGrams))
	for _, gram := range leftGrams {
		leftCounts[gram]++
	}

	shared := 0

	for _, gram := range rightGrams {
		if leftCounts[gram] > 0 {
			leftCounts[gram]--
			shared++
		}
	}

	return float64(2*shared) / float64(len(leftGrams)+len(rightGrams))
}

func bigrams(value string) []uint64 {
	symbols := []rune(value)
	if len(symbols) < 2 {
		if len(symbols) == 1 {
			return []uint64{uint64(symbols[0])}
		}

		return nil
	}

	grams := make([]uint64, 0, len(symbols)-1)
	for i := 0; i < len(symbols)-1; i++ {
		grams = append(grams, uint64(symbols[i])<<32|uint64(symbols[i+1]))
	}

	return grams
}

// sharedTokens counts the tokens the two sets have in common. It catches the case
// dice is weakest at: a source title that spells out what the release name
// shortens, where the words match but the strings differ in length.
func sharedTokens(left, right []string) int {
	if len(left) == 0 || len(right) == 0 {
		return 0
	}

	counts := make(map[string]int, len(left))
	for _, token := range left {
		counts[token]++
	}

	shared := 0

	for _, token := range right {
		if counts[token] > 0 {
			counts[token]--
			shared++
		}
	}

	return shared
}

// hasStrongToken requires at least one shared token that carries identity and is
// longer than a particle. Without it, two titles can share only "no" and "wa" and
// still show an overlap.
func hasStrongToken(left, right []string) bool {
	present := make(map[string]struct{}, len(right))
	for _, token := range right {
		present[token] = struct{}{}
	}

	for _, token := range left {
		if len([]rune(token)) < 3 && !isNonLatin(token) {
			continue
		}
		if _, ok := present[token]; ok {
			return true
		}
	}

	return false
}

// A two-character Japanese token carries far more identity than a two-letter
// latin one, so it is not dismissed for being short.
func isNonLatin(token string) bool {
	return strings.IndexFunc(token, func(symbol rune) bool { return symbol > 127 }) >= 0
}
