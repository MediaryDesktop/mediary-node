package app

import (
	"context"
	"fmt"
	"strings"
	"unicode"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/openlibrary"
)

var _ library.ISBNResolver = titleSource{}

// How many books a scan fetches the details of; see titleSource.Matched.
const warmedBooks = 20

func (s titleSource) searchBooks(ctx context.Context, query string) ([]library.TitleCandidate, error) {
	if s.openLibrary == nil {
		return nil, nil
	}

	page, err := s.openLibrary.Search(ctx, openlibrary.SearchParams{Query: freeText(query), Limit: searchCandidates})
	if err != nil {
		return nil, fmt.Errorf("search open library: %w", err)
	}

	candidates := make([]library.TitleCandidate, 0, len(page.Docs))
	for i := range page.Docs {
		if candidate, ok := bookCandidate(&page.Docs[i]); ok {
			candidates = append(candidates, candidate)
		}
	}

	return candidates, nil
}

// ByISBN names the work an ISBN is an edition of. Open Library keeps editions
// apart from works; the library matches files to works, as the user tracks them.
func (s titleSource) ByISBN(ctx context.Context, isbn string) (*library.TitleCandidate, error) {
	if s.openLibrary == nil {
		return nil, nil
	}

	edition, err := s.openLibrary.EditionByISBN(ctx, isbn)
	if err != nil {
		return nil, fmt.Errorf("find edition %s: %w", isbn, err)
	}

	workID := edition.WorkID()
	if !openlibrary.ValidWorkID(workID) {
		return nil, nil
	}

	doc, err := s.openLibrary.WorkDoc(ctx, workID)
	if err != nil {
		return nil, fmt.Errorf("read work %s: %w", workID, err)
	}

	candidate, ok := bookCandidate(doc)
	if !ok {
		return nil, nil
	}

	return &candidate, nil
}

func bookCandidate(doc *openlibrary.Doc) (library.TitleCandidate, bool) {
	workID := doc.WorkID()
	if !openlibrary.ValidWorkID(workID) || doc.Title == "" {
		return library.TitleCandidate{}, false
	}

	titles := []string{doc.Title}
	if doc.Subtitle != "" {
		titles = append(titles, doc.Title+" "+doc.Subtitle)
	}

	return library.TitleCandidate{
		MediaRef:   "openlibrary:" + workID,
		Titles:     titles,
		Format:     "BOOK",
		Year:       doc.FirstPublishYear,
		Authors:    doc.AuthorName,
		CoverImage: openlibrary.CoverURL(doc.CoverID, "L"),
	}, true
}

// freeText keeps only the words of a file's name. Open Library reads the rest as
// its query language: the dash in "Ray Bradbury - Fahrenheit 451" excludes every
// book that mentions Fahrenheit.
func freeText(query string) string {
	return strings.Join(strings.FieldsFunc(query, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r) && r != '\''
	}), " ")
}
