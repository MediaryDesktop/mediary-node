package prober

import (
	"archive/zip"
	"encoding/xml"
	"errors"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"

	"golang.org/x/net/html/charset"
)

// BookVersion is the BookInfo counterpart of Version: bumped when the reader
// learns a format or a field, so books already scanned are read again without
// re-reading every video in the library.
const BookVersion = 2

// An OPF package or an FB2 header past this is not metadata any more.
const maxMetadataBytes = 2 << 20

// BookInfo is what a book file says about itself: far better evidence than its
// name, which is whatever the person who saved it typed.
type BookInfo struct {
	Title   string
	Authors []string
	// ISBN is the first identifier that reads as one, digits only.
	ISBN string
}

func (b BookInfo) Empty() bool {
	return b.Title == "" && len(b.Authors) == 0 && b.ISBN == ""
}

var bookReaders = map[string]func(string) (BookInfo, error){
	".epub": epubInfo,
	".fb2":  fb2Info,
}

// Book reads a book file's own metadata. The second result is false for a format
// the reader does not know — PDF, MOBI, DJVU are matched by their names — and
// for a file it cannot read, neither of which is worth failing a scan over.
func Book(filePath string) (BookInfo, bool) {
	read, ok := bookReaders[strings.ToLower(filepath.Ext(filePath))]
	if !ok {
		return BookInfo{}, false
	}

	info, err := read(filePath)
	if err != nil || info.Empty() {
		return BookInfo{}, false
	}

	return info, true
}

var errNoPackage = errors.New("no OPF package")

// epubInfo follows META-INF/container.xml to the OPF package and reads its Dublin
// Core: dc:title, every dc:creator, and a dc:identifier that is an ISBN.
func epubInfo(filePath string) (BookInfo, error) {
	archive, err := zip.OpenReader(filePath)
	if err != nil {
		return BookInfo{}, err
	}
	defer func() { _ = archive.Close() }()

	var container struct {
		Rootfiles []struct {
			FullPath string `xml:"full-path,attr"`
		} `xml:"rootfiles>rootfile"`
	}

	if err := decodeEntry(&archive.Reader, "META-INF/container.xml", &container); err != nil {
		return BookInfo{}, err
	}
	if len(container.Rootfiles) == 0 {
		return BookInfo{}, errNoPackage
	}

	var opf struct {
		Titles      []string `xml:"metadata>title"`
		Creators    []string `xml:"metadata>creator"`
		Identifiers []struct {
			Scheme string `xml:"scheme,attr"`
			Value  string `xml:",chardata"`
		} `xml:"metadata>identifier"`
	}

	if err := decodeEntry(&archive.Reader, path.Clean(container.Rootfiles[0].FullPath), &opf); err != nil {
		return BookInfo{}, err
	}

	info := BookInfo{Authors: cleanNames(opf.Creators)}
	if len(opf.Titles) > 0 {
		info.Title = cleanText(opf.Titles[0])
	}

	for _, identifier := range opf.Identifiers {
		if isbn := isbnOf(identifier.Value, strings.EqualFold(identifier.Scheme, "isbn")); isbn != "" {
			info.ISBN = isbn
			break
		}
	}

	return info, nil
}

func decodeEntry(archive *zip.Reader, name string, out any) error {
	for _, entry := range archive.File {
		if entry.Name != name {
			continue
		}

		reader, err := entry.Open()
		if err != nil {
			return err
		}

		err = xml.NewDecoder(io.LimitReader(reader, maxMetadataBytes)).Decode(out)
		_ = reader.Close()

		return err
	}

	return errNoPackage
}

// fb2Info reads FictionBook's title-info and publish-info. They come first; the
// body and the images embedded after them are never read.
func fb2Info(filePath string) (BookInfo, error) {
	file, err := os.Open(filePath) //nolint:gosec // a library file the user pointed the node at
	if err != nil {
		return BookInfo{}, err
	}
	defer func() { _ = file.Close() }()

	var description struct {
		Title   string `xml:"title-info>book-title"`
		Authors []struct {
			First  string `xml:"first-name"`
			Middle string `xml:"middle-name"`
			Last   string `xml:"last-name"`
		} `xml:"title-info>author"`
		ISBN string `xml:"publish-info>isbn"`
	}

	decoder := xml.NewDecoder(io.LimitReader(file, maxMetadataBytes))
	// FB2 files from the Russian-language web are often windows-1251.
	decoder.CharsetReader = charset.NewReaderLabel

	for {
		token, err := decoder.Token()
		if err != nil {
			return BookInfo{}, err
		}

		start, ok := token.(xml.StartElement)
		if !ok || start.Name.Local != "description" {
			continue
		}

		if err := decoder.DecodeElement(&description, &start); err != nil {
			return BookInfo{}, err
		}

		break
	}

	info := BookInfo{Title: cleanText(description.Title), ISBN: isbnOf(description.ISBN, true)}

	for _, author := range description.Authors {
		name := strings.Join(strings.Fields(author.First+" "+author.Middle+" "+author.Last), " ")
		if name != "" {
			info.Authors = append(info.Authors, name)
		}
	}

	return info, nil
}

// isbnOf reads an ISBN out of an identifier: "urn:isbn:978…", "ISBN 0-441-…", or a
// bare number when the scheme already says it is one. Anything else — a UUID, a
// publisher's own code — is not.
func isbnOf(raw string, declared bool) string {
	text := strings.TrimSpace(raw)
	lower := strings.ToLower(text)

	switch {
	case strings.HasPrefix(lower, "urn:isbn:"):
		text = text[len("urn:isbn:"):]
	case strings.HasPrefix(lower, "isbn"):
		text = strings.TrimLeft(text[len("isbn"):], ": ")
	case !declared:
		return ""
	}

	digits := strings.Map(func(r rune) rune {
		switch {
		case r >= '0' && r <= '9':
			return r
		case r == 'X' || r == 'x':
			return 'X'
		case r == '-' || r == ' ':
			return -1
		default:
			return '?'
		}
	}, text)

	if strings.ContainsRune(digits, '?') || (len(digits) != 10 && len(digits) != 13) {
		return ""
	}

	return digits
}

func cleanText(text string) string {
	return strings.Join(strings.Fields(text), " ")
}

func cleanNames(names []string) []string {
	cleaned := make([]string, 0, len(names))

	for _, name := range names {
		if name = cleanText(name); name != "" {
			cleaned = append(cleaned, name)
		}
	}

	return cleaned
}
