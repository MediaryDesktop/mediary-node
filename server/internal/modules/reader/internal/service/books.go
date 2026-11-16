package service

import (
	"context"
	"path/filepath"
	"strings"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/reader/internal/store"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
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

// keepPosition saves the place where it travels in a backup, and drops the old
// row once it does. A book whose file cannot be read for its content key right
// now keeps its place in the old table instead, so the place is never lost.
func (s *Service) keepPosition(ctx context.Context, book *BookFile, position store.Position) error {
	if s.opts.Positions != nil {
		err := s.opts.Positions.SaveBook(ctx, book, position)
		if err == nil {
			s.dropLegacyPosition(ctx, book.FileID)

			return nil
		}

		if s.opts.Store == nil {
			return err
		}

		s.opts.Logger.Warn().Err(err).Int64("file_id", book.FileID).Msg("could not keep the book's place where backups find it")
	}

	if err := s.opts.Store.SetPosition(ctx, book.FileID, position); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "store book position")
	}

	return nil
}

func (s *Service) dropLegacyPosition(ctx context.Context, fileID int64) {
	if s.opts.Store == nil {
		return
	}

	if err := s.opts.Store.DeletePosition(ctx, fileID); err != nil {
		s.opts.Logger.Debug().Err(err).Int64("file_id", fileID).Msg("could not drop the old book position")
	}
}

// MoveLegacyPositions carries the places kept in the old table over to
// Positions, keeping when each was saved. A book that cannot be moved now — its
// file missing, say — stays for the next start; one the library no longer has
// is dropped, as its row would have been with the file.
func (s *Service) MoveLegacyPositions(ctx context.Context) (moved int, err error) {
	if s.opts.Store == nil || s.opts.Positions == nil {
		return 0, nil
	}

	legacy, err := s.opts.Store.Positions(ctx)
	if err != nil {
		return 0, apperr.Wrap(err, apperr.KindInternal, "read old book positions")
	}

	for _, row := range legacy {
		if ctx.Err() != nil {
			return moved, ctx.Err()
		}

		book, err := s.Book(ctx, row.FileID)
		if apperr.KindOf(err) == apperr.KindNotFound {
			s.dropLegacyPosition(ctx, row.FileID)
			continue
		}
		if err != nil {
			continue
		}

		if err := s.opts.Positions.SaveBook(ctx, book, row.Position); err != nil {
			s.opts.Logger.Debug().Err(err).Int64("file_id", row.FileID).Msg("old book position not moved yet")
			continue
		}

		s.dropLegacyPosition(ctx, row.FileID)
		moved++
	}

	return moved, nil
}

// bookExtension reads "book.fb2.zip" as the FB2 archive it is.
func bookExtension(path string) string {
	lower := strings.ToLower(path)
	if strings.HasSuffix(lower, ".fb2.zip") {
		return ".fbz"
	}

	return filepath.Ext(lower)
}

// Position is the book and where the reader left it: nil for a book never opened.
// A place kept before Positions existed is found in the old table until the
// book is next saved, or until MoveLegacyPositions carries it over.
func (s *Service) Position(ctx context.Context, fileID int64) (*BookFile, *store.Position, error) {
	book, err := s.Book(ctx, fileID)
	if err != nil {
		return nil, nil, err
	}

	if s.opts.Positions != nil {
		position, readErr := s.opts.Positions.Book(ctx, book)
		if readErr != nil {
			s.opts.Logger.Debug().Err(readErr).Int64("file_id", fileID).Msg("could not read where the book was left")
		}

		if position != nil {
			return book, position, nil
		}
	}

	if s.opts.Store == nil {
		return book, nil, nil
	}

	position, err := s.opts.Store.Position(ctx, fileID)
	if err != nil {
		return nil, nil, apperr.Wrap(err, apperr.KindInternal, "read book position")
	}

	return book, position, nil
}

// SavePosition keeps the reader's place and moves the user's list along with it.
// The list is the tracker's: it decides how far a fraction of the book is, and it
// never lowers progress the user already has. A list that cannot be reached does
// not cost the reader its place.
func (s *Service) SavePosition(
	ctx context.Context, fileID int64, locator string, fraction float64,
) (*BookFile, *store.Position, error) {
	book, err := s.Book(ctx, fileID)
	if err != nil {
		return nil, nil, err
	}

	if s.opts.Store == nil && s.opts.Positions == nil {
		return nil, nil, apperr.New(apperr.KindPrecondition, "this node keeps no reading positions")
	}

	if strings.TrimSpace(locator) == "" {
		return nil, nil, apperr.Invalid("locator", "a position needs a locator")
	}

	position := store.Position{Locator: locator, Fraction: min(max(fraction, 0), 1), UpdatedAt: s.now()}
	if err := s.keepPosition(ctx, book, position); err != nil {
		return nil, nil, err
	}

	if book.MediaRef != "" && s.opts.Progress != nil {
		if err := s.opts.Progress.MarkReadFraction(ctx, book.MediaRef, position.Fraction); err != nil {
			s.opts.Logger.Warn().Err(err).Str("media_ref", book.MediaRef).Msg("record reading progress")
		}
	}

	return book, &position, nil
}
