package snapshot

import (
	"bytes"
	"compress/gzip"
	"errors"
	"reflect"
	"testing"
)

func sample() Document {
	year := int64(2026)

	return Document{
		TrackerEntries: []TrackerEntry{{
			MediaRef: "tmdb:movie:438631", MediaType: "movie", Status: "COMPLETED",
			Score: 90, Progress: 1, Private: true, Notes: "rewatch",
			CompletedYear: &year, CreatedAt: 1, UpdatedAt: 2,
		}},
		CustomLists:     []CustomList{{ID: 3, MediaType: "book", Name: "Sci-fi", Position: 0, CreatedAt: 5}},
		CustomListItems: []CustomListItem{{ListID: 3, MediaRef: "openlibrary:OL893414W", Position: 0, AddedAt: 6}},
		ListIcons:       []ListIcon{{ListID: "local:3", Icon: "rocket"}},
	}
}

func TestRoundTrip(t *testing.T) {
	encoded, err := Encode(sample())
	if err != nil {
		t.Fatal(err)
	}

	decoded, err := Decode(encoded.Body)
	if err != nil {
		t.Fatal(err)
	}

	want := sample()
	want.FormatVersion = FormatVersion

	if !reflect.DeepEqual(decoded, want) {
		t.Fatalf("round trip changed the document:\n got %+v\nwant %+v", decoded, want)
	}
}

// The cloud recognises an unchanged state only by its hash, so the same state
// must encode to the same bytes every time.
func TestEncodingIsDeterministic(t *testing.T) {
	first, err := Encode(sample())
	if err != nil {
		t.Fatal(err)
	}

	second, err := Encode(sample())
	if err != nil {
		t.Fatal(err)
	}

	if !bytes.Equal(first.Body, second.Body) || first.Sha256 != second.Sha256 {
		t.Fatal("the same document encoded to different bytes")
	}

	if first.Sha256 != Hash(first.Body) || len(first.Sha256) != 64 {
		t.Fatalf("unexpected hash %q", first.Sha256)
	}
}

func TestDecodeRefusesANewerFormat(t *testing.T) {
	var buf bytes.Buffer

	writer := gzip.NewWriter(&buf)
	_, _ = writer.Write([]byte(`{"format_version": 999}`))
	_ = writer.Close()

	if _, err := Decode(buf.Bytes()); !errors.Is(err, ErrNewerFormat) {
		t.Fatalf("want ErrNewerFormat, got %v", err)
	}
}

func TestDecodeRefusesGarbage(t *testing.T) {
	if _, err := Decode([]byte("not gzip")); err == nil {
		t.Fatal("garbage decoded without an error")
	}
}
