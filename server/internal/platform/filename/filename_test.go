package filename

import "testing"

func TestReserved(t *testing.T) {
	for _, name := range []string{"CON", "con", "Aux", "nul.txt", "COM1", "lpt9.cbz"} {
		if !Reserved(name) {
			t.Errorf("Reserved(%q) = false, want true", name)
		}
	}

	for _, name := range []string{"Console", "Con Air", "COM10", "", "Frieren"} {
		if Reserved(name) {
			t.Errorf("Reserved(%q) = true, want false", name)
		}
	}
}

func TestTruncate(t *testing.T) {
	cases := []struct {
		in    string
		runes int
		want  string
	}{
		{"Frieren", 10, "Frieren"},
		{"Frieren", 4, "Frie"},
		{"Dr. Stone", 3, "Dr"},
		{"葬送のフリーレン", 2, "葬送"},
	}

	for _, c := range cases {
		if got := Truncate(c.in, c.runes); got != c.want {
			t.Errorf("Truncate(%q, %d) = %q, want %q", c.in, c.runes, got, c.want)
		}
	}
}
