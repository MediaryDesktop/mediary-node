// Package opds reads OPDS 1.2 catalogues — Komga, Kavita, Calibre-Web — and the
// Page Streaming Extension that serves a chapter one page at a time.
package opds

import (
	"encoding/xml"
	"fmt"
	"io"
	"regexp"
	"strings"
)

const (
	RelSearch      = "search"
	RelNext        = "next"
	RelSubsection  = "subsection"
	RelAcquisition = "http://opds-spec.org/acquisition"
	RelPSEStream   = "http://vaemendis.net/opds-pse/stream"
)

type Feed struct {
	ID      string  `xml:"id"`
	Title   string  `xml:"title"`
	Links   []Link  `xml:"link"`
	Entries []Entry `xml:"entry"`
}

type Entry struct {
	ID      string `xml:"id"`
	Title   string `xml:"title"`
	Updated string `xml:"updated"`
	Links   []Link `xml:"link"`
}

type Link struct {
	Rel  string `xml:"rel,attr"`
	Type string `xml:"type,attr"`
	Href string `xml:"href,attr"`
	// Count is the number of pages, on a page-streaming link.
	Count int `xml:"http://vaemendis.net/opds-pse/ns count,attr"`
}

// ParseFeed reads an Atom feed. Anything that is not one is refused, so a login
// page or an error page is never read as an empty catalogue.
func ParseFeed(r io.Reader) (*Feed, error) {
	var feed struct {
		XMLName xml.Name
		Feed
	}

	if err := xml.NewDecoder(r).Decode(&feed); err != nil {
		return nil, fmt.Errorf("%w: %w", ErrNotOPDS, err)
	}
	if feed.XMLName.Local != "feed" || feed.XMLName.Space != "http://www.w3.org/2005/Atom" {
		return nil, fmt.Errorf("%w: the document is <%s>, not an Atom feed", ErrNotOPDS, feed.XMLName.Local)
	}

	return &feed.Feed, nil
}

// Link returns the first link with the relation, and whether there was one.
func (f *Feed) Link(rel string) (Link, bool) {
	return findLink(f.Links, rel)
}

func (e *Entry) Link(rel string) (Link, bool) {
	return findLink(e.Links, rel)
}

func findLink(links []Link, rel string) (Link, bool) {
	for _, link := range links {
		if link.Rel == rel {
			return link, true
		}
	}

	return Link{}, false
}

// IsCatalogue says whether a link leads to another feed rather than a file.
func (l Link) IsCatalogue() bool {
	return strings.HasPrefix(l.Type, "application/atom+xml")
}

// openSearch is an OpenSearch description; only the Atom URL template matters.
type openSearch struct {
	XMLName xml.Name `xml:"OpenSearchDescription"`
	URLs    []struct {
		Type     string `xml:"type,attr"`
		Template string `xml:"template,attr"`
	} `xml:"Url"`
}

func parseOpenSearch(r io.Reader) (string, error) {
	var doc openSearch
	if err := xml.NewDecoder(r).Decode(&doc); err != nil {
		return "", fmt.Errorf("%w: search description: %w", ErrNotOPDS, err)
	}

	for _, u := range doc.URLs {
		if strings.HasPrefix(u.Type, "application/atom+xml") && strings.Contains(u.Template, "{searchTerms}") {
			return u.Template, nil
		}
	}

	return "", fmt.Errorf("%w: the search description has no Atom template", ErrNoSearch)
}

var (
	numberedChapter = regexp.MustCompile(`(?i)(?:\bch(?:apter|\.)?|#)\s*(\d+(?:\.\d+)?)`)
	trailingNumber  = regexp.MustCompile(`(\d+(?:\.\d+)?)\s*$`)
)

// ChapterNumber reads a chapter number out of an entry title, as an OPDS feed has
// no field for it: "Berserk Chapter 12", "Vol. 2 Ch. 13.5", "Berserk 014". An
// explicit chapter marker wins over a trailing number, so the volume of
// "Vol. 2 Ch. 13" is not taken for the chapter.
func ChapterNumber(title string) string {
	if match := numberedChapter.FindStringSubmatch(title); match != nil {
		return trimZeros(match[1])
	}
	if match := trailingNumber.FindStringSubmatch(title); match != nil {
		return trimZeros(match[1])
	}

	return ""
}

func trimZeros(number string) string {
	whole, fraction, dotted := strings.Cut(number, ".")

	whole = strings.TrimLeft(whole, "0")
	if whole == "" {
		whole = "0"
	}
	if !dotted {
		return whole
	}

	return whole + "." + fraction
}
