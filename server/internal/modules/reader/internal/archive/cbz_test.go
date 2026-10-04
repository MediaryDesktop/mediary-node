package archive

import (
	"archive/zip"
	"bytes"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func writeCBZ(t *testing.T, entries map[string][]byte) string {
	t.Helper()

	var buf bytes.Buffer
	writer := zip.NewWriter(&buf)
	for name, data := range entries {
		entry, err := writer.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := entry.Write(data); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	path := filepath.Join(t.TempDir(), "chapter.cbz")
	if err := os.WriteFile(path, buf.Bytes(), 0o600); err != nil {
		t.Fatal(err)
	}

	return path
}

func names(pages []Page) []string {
	out := make([]string, len(pages))
	for i, page := range pages {
		out[i] = page.Name
	}

	return out
}

func TestPagesAreInReadingOrder(t *testing.T) {
	path := writeCBZ(t, map[string][]byte{
		"10.jpg":  {1},
		"2.jpg":   {1},
		"001.png": {1},
		"9.jpg":   {1},
	})

	pages, err := Pages(path)
	if err != nil {
		t.Fatalf("pages: %v", err)
	}

	want := []string{"001.png", "2.jpg", "9.jpg", "10.jpg"}
	if got := names(pages); !reflect.DeepEqual(got, want) {
		t.Errorf("order = %v, want %v", got, want)
	}

	for i, page := range pages {
		if page.Index != i {
			t.Errorf("page %s has index %d, want %d", page.Name, page.Index, i)
		}
	}
}

func TestNonPagesAreLeftOut(t *testing.T) {
	path := writeCBZ(t, map[string][]byte{
		"ComicInfo.xml":    []byte("<xml/>"),
		"__MACOSX/1.jpg":   {1},
		"001.jpg":          {1},
		"._001.jpg":        {1},
		"notes.txt":        []byte("x"),
		"thumbs/.DS_Store": {1},
		"002.WEBP":         {1},
	})

	pages, err := Pages(path)
	if err != nil {
		t.Fatalf("pages: %v", err)
	}

	want := []string{"001.jpg", "002.WEBP"}
	if got := names(pages); !reflect.DeepEqual(got, want) {
		t.Errorf("pages = %v, want %v", got, want)
	}
}

func TestReadPageReturnsTheBytesAndTheirType(t *testing.T) {
	path := writeCBZ(t, map[string][]byte{
		"001.jpg": []byte("first"),
		"002.png": []byte("second"),
	})

	image, err := ReadPage(path, 1)
	if err != nil {
		t.Fatalf("read page: %v", err)
	}
	if string(image.Data) != "second" || image.ContentType != "image/png" {
		t.Errorf("got %q (%s), want second (image/png)", image.Data, image.ContentType)
	}
}

func TestReadPageRefusesAnIndexOutsideTheArchive(t *testing.T) {
	path := writeCBZ(t, map[string][]byte{"001.jpg": {1}})

	for _, index := range []int{-1, 1, 99} {
		if _, err := ReadPage(path, index); err == nil {
			t.Errorf("index %d read without error", index)
		}
	}
}

func TestArchiveWithoutImagesIsAnError(t *testing.T) {
	path := writeCBZ(t, map[string][]byte{"ComicInfo.xml": []byte("<xml/>")})

	if _, err := Pages(path); err == nil {
		t.Fatal("an archive with no images listed without error")
	}
}

func TestNaturalLess(t *testing.T) {
	tests := []struct {
		a, b string
		want bool
	}{
		{"2.jpg", "10.jpg", true},
		{"10.jpg", "2.jpg", false},
		// Equal numbers fall back to the names, so the order is stable.
		{"01.jpg", "1.jpg", true},
		{"Page 9.jpg", "Page 10.jpg", true},
		{"a.jpg", "B.jpg", true},
	}

	for _, tt := range tests {
		if got := naturalLess(tt.a, tt.b); got != tt.want {
			t.Errorf("naturalLess(%q, %q) = %v, want %v", tt.a, tt.b, got, tt.want)
		}
	}
}
