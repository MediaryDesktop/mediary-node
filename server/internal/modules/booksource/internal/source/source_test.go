package source

import "testing"

func TestSourceOfAReference(t *testing.T) {
	for ref, want := range map[string]string{
		"gutenberg:84":                  "gutenberg",
		"opds:2:urn:uuid:8b2c1f3e-0001": "opds:2",
		"opds:2:/opds/book/7":           "opds:2",
		"gutenberg:":                    "",
		"opds:2":                        "",
		"opds::key":                     "",
		":84":                           "",
		"84":                            "",
	} {
		if got := SourceOf(ref); got != want {
			t.Errorf("SourceOf(%q) = %q, want %q", ref, got, want)
		}
	}
}

func TestRefRoundTrip(t *testing.T) {
	for _, tc := range []struct{ source, key string }{
		{"gutenberg", "84"},
		{"opds:2", "urn:uuid:8b2c1f3e-0001"},
	} {
		ref := Ref(tc.source, tc.key)
		if got := SourceOf(ref); got != tc.source {
			t.Errorf("SourceOf(Ref(%q, %q)) = %q", tc.source, tc.key, got)
		}
	}
}
