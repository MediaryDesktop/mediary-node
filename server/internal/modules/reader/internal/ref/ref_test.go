package ref

import "testing"

func TestParseRoundTrip(t *testing.T) {
	for _, raw := range []string{
		"local:42",
		"opds:3:urn:uuid:7d1c9a0e-0000-4000-8000-000000000000",
		"plugin:example-comics:eyJzIjoiZnJpZXJlbi8xIiwiYyI6ImM6MSJ9",
	} {
		got, err := Parse(raw)
		if err != nil {
			t.Fatalf("Parse(%q): %v", raw, err)
		}
		if got.String() != raw {
			t.Errorf("Parse(%q).String() = %q", raw, got.String())
		}
	}
}

func TestParseRefuses(t *testing.T) {
	for _, raw := range []string{
		"",
		"42",
		"local:",
		"local:0",
		"local:-3",
		"local:042",
		"local:4x",
		"opds:3",
		"opds:3:",
		"opds:x:entry",
		"mangadex:a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
		"comick:123",
		"plugin:example-comics",
		"plugin:example-comics:",
		"plugin::eyJz",
		"plugin:Example:eyJz",
		"plugin:example-comics:not/base64",
		"plugin:example-comics:a:b",
	} {
		if got, err := Parse(raw); err == nil {
			t.Errorf("Parse(%q) = %+v, want an error", raw, got)
		}
	}
}

func TestFileID(t *testing.T) {
	if id, ok := Local(7).FileID(); !ok || id != 7 {
		t.Errorf("Local(7).FileID() = %d, %v", id, ok)
	}

	other, _ := Parse("plugin:example-comics:eyJzIjoiZnJpZXJlbi8xIiwiYyI6ImM6MSJ9")
	if _, ok := other.FileID(); ok {
		t.Error("a plugin's chapter has no library file")
	}
}
