package opds

import "testing"

func TestServerURL(t *testing.T) {
	got, err := ServerURL("  https://books.example/opds#top  ")
	if err != nil || got != "https://books.example/opds" {
		t.Fatalf("ServerURL = %q, %v; want the address without spaces and fragment", got, err)
	}

	for _, raw := range []string{"", "books.example/opds", "ftp://books.example", "https://", "https://me:secret@books.example"} {
		if _, err := ServerURL(raw); err == nil {
			t.Errorf("ServerURL(%q) should be refused", raw)
		}
	}
}
