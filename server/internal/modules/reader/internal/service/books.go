package service

import (
	"context"
	"path/filepath"
	"strings"

	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// bookTypes are the formats the renderer opens, with the type each is served as.
// The renderer reads the format from the bytes as well, but a PDF goes to another
// viewer than an EPUB and the type is how it tells.
var bookTypes = map[string]string{
	".epub": "application/epub+zip",
	".fb2":  "application/x-fictionbook+xml",
	".fbz":  "application/x-zip-compressed-fb2",
	".mobi": "application/x-mobipocket-ebook",
	".azw":  "application/vnd.amazon.ebook",
	".azw3": "application/vnd.amazon.ebook",
	".pdf":  "application/pdf",
}

// BookFile is a library book the renderer can open.
type BookFile struct {
	FileID      int64
	Path        string
	Title       string
	MediaRef    string
	ContentType string
}

func (s *Service) Book(ctx context.Context, fileID int64) (*BookFile, error) {
	if s.opts.Library == nil {
		return nil, apperr.New(apperr.KindPrecondition, "the library is not available on this node")
	}

	file, err := s.opts.Library.Playable(ctx, fileID)
	if err != nil {
		return nil, err
	}
	if file == nil {
		return nil, apperr.New(apperr.KindNotFound, "library file %d does not exist", fileID)
	}
	if file.Missing {
		return nil, apperr.New(apperr.KindPrecondition,
			"the last scan did not find %s where it used to be", file.Path)
	}

	contentType, ok := bookTypes[bookExtension(file.Path)]
	if !ok {
		return nil, apperr.New(apperr.KindPrecondition, "%s is not a book the reader opens", filepath.Base(file.Path))
	}

	return &BookFile{
		FileID:      file.ID,
		Path:        file.Path,
		Title:       file.Title,
		MediaRef:    file.MediaRef,
		ContentType: contentType,
	}, nil
}

// bookExtension reads "book.fb2.zip" as the FB2 archive it is.
func bookExtension(path string) string {
	lower := strings.ToLower(path)
	if strings.HasSuffix(lower, ".fb2.zip") {
		return ".fbz"
	}

	return filepath.Ext(lower)
}

// Position is where the reader left the book: nil for a book never opened.
func (s *Service) Position(ctx context.Context, fileID int64) (*store.Position, error) {
	if _, err := s.Book(ctx, fileID); err != nil {
		return nil, err
	}

	if s.opts.Store == nil {
		return nil, apperr.New(apperr.KindPrecondition, "this node keeps no reading positions")
	}

	position, err := s.opts.Store.Position(ctx, fileID)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read book position")
	}

	return position, nil
}

// SavePosition keeps the reader's place and moves the user's list along with it.
// The list is the tracker's: it decides how far a fraction of the book is, and it
// never lowers progress the user already has. A list that cannot be reached does
// not cost the reader its place.
func (s *Service) SavePosition(ctx context.Context, fileID int64, locator string, fraction float64) (*store.Position, error) {
	book, err := s.Book(ctx, fileID)
	if err != nil {
		return nil, err
	}

	if s.opts.Store == nil {
		return nil, apperr.New(apperr.KindPrecondition, "this node keeps no reading positions")
	}

	if strings.TrimSpace(locator) == "" {
		return nil, apperr.Invalid("locator", "a position needs a locator")
	}

	position := store.Position{Locator: locator, Fraction: min(max(fraction, 0), 1), UpdatedAt: s.now()}
	if err := s.opts.Store.SetPosition(ctx, fileID, position); err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "store book position")
	}

	if book.MediaRef != "" && s.opts.Progress != nil {
		if err := s.opts.Progress.MarkReadFraction(ctx, book.MediaRef, position.Fraction); err != nil {
			s.opts.Logger.Warn().Err(err).Str("media_ref", book.MediaRef).Msg("record reading progress")
		}
	}

	return &position, nil
}
