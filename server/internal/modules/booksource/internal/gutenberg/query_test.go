package gutenberg

import (
	"testing"

	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/source"
)

func TestMatchOf(t *testing.T) {
	for _, tc := range []struct {
		query source.Query
		want  string
	}{
		{
			source.Query{Title: "Frankenstein: or, the Modern Prometheus", Authors: []string{"Mary Shelley"}},
			`title : ("frankenstein") AND authors : ("shell"*)`,
		},
		{
			// A surname spelt another way is still found by its start.
			source.Query{Title: "Crime and Punishment", Authors: []string{"Fyodor Dostoevsky"}},
			`title : ("crime" "and" "punishment") AND authors : ("dosto"*)`,
		},
		{
			source.Query{Title: "Alice's Adventures in Wonderland", Authors: []string{"Lewis Carroll", "John Tenniel"}},
			`title : ("alice" "s" "adventures" "in" "wonderland") AND authors : ("carro"* OR "tenni"*)`,
		},
		{
			source.Query{Title: "The Gilded Age", Authors: []string{"Mark Twain", "Charles Dudley Warner Jr."}},
			`title : ("the" "gilded" "age") AND authors : ("twain" OR "warne"*)`,
		},
		{source.Query{Title: "Beowulf"}, `title : ("beowulf")`},
		{source.Query{Text: "frankenst shelley"}, `"frankenst"* "shelley"*`},
		// Quotes and operators the user types are words, not syntax.
		{source.Query{Text: `"NEAR(a b)" OR title:x*`}, `"near"* "a"* "b"* "or"* "title"* "x"*`},
		{source.Query{Text: "  ¿?  "}, ""},
	} {
		if got := matchOf(tc.query); got != tc.want {
			t.Errorf("matchOf(%+v) =\n  %s\nwant\n  %s", tc.query, got, tc.want)
		}
	}
}
