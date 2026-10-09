package app

import "testing"

func TestFreeTextLeavesNoQuerySyntax(t *testing.T) {
	cases := map[string]string{
		"Ray Bradbury - Fahrenheit 451": "Ray Bradbury Fahrenheit 451",
		`Dune: "Messiah" (1969)`:        "Dune Messiah 1969",
		"Тіні забутих предків":          "Тіні забутих предків",
		"Ender's Game":                  "Ender's Game",
	}

	for query, want := range cases {
		if got := freeText(query); got != want {
			t.Errorf("freeText(%q) = %q, want %q", query, got, want)
		}
	}
}
