package gutenberg

import (
	"bytes"
	"compress/gzip"
	"fmt"
	"strings"
	"testing"
)

// Rows as the catalogue has them, from the file of 18 October 2026.
const catalogRows = `84,Text,1993-10-01,"Frankenstein; or, the modern prometheus",en,"Shelley, Mary Wollstonecraft, 1797-1851","Science fiction; Horror tales",PR,Gothic Fiction
2,Text,1972-12-01,"The United States Bill of Rights
The Ten Original Amendments to the Constitution of the United States",en,United States,Civil rights -- United States -- Sources,JK; KF,Politics
2600,Text,2001-04-01,War and Peace,en,"Tolstoy, Leo, graf, 1828-1910; Maude, Aylmer, 1858-1938 [Translator]; Maude, Louise, 1855-1939 [Translator]",Napoleonic Wars,PG,Classics
10000,Sound,2003-09-01,The Magna Carta,en,Anonymous,,,
`

func catalogFile(t *testing.T, header, rows string, filler int) []byte {
	t.Helper()

	var csv strings.Builder
	csv.WriteString(header + "\n" + rows)
	for i := range filler {
		fmt.Fprintf(&csv, "%d,Text,2020-01-01,Filler %d,en,\"Author, Some, 1900-1980\",,,\n", 50_000+i, i)
	}

	var compressed bytes.Buffer
	writer := gzip.NewWriter(&compressed)
	if _, err := writer.Write([]byte(csv.String())); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	return compressed.Bytes()
}

const catalogHeader = "Text#,Type,Issued,Title,Language,Authors,Subjects,LoCC,Bookshelves"

func TestParseCatalog(t *testing.T) {
	books, err := ParseCatalog(bytes.NewReader(catalogFile(t, catalogHeader, catalogRows, minCatalogBooks)))
	if err != nil {
		t.Fatal(err)
	}

	// The audio book is left out.
	if len(books) != 3+minCatalogBooks {
		t.Fatalf("%d books", len(books))
	}

	byID := map[int64]Book{}
	for _, book := range books {
		byID[book.ID] = book
	}

	for id, want := range map[int64]Book{
		84:   {ID: 84, Title: "Frankenstein; or, the modern prometheus", Authors: []string{"Mary Wollstonecraft Shelley"}, Language: "en"},
		2:    {ID: 2, Title: "The United States Bill of Rights: The Ten Original Amendments to the Constitution of the United States", Authors: []string{"United States"}, Language: "en"},
		2600: {ID: 2600, Title: "War and Peace", Authors: []string{"Leo Tolstoy"}, Language: "en"},
	} {
		got := byID[id]
		if got.Title != want.Title || strings.Join(got.Authors, "|") != strings.Join(want.Authors, "|") || got.Language != want.Language {
			t.Errorf("book %d = %+v, want %+v", id, got, want)
		}
	}
	if _, ok := byID[10000]; ok {
		t.Error("an audio book is in the catalogue")
	}
}

// The header may start with a byte-order mark, and the columns may move.
func TestParseCatalogReadsColumnsByName(t *testing.T) {
	header := "\ufeffType,Text#,Title,Authors,Language"
	rows := "Text,84,Frankenstein,\"Shelley, Mary Wollstonecraft, 1797-1851\",en\n"

	books, err := ParseCatalog(bytes.NewReader(catalogFile(t, header, rows, 0)))
	if err == nil || !strings.Contains(err.Error(), "too few") {
		t.Fatalf("books %d, err %v", len(books), err)
	}

	var csv strings.Builder
	csv.WriteString(rows)
	for i := range minCatalogBooks {
		fmt.Fprintf(&csv, "Text,%d,Filler,Anonymous,en\n", 100+i)
	}

	books, err = ParseCatalog(bytes.NewReader(catalogFile(t, header, csv.String(), 0)))
	if err != nil {
		t.Fatal(err)
	}
	if books[0].ID != 84 || books[0].Title != "Frankenstein" || books[0].Authors[0] != "Mary Wollstonecraft Shelley" {
		t.Errorf("first book = %+v", books[0])
	}
}

func TestParseCatalogRefusesWhatIsNotACatalogue(t *testing.T) {
	if _, err := ParseCatalog(strings.NewReader("<html>Blocked</html>")); err == nil {
		t.Error("an HTML page was read as a catalogue")
	}

	file := catalogFile(t, "Text#,Title,Language", "84,Frankenstein,en\n", 0)
	if _, err := ParseCatalog(bytes.NewReader(file)); err == nil || !strings.Contains(err.Error(), "no Type column") {
		t.Errorf("a catalogue without its columns: %v", err)
	}
}

func TestCapReaderFailsPastTheCap(t *testing.T) {
	reader := &capReader{r: strings.NewReader(strings.Repeat("x", 10)), max: 4}

	var out bytes.Buffer
	if _, err := out.ReadFrom(reader); err == nil {
		t.Error("read past the cap")
	}
}

func TestAuthorsOf(t *testing.T) {
	for raw, want := range map[string]string{
		"Shelley, Mary Wollstonecraft, 1797-1851":                                         "Mary Wollstonecraft Shelley",
		"Tolstoy, Leo, graf, 1828-1910; Garnett, Constance, 1861-1946 [Translator]":       "Leo Tolstoy",
		"Doyle, Arthur Conan, 1859-1930":                                                  "Arthur Conan Doyle",
		"Wells, H. G. (Herbert George), 1866-1946":                                        "H. G. Wells",
		"Twain, Mark, 1835-1910; Kemble, E. W. (Edward Windsor), 1861-1933 [Illustrator]": "Mark Twain",
		"Kafka, Franz, 1883-1924; Wyllie, David (Translator) [Translator]":                "Franz Kafka",
		"Gerstenberg, Alice, 1885-1972; Carroll, Lewis, 1832-1898":                        "Alice Gerstenberg|Lewis Carroll",
		"United States. Central Intelligence Agency":                                      "United States. Central Intelligence Agency",
		"Homer, 751? BCE-651? BCE":                                                        "Homer",
		"Various; Lang, Andrew, 1844-1912 [Editor]":                                       "Various",
		"Lang, Andrew, 1844-1912 [Editor]":                                                "",
		"":                                                                                "",
	} {
		if got := strings.Join(AuthorsOf(raw), "|"); got != want {
			t.Errorf("AuthorsOf(%q) = %q, want %q", raw, got, want)
		}
	}
}
