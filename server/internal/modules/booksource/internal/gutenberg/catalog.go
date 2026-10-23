// Package gutenberg is Project Gutenberg as a source of books: its catalogue,
// kept on the node and searched there, and a book's EPUB, fetched when the user
// asks for it.
package gutenberg

import (
	"compress/gzip"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	// The catalogue is 6 MB compressed and 21 MB as CSV; the caps leave room to
	// grow and stop a broken or hostile file long before it fills the disk.
	maxCatalogBytes  = 64 << 20
	maxExpandedBytes = 256 << 20

	// Fewer books than this is a catalogue cut short, not Gutenberg shrinking.
	minCatalogBooks = 1000

	maxTitleRunes   = 500
	maxAuthorsRunes = 1000
)

// Book is one book of the catalogue, as the node keeps it.
type Book struct {
	ID       int64
	Title    string
	Authors  []string
	Language string
}

// ParseCatalog reads the catalogue's compressed CSV: the books (Type Text) with
// their titles, authors and languages. Audio books, images and data sets are
// left out.
func ParseCatalog(compressed io.Reader) ([]Book, error) {
	limited := &capReader{r: io.LimitReader(compressed, maxCatalogBytes+1), max: maxCatalogBytes}

	unzipped, err := gzip.NewReader(limited)
	if err != nil {
		return nil, fmt.Errorf("the catalogue is not a gzip file: %w", err)
	}
	defer func() { _ = unzipped.Close() }()

	reader := csv.NewReader(&capReader{r: io.LimitReader(unzipped, maxExpandedBytes+1), max: maxExpandedBytes})
	reader.FieldsPerRecord = -1
	reader.ReuseRecord = true

	header, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("read the catalogue's header: %w", err)
	}

	columns, err := columnsOf(header)
	if err != nil {
		return nil, err
	}

	books := make([]Book, 0, 80_000)
	for {
		record, readErr := reader.Read()
		if errors.Is(readErr, io.EOF) {
			break
		}
		if readErr != nil {
			return nil, fmt.Errorf("read the catalogue: %w", readErr)
		}

		if book, ok := columns.book(record); ok {
			books = append(books, book)
		}
	}

	if len(books) < minCatalogBooks {
		return nil, fmt.Errorf("the catalogue has %d books, too few to be whole", len(books))
	}

	return books, nil
}

type columns struct {
	id, kind, title, language, authors int
}

func columnsOf(header []string) (columns, error) {
	index := map[string]int{}
	for i, name := range header {
		index[strings.TrimSpace(strings.TrimPrefix(name, "\ufeff"))] = i
	}

	var cols columns
	for _, column := range []struct {
		name string
		at   *int
	}{
		{"Text#", &cols.id}, {"Type", &cols.kind}, {"Title", &cols.title}, {"Language", &cols.language}, {"Authors", &cols.authors},
	} {
		i, ok := index[column.name]
		if !ok {
			return columns{}, fmt.Errorf("the catalogue has no %s column", column.name)
		}
		*column.at = i
	}

	return cols, nil
}

func (c columns) book(record []string) (Book, bool) {
	field := func(i int) string {
		if i < len(record) {
			return record[i]
		}
		return ""
	}

	if field(c.kind) != "Text" {
		return Book{}, false
	}

	id, err := strconv.ParseInt(strings.TrimSpace(field(c.id)), 10, 64)
	if err != nil || id <= 0 {
		return Book{}, false
	}

	title := cut(oneLine(field(c.title)), maxTitleRunes)
	if title == "" {
		return Book{}, false
	}

	return Book{
		ID:       id,
		Title:    title,
		Authors:  AuthorsOf(field(c.authors)),
		Language: strings.TrimSpace(field(c.language)),
	}, true
}

// oneLine joins a title and its subtitle, which the catalogue puts on separate
// lines: "Lincoln's Gettysburg Address: Given November 19, 1863…".
func oneLine(title string) string {
	lines := strings.FieldsFunc(title, func(r rune) bool { return r == '\n' || r == '\r' })

	parts := make([]string, 0, len(lines))
	for _, line := range lines {
		if line = strings.Join(strings.Fields(line), " "); line != "" {
			parts = append(parts, line)
		}
	}

	return strings.Join(parts, ": ")
}

// AuthorsOf turns the catalogue's authors into names as people read them:
// "Tolstoy, Leo, graf, 1828-1910; Maude, Aylmer, 1858-1938 [Translator]" is
// "Leo Tolstoy". Translators, illustrators, editors and the rest who did not
// write the book are left out; an organisation keeps its name as it is.
func AuthorsOf(raw string) []string {
	var names []string

	for _, person := range strings.Split(raw, ";") {
		person = strings.TrimSpace(person)
		if person == "" || strings.Contains(person, "[") {
			continue
		}

		if name := nameOf(person); name != "" {
			names = append(names, name)
		}
	}

	return names
}

// nameOf reads "Last, First (Full First), title, years" as "First Last".
func nameOf(person string) string {
	parts := strings.Split(withoutParentheses(person), ",")

	kept := make([]string, 0, 2)
	for _, part := range parts {
		part = strings.Join(strings.Fields(part), " ")
		if part == "" || strings.ContainsFunc(part, unicode.IsDigit) {
			continue
		}
		kept = append(kept, part)
	}

	switch len(kept) {
	case 0:
		return ""
	case 1:
		return kept[0]
	default:
		// Titles after the given names — "graf", "Sir" — are not part of the name.
		return kept[1] + " " + kept[0]
	}
}

func withoutParentheses(s string) string {
	var b strings.Builder

	depth := 0
	for _, r := range s {
		switch {
		case r == '(':
			depth++
		case r == ')' && depth > 0:
			depth--
		case depth == 0:
			b.WriteRune(r)
		}
	}

	return b.String()
}

func cut(s string, maxRunes int) string {
	if utf8.RuneCountInString(s) <= maxRunes {
		return s
	}

	return strings.TrimSpace(string([]rune(s)[:maxRunes]))
}

// capReader fails a read that goes past max bytes, so an oversized file is an
// error rather than a catalogue silently cut short.
type capReader struct {
	r    io.Reader
	max  int64
	read int64
}

func (c *capReader) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	c.read += int64(n)

	if c.read > c.max {
		return n, fmt.Errorf("the catalogue is larger than %d MB", c.max>>20)
	}

	return n, err
}
