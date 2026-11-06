package backup

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

// A version 1 document, from a node that knew nothing of manual titles, is read
// as one without them.
func TestDecodeReadsAVersionOneDocument(t *testing.T) {
	var buf bytes.Buffer

	writer := gzip.NewWriter(&buf)
	_, _ = writer.Write([]byte(`{"format_version": 1, "tracker_entries": [
		{"media_ref": "tmdb:tv:1399", "media_type": "series", "status": "PLANNING", "created_at": 1, "updated_at": 1}
	], "custom_lists": [], "custom_list_items": [], "list_icons": []}`))
	_ = writer.Close()

	doc, err := Decode(buf.Bytes())
	if err != nil {
		t.Fatalf("decode a version 1 document: %v", err)
	}

	if doc.FormatVersion != 1 || len(doc.TrackerEntries) != 1 || len(doc.ManualTitles) != 0 {
		t.Fatalf("decoded %+v", doc)
	}
}

func TestAManualTitleAndItsPosterSurviveEncoding(t *testing.T) {
	doc := sample()
	doc.ManualTitles = []ManualTitle{{
		ID: "0123456789abcdef0123", MediaType: "anime", Details: `{"title":"My own show"}`,
		CreatedAt: 7, UpdatedAt: 8, CoverColor: "#112233", CoverVersion: 2,
		Cover: []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10},
	}}

	encoded, err := Encode(doc)
	if err != nil {
		t.Fatal(err)
	}

	decoded, err := Decode(encoded.Body)
	if err != nil {
		t.Fatal(err)
	}

	doc.FormatVersion = FormatVersion
	if !reflect.DeepEqual(decoded, doc) {
		t.Fatalf("round trip changed the document:\n got %+v\nwant %+v", decoded, doc)
	}
}

func TestEmpty(t *testing.T) {
	if doc := (Document{}); !doc.Empty() {
		t.Error("a document with nothing in it is not empty")
	}

	for name, doc := range map[string]Document{
		"entries":       {TrackerEntries: []TrackerEntry{{MediaRef: "tmdb:tv:1"}}},
		"lists":         {CustomLists: []CustomList{{ID: 1}}},
		"manual titles": {ManualTitles: []ManualTitle{{ID: "0123456789abcdef0123"}}},
	} {
		if doc.Empty() {
			t.Errorf("a document with %s is empty", name)
		}
	}
}
