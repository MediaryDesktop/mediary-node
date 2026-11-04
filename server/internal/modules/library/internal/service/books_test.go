package service

import (
	"archive/zip"
	"context"
	"os"
	"path/filepath"
	"slices"
	"testing"
)

var duneCandidate = TitleCandidate{
	MediaRef: "openlibrary:OL893414W",
	Titles:   []string{"Dune"},
	Format:   "BOOK",
	Year:     count(1965),
	Authors:  []string{"Frank Herbert"},
}

func writeBookEPUB(t *testing.T, path, metadata string) {
	t.Helper()

	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = file.Close() }()

	archive := zip.NewWriter(file)

	for name, body := range map[string]string{
		"META-INF/container.xml": `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="content.opf"/></rootfiles></container>`,
		"content.opf":            `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">` + metadata + `</metadata></package>`,
	} {
		entry, createErr := archive.Create(name)
		if createErr != nil {
			t.Fatal(createErr)
		}
		if _, writeErr := entry.Write([]byte(body)); writeErr != nil {
			t.Fatal(writeErr)
		}
	}

	if err := archive.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestABookIsMatchedByItsISBN(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	h.titles.isbns = map[string]TitleCandidate{"9780441172719": duneCandidate}

	// Nothing in the name says Dune: the ISBN is all there is, and it is enough.
	writeBookEPUB(t, filepath.Join(root, "scan_0042.epub"),
		`<dc:title>Dune</dc:title><dc:identifier>urn:isbn:978-0-441-17271-9</dc:identifier>`)

	if _, err := h.svc.AddRoot(context.Background(), root, ContentBooks); err != nil {
		t.Fatalf("add root: %v", err)
	}
	h.scan(t, 0)

	file := h.files(t)[0]
	if file.Match == nil || file.Match.MediaRef != duneCandidate.MediaRef || file.Match.Confidence != 1 {
		t.Fatalf("match = %+v, want %s for certain", file.Match, duneCandidate.MediaRef)
	}

	if h.titles.searchCount() != 0 {
		t.Errorf("searched %v although the ISBN answered", h.titles.searches)
	}

	suggestions, err := h.svc.Suggestions(context.Background(), file.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(suggestions) == 0 || suggestions[0].MediaRef != duneCandidate.MediaRef || suggestions[0].Confidence != 1 {
		t.Errorf("suggestions = %+v, want the ISBN's book first", suggestions)
	}
}

func TestABookIsSearchedByTheTitleItCarries(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	impostor := TitleCandidate{
		MediaRef: "openlibrary:OL1W",
		Titles:   []string{"Dune"},
		Format:   "BOOK",
		Authors:  []string{"Hal Clement"},
	}
	h.titles.found = []TitleCandidate{impostor, duneCandidate}

	writeBookEPUB(t, filepath.Join(root, "herbert_v2_fixed.epub"),
		`<dc:title>Dune</dc:title><dc:creator>Frank Herbert</dc:creator>`)

	if _, err := h.svc.AddRoot(context.Background(), root, ContentBooks); err != nil {
		t.Fatalf("add root: %v", err)
	}
	h.scan(t, 0)

	if !slices.Equal(h.titles.searches, []string{"Dune"}) {
		t.Errorf("searched %v, want the title from the book's metadata", h.titles.searches)
	}

	// Two books of one name: the author tells them apart.
	file := h.files(t)[0]
	if file.Match == nil || file.Match.MediaRef != duneCandidate.MediaRef {
		t.Fatalf("match = %+v, want Herbert's Dune", file.Match)
	}
}

func TestABookWithoutMetadataGoesByItsName(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	h.titles.found = []TitleCandidate{duneCandidate}

	writeFile(t, filepath.Join(root, "Frank Herbert - Dune.pdf"), "%PDF-1.7")

	if _, err := h.svc.AddRoot(context.Background(), root, ContentBooks); err != nil {
		t.Fatalf("add root: %v", err)
	}
	h.scan(t, 0)

	file := h.files(t)[0]
	if file.Match == nil || file.Match.MediaRef != duneCandidate.MediaRef {
		t.Fatalf("parsed %+v, match %+v: want Dune", file.Parsed, file.Match)
	}
}
