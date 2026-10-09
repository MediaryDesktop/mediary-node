package app

import (
	"context"
	"fmt"
	"strings"
	"unicode"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/googlebooks"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/openlibrary"
)

var _ library.ISBNResolver = titleSource{}

// How many books a scan fetches the details of; see titleSource.Matched.
const warmedBooks = 20

func (s titleSource) searchBooks(ctx context.Context, query string) ([]library.TitleCandidate, error) {
	text := freeText(query)

	var (
		candidates []library.TitleCandidate
		olErr      error
	)

	if s.openLibrary != nil {
		page, err := s.openLibrary.Search(ctx, openlibrary.SearchParams{Query: text, Limit: searchCandidates})
		if err != nil {
			olErr = fmt.Errorf("search open library: %w", err)
		} else {
			for i := range page.Docs {
				if candidate, ok := bookCandidate(&page.Docs[i]); ok {
					candidates = append(candidates, candidate)
				}
			}
		}
	}

	// Open Library is thin on books outside English, and a scan asks once per
	// title, so a name in another script is worth Google's quota as well.
	if s.googleBooks != nil && (len(candidates) == 0 || !latin(text)) {
		page, err := s.googleBooks.Search(ctx, googlebooks.SearchParams{Query: text, MaxResults: searchCandidates})
		if err != nil {
			if len(candidates) == 0 {
				return nil, fmt.Errorf("search google books: %w", err)
			}

			return candidates, nil
		}

		for i := range page.Items {
			if candidate, ok := volumeCandidate(&page.Items[i]); ok {
				candidates = append(candidates, candidate)
			}
		}
	}

	if len(candidates) == 0 && olErr != nil {
		return nil, olErr
	}

	return candidates, nil
}

// ByISBN names the book an ISBN belongs to: the Open Library work it is an
// edition of — the library matches files to works, as the user tracks them — or,
// when Open Library does not know the ISBN, the Google Books volume.
func (s titleSource) ByISBN(ctx context.Context, isbn string) (*library.TitleCandidate, error) {
	found, olErr := s.openLibraryByISBN(ctx, isbn)
	if found != nil || s.googleBooks == nil {
		return found, olErr
	}

	volume, err := s.googleBooks.ByISBN(ctx, isbn)
	if err != nil {
		return nil, fmt.Errorf("find google books volume %s: %w", isbn, err)
	}
	if volume == nil {
		return nil, olErr
	}

	candidate, ok := volumeCandidate(volume)
	if !ok {
		return nil, olErr
	}

	return &candidate, nil
}

func (s titleSource) openLibraryByISBN(ctx context.Context, isbn string) (*library.TitleCandidate, error) {
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

func volumeCandidate(volume *googlebooks.Volume) (library.TitleCandidate, bool) {
	info := &volume.VolumeInfo
	if !googlebooks.ValidVolumeID(volume.ID) || info.Title == "" {
		return library.TitleCandidate{}, false
	}

	titles := []string{info.Title}
	if info.Subtitle != "" {
		titles = append(titles, info.Title+" "+info.Subtitle)
	}

	return library.TitleCandidate{
		MediaRef:   "googlebooks:" + volume.ID,
		Titles:     titles,
		Format:     "BOOK",
		Year:       info.Year(),
		Authors:    info.Authors,
		CoverImage: info.ImageLinks.Cover(),
	}, true
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
