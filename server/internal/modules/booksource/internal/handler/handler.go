package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/download"
	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/service"
	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/store"
)

type Handler struct {
	svc   *service.Service
	queue *download.Queue
}

func New(svc *service.Service, queue *download.Queue) *Handler {
	return &Handler{svc: svc, queue: queue}
}

type BookSource struct {
	ID   string `json:"id" example:"gutenberg" doc:"The prefix of the source's edition references."`
	Name string `json:"name" example:"Project Gutenberg"`
}

type BookSourcesOutput struct {
	Body struct {
		Sources []BookSource `json:"sources" doc:"The sources the node searches; empty while none is set up."`
	}
}

type BookFormat struct {
	Type string `json:"type" example:"application/epub+zip" doc:"Pass as format to download the copy in it."`
	Ext  string `json:"ext" example:".epub"`
	Size int64  `json:"size,omitempty" doc:"Bytes, when the source says."`
}

type BookEdition struct {
	Ref      string       `json:"ref" example:"gutenberg:84" doc:"Pass as edition_ref to download it, within 30 minutes of the search."`
	Title    string       `json:"title"`
	Authors  []string     `json:"authors"`
	Language string       `json:"language,omitempty"`
	Year     int          `json:"year,omitempty"`
	Source   string       `json:"source" doc:"The source's name."`
	Formats  []BookFormat `json:"formats" doc:"Only the formats the library keeps."`
}

type BookSourceOutcome struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Results int    `json:"results"`
	Error   string `json:"error,omitempty"`
}

type SearchBookEditionsInput struct {
	MediaRef string `query:"media_ref" maxLength:"200" doc:"The book to find copies of, by its title and authors."`
	Query    string `query:"q" maxLength:"500" doc:"Text to search for, in place of or beside media_ref."`
}

type SearchBookEditionsOutput struct {
	Body struct {
		Editions []BookEdition       `json:"editions"`
		Sources  []BookSourceOutcome `json:"sources" doc:"How each source answered; a failed one says why."`
	}
}

type BookDownload struct {
	ID         int64  `json:"id"`
	EditionRef string `json:"edition_ref"`
	Format     string `json:"format"`
	MediaRef   string `json:"media_ref"`
	Title      string `json:"title"`
	Authors    string `json:"authors,omitempty"`
	SourceName string `json:"source_name"`
	State      string `json:"state" enum:"queued,running,done,failed,cancelled"`
	BytesDone  int64  `json:"bytes_done"`
	BytesTotal int64  `json:"bytes_total" doc:"0 while the size is unknown."`
	RelPath    string `json:"rel_path,omitempty" doc:"Where the book is saved, inside the folder for books."`
	FileID     int64  `json:"file_id,omitempty" doc:"The library file, once the book is saved; open it in the reader."`
	Error      string `json:"error,omitempty"`
}

type BookDownloadOutput struct {
	Body BookDownload
}

type BookDownloadsOutput struct {
	Body struct {
		Downloads []BookDownload `json:"downloads"`
	}
}

type EnqueueBookDownloadInput struct {
	Body struct {
		EditionRef string `json:"edition_ref" minLength:"1" maxLength:"2000" doc:"A copy from a search in the last 30 minutes."`
		Format     string `json:"format" minLength:"1" maxLength:"200" doc:"One of the copy's formats, by type."`
		MediaRef   string `json:"media_ref" minLength:"1" maxLength:"200" doc:"The book the file belongs to in the library."`
	}
}

type BookDownloadIDInput struct {
	ID int64 `path:"id"`
}

type BookDownloadSettings struct {
	RootID int64 `json:"root_id" doc:"Library folder of books copies are saved to; 0 while none is chosen."`
}

type BookDownloadSettingsOutput struct {
	Body BookDownloadSettings
}

type PutBookDownloadSettingsInput struct {
	Body struct {
		RootID int64 `json:"root_id" minimum:"1"`
	}
}

func (h *Handler) Register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "listBookSources",
		Method:      http.MethodGet,
		Path:        "/v1/books/sources",
		Summary:     "Sources of free copies of books",
		Tags:        []string{"books"},
	}, func(_ context.Context, _ *struct{}) (*BookSourcesOutput, error) {
		out := &BookSourcesOutput{}
		out.Body.Sources = []BookSource{}

		for _, src := range h.svc.Sources() {
			out.Body.Sources = append(out.Body.Sources, BookSource{ID: src.ID, Name: src.Name})
		}

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "searchBookEditions",
		Method:      http.MethodGet,
		Path:        "/v1/books/editions",
		Summary:     "Find free copies of a book",
		Description: "Searches every source at once, by the book's title and authors or by the text given.",
		Tags:        []string{"books"},
	}, func(ctx context.Context, in *SearchBookEditionsInput) (*SearchBookEditionsOutput, error) {
		result, err := h.svc.Search(ctx, in.MediaRef, in.Query)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &SearchBookEditionsOutput{}
		out.Body.Editions = make([]BookEdition, 0, len(result.Editions))
		out.Body.Sources = make([]BookSourceOutcome, 0, len(result.Sources))

		for i := range result.Editions {
			edition := &result.Editions[i]

			formats := make([]BookFormat, 0, len(edition.Formats))
			for _, format := range edition.Formats {
				formats = append(formats, BookFormat{Type: format.Type, Ext: format.Ext, Size: format.Size})
			}

			authors := edition.Authors
			if authors == nil {
				authors = []string{}
			}

			out.Body.Editions = append(out.Body.Editions, BookEdition{
				Ref:      edition.Ref,
				Title:    edition.Title,
				Authors:  authors,
				Language: edition.Language,
				Year:     edition.Year,
				Source:   edition.Source,
				Formats:  formats,
			})
		}

		for _, outcome := range result.Sources {
			out.Body.Sources = append(out.Body.Sources, BookSourceOutcome(outcome))
		}

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "enqueueBookDownload",
		Method:        http.MethodPost,
		Path:          "/v1/books/downloads",
		Summary:       "Save a free copy of a book",
		Description:   "Queues the copy into the folder for books, where it joins the library as the book given. A copy already queued or saved is left as it is; a failed one is queued again.",
		Tags:          []string{"books"},
		DefaultStatus: http.StatusAccepted,
	}, func(ctx context.Context, in *EnqueueBookDownloadInput) (*BookDownloadOutput, error) {
		book, err := h.svc.Prepare(in.Body.EditionRef, in.Body.Format, in.Body.MediaRef)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		item, err := h.queue.Enqueue(ctx, book)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &BookDownloadOutput{Body: downloadBody(item)}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "listBookDownloads",
		Method:      http.MethodGet,
		Path:        "/v1/books/downloads",
		Summary:     "Book downloads",
		Description: "The queue and recent downloads, newest first. Changes arrive on the books.download topic.",
		Tags:        []string{"books"},
	}, func(ctx context.Context, _ *struct{}) (*BookDownloadsOutput, error) {
		items, err := h.queue.List(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &BookDownloadsOutput{}
		out.Body.Downloads = make([]BookDownload, 0, len(items))
		for i := range items {
			out.Body.Downloads = append(out.Body.Downloads, downloadBody(&items[i]))
		}

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "cancelBookDownload",
		Method:        http.MethodPost,
		Path:          "/v1/books/downloads/{id}/cancel",
		Summary:       "Stop a book download",
		Tags:          []string{"books"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, in *BookDownloadIDInput) (*struct{}, error) {
		return nil, httpapi.ToHTTP(h.queue.Cancel(ctx, in.ID))
	})

	huma.Register(api, huma.Operation{
		OperationID:   "retryBookDownload",
		Method:        http.MethodPost,
		Path:          "/v1/books/downloads/{id}/retry",
		Summary:       "Try a failed book download again",
		Tags:          []string{"books"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, in *BookDownloadIDInput) (*struct{}, error) {
		return nil, httpapi.ToHTTP(h.queue.Retry(ctx, in.ID))
	})

	huma.Register(api, huma.Operation{
		OperationID:   "forgetBookDownload",
		Method:        http.MethodDelete,
		Path:          "/v1/books/downloads/{id}",
		Summary:       "Remove a finished book download from the list",
		Description:   "The saved file stays where it is.",
		Tags:          []string{"books"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, in *BookDownloadIDInput) (*struct{}, error) {
		return nil, httpapi.ToHTTP(h.queue.Forget(ctx, in.ID))
	})

	huma.Register(api, huma.Operation{
		OperationID: "getBookDownloadSettings",
		Method:      http.MethodGet,
		Path:        "/v1/books/downloads/settings",
		Summary:     "Where copies of books are saved",
		Tags:        []string{"books"},
	}, func(ctx context.Context, _ *struct{}) (*BookDownloadSettingsOutput, error) {
		rootID, err := h.queue.Root(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &BookDownloadSettingsOutput{Body: BookDownloadSettings{RootID: rootID}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "putBookDownloadSettings",
		Method:      http.MethodPut,
		Path:        "/v1/books/downloads/settings",
		Summary:     "Choose where copies of books are saved",
		Description: "One of the library folders of books, so a saved copy is part of the library at once.",
		Tags:        []string{"books"},
	}, func(ctx context.Context, in *PutBookDownloadSettingsInput) (*BookDownloadSettingsOutput, error) {
		if err := h.queue.SetRoot(ctx, in.Body.RootID); err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &BookDownloadSettingsOutput{Body: BookDownloadSettings{RootID: in.Body.RootID}}, nil
	})
}

func downloadBody(item *store.Download) BookDownload {
	return BookDownload{
		ID:         item.ID,
		EditionRef: item.EditionRef,
		Format:     item.Format,
		MediaRef:   item.MediaRef,
		Title:      item.Title,
		Authors:    item.Authors,
		SourceName: item.SourceName,
		State:      item.State,
		BytesDone:  item.BytesDone,
		BytesTotal: item.BytesTotal,
		RelPath:    item.RelPath,
		FileID:     item.FileID,
		Error:      item.Error,
	}
}
