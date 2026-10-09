package matcher

import "testing"

func TestAuthorAdjustment(t *testing.T) {
	cases := []struct {
		name            string
		file, candidate []string
		want            float64
	}{
		{"one name in common", []string{"Frank Herbert"}, []string{"Herbert, Frank"}, authorAgrees},
		{"someone else", []string{"Frank Herbert"}, []string{"Hal Clement"}, authorDisagrees},
		{"two scripts say nothing", []string{"Михаил Булгаков"}, []string{"Mikhail Bulgakov"}, 0},
		{"initials say nothing", []string{"F. Herbert"}, []string{"F. Scott Fitzgerald"}, authorDisagrees},
		{"no author on the file", nil, []string{"Frank Herbert"}, 0},
	}

	for _, c := range cases {
		if got := authorAdjustment(c.file, c.candidate); got != c.want {
			t.Errorf("%s: %v, want %v", c.name, got, c.want)
		}
	}
}

func TestAFileNamedWithItsAuthorMatchesTheBook(t *testing.T) {
	dune := Candidate{MediaRef: "openlibrary:OL893414W", Titles: []string{"Dune"}, Format: "BOOK", Authors: []string{"Frank Herbert"}}

	for _, name := range []string{"Frank Herbert - Dune", "Dune - Frank Herbert"} {
		ranked := Rank(File{Title: name, Form: "book"}, []Candidate{dune})
		if len(ranked) == 0 || ranked[0].Confidence < AutoThreshold {
			t.Errorf("%q scored %v, want a match", name, ranked)
		}
	}
}

func TestTheBookBeatsABookAboutIt(t *testing.T) {
	novel := Candidate{MediaRef: "openlibrary:OL103123W", Titles: []string{"Fahrenheit 451"}, Format: "BOOK", Authors: []string{"Ray Bradbury"}}
	guide := Candidate{MediaRef: "openlibrary:OL16667658W", Titles: []string{"Ray Bradbury's Fahrenheit 451"}, Format: "BOOK", Authors: []string{"Harold Bloom"}}

	ranked := Rank(File{Title: "Ray Bradbury - Fahrenheit 451", Form: "book"}, []Candidate{guide, novel})
	if ranked[0].Candidate.MediaRef != novel.MediaRef {
		t.Errorf("ranked %s first, want the novel", ranked[0].Candidate.MediaRef)
	}
}
