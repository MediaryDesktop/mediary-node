package app

import (
	"testing"

	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/tmdb"
)

// The matcher ranks a folder of doramas by the catalog's own rule: an animated
// show from Korea is a series there, so it is not preferred here either.
func TestTheMatcherKnowsDoramasAsTheCatalogDoes(t *testing.T) {
	cases := map[string]struct {
		found tmdb.Result
		want  bool
	}{
		"live action from Korea":   {tmdb.Result{OriginCountry: []string{"KR"}, GenreIDs: []int{18}}, true},
		"animated show from Korea": {tmdb.Result{OriginCountry: []string{"KR"}, GenreIDs: []int{tmdb.GenreAnimation}}, false},
		"live action from the US":  {tmdb.Result{OriginCountry: []string{"US"}, GenreIDs: []int{18}}, false},
	}

	for name, c := range cases {
		if got := isDorama(&c.found); got != c.want {
			t.Errorf("%s: isDorama = %v, want %v", name, got, c.want)
		}
	}
}
