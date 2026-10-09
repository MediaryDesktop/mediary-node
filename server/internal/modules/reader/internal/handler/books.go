package handler

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"

	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/service"
	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/store"
)

type BookPosition struct {
	Locator   string    `json:"locator" doc:"Where the reader is, in the renderer's own terms: an EPUB CFI, or a PDF page."`
	Fraction  float64   `json:"fraction" minimum:"0" maximum:"1" doc:"How far through the book that is, from 0 to 1."`
	UpdatedAt time.Time `json:"updated_at" doc:"When the reader was last there."`
}

type BookInfo struct {
	FileID      int64  `json:"file_id" doc:"Library file the book is."`
	Title       string `json:"title" doc:"The book's name as the library knows it."`
	MediaRef    string `json:"media_ref,omitempty" doc:"Title the book is matched to; absent while unmatched, and then reading moves no list."`
	ContentType string `json:"content_type" doc:"The type getReaderBook serves the bytes as, which picks the viewer."`
}

type BookPositionOutput struct {
	Body struct {
		Book     BookInfo      `json:"book" doc:"The book being read."`
		Position *BookPosition `json:"position" doc:"Where the reader left the book; null for a book never opened."`
	}
}

type BookPositionInput struct {
	ID   int64 `path:"id" doc:"Library file being read."`
	Body struct {
		Locator  string  `json:"locator" minLength:"1" maxLength:"4096" doc:"Where the reader is, in the renderer's own terms."`
		Fraction float64 `json:"fraction" minimum:"0" maximum:"1" doc:"How far through the book that is, from 0 to 1."`
	}
}

func (h *Handler) registerBooks(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "getReaderBook",
		Method:      http.MethodGet,
		Path:        "/v1/reader/files/{id}/book",
		Summary:     "The bytes of a book",
		Description: "A library book as it is on disk — EPUB, FB2, MOBI, AZW3 or PDF — with range support, for the renderer to lay out itself. Its type tells the renderer which viewer to open it in.",
		Tags:        []string{"reader"},
	}, func(ctx context.Context, in *FileInput) (*huma.StreamResponse, error) {
		book, err := h.svc.Book(ctx, in.ID)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &huma.StreamResponse{Body: func(hctx huma.Context) {
			serveFile(hctx, book.Path, book.ContentType)
		}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getReaderBookPosition",
		Method:      http.MethodGet,
		Path:        "/v1/reader/files/{id}/book/position",
		Summary:     "The book to open, and where it was left",
		Description: "What the reader needs before the bytes: the book's name and type, and the place to open it at — kept per file, since a locator from one file means nothing in another edition.",
		Tags:        []string{"reader"},
	}, func(ctx context.Context, in *FileInput) (*BookPositionOutput, error) {
		book, position, err := h.svc.Position(ctx, in.ID)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return positionOutput(book, position), nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "saveReaderBookPosition",
		Method:      http.MethodPut,
		Path:        "/v1/reader/files/{id}/book/position",
		Summary:     "Keep the reader's place in a book",
		Description: "Stores the place and, for a matched book, moves the user's list to the share of the work's pages read; the last pages finish it. Progress is never lowered.",
		Tags:        []string{"reader"},
	}, func(ctx context.Context, in *BookPositionInput) (*BookPositionOutput, error) {
		book, position, err := h.svc.SavePosition(ctx, in.ID, in.Body.Locator, in.Body.Fraction)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return positionOutput(book, position), nil
	})
}

func positionOutput(book *service.BookFile, position *store.Position) *BookPositionOutput {
	out := &BookPositionOutput{}
	out.Body.Book = BookInfo{
		FileID:      book.FileID,
		Title:       book.Title,
		MediaRef:    book.MediaRef,
		ContentType: book.ContentType,
	}

	if position != nil {
		out.Body.Position = &BookPosition{
			Locator:   position.Locator,
			Fraction:  position.Fraction,
			UpdatedAt: position.UpdatedAt,
		}
	}

	return out
}

func serveFile(hctx huma.Context, path, contentType string) {
	r, w := humachi.Unwrap(hctx)

	file, err := os.Open(path) //nolint:gosec // a library file resolved by id, never a path the client chose
	if err != nil {
		http.Error(w, "the file cannot be opened", http.StatusNotFound)
		return
	}
	defer func() { _ = file.Close() }()

	stat, err := file.Stat()
	if err != nil {
		http.Error(w, "the file cannot be read", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", contentType)
	http.ServeContent(w, r, filepath.Base(path), stat.ModTime(), file)
}
