package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/archive"
	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/service"
)

type Handler struct {
	svc *service.Service
}

func New(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

type FileInput struct {
	ID int64 `path:"id" doc:"Library file, as listed by listLibraryFiles."`
}

type PageInput struct {
	ID    int64 `path:"id" doc:"Library file, as listed by listLibraryFiles."`
	Index int   `path:"index" minimum:"0" doc:"Position in reading order, from the chapter listing."`
}

type ReadInput struct {
	ID   int64 `path:"id" doc:"Library file being read."`
	Body struct {
		Page int `json:"page" minimum:"0" doc:"Page the reader is on, starting at 0."`
	}
}

type ChapterBody struct {
	FileID   int64          `json:"file_id" doc:"Library file this chapter is."`
	Title    string         `json:"title" doc:"Title as the library reads it, for the UI."`
	MediaRef string         `json:"media_ref,omitempty" doc:"Title this chapter is matched to. Absent while unmatched."`
	Chapter  *int           `json:"chapter,omitempty" doc:"Chapter number within that title."`
	Pages    []archive.Page `json:"pages" doc:"Every page, in reading order."`
}

type ChapterOutput struct {
	Body struct {
		Chapter ChapterBody `json:"chapter"`
	}
}

type ReadOutput struct {
	Body struct {
		Counted bool `json:"counted" doc:"True once the chapter counts as read, on this call or an earlier one."`
	}
}

type StatusOutput struct {
	Body struct {
		Module string `json:"module" example:"reader" doc:"Module name."`
		Ready  bool   `json:"ready" doc:"True when the module's dependencies are wired."`
	}
}

func (h *Handler) Register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "getReaderStatus",
		Method:      http.MethodGet,
		Path:        "/v1/reader/status",
		Summary:     "Reader module status",
		Description: "Reports whether the reader module is wired.",
		Tags:        []string{"reader"},
	}, func(ctx context.Context, _ *struct{}) (*StatusOutput, error) {
		ready, err := h.svc.Status(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &StatusOutput{}
		out.Body.Module = "reader"
		out.Body.Ready = ready

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getReaderChapter",
		Method:      http.MethodGet,
		Path:        "/v1/reader/files/{id}/chapter",
		Summary:     "Pages of a comic chapter",
		Description: "The chapter's pages in reading order. Each page is fetched separately, so the reader can start before the whole archive is read.",
		Tags:        []string{"reader"},
	}, func(ctx context.Context, in *FileInput) (*ChapterOutput, error) {
		chapter, err := h.svc.Chapter(ctx, in.ID)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &ChapterOutput{}
		out.Body.Chapter = ChapterBody{
			FileID:   chapter.FileID,
			Title:    chapter.Title,
			MediaRef: chapter.MediaRef,
			Chapter:  chapter.Chapter,
			Pages:    chapter.Pages,
		}

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getReaderPage",
		Method:      http.MethodGet,
		Path:        "/v1/reader/files/{id}/pages/{index}",
		Summary:     "One page of a comic chapter",
		Description: "The page's image as it is stored in the archive. Accepts ?token=, because an image element cannot send headers.",
		Tags:        []string{"reader"},
	}, func(ctx context.Context, in *PageInput) (*huma.StreamResponse, error) {
		image, err := h.svc.PageImage(ctx, in.ID, in.Index)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &huma.StreamResponse{Body: func(hctx huma.Context) {
			hctx.SetHeader("Content-Type", image.ContentType)
			// A page never changes under its index while the file stays the same.
			hctx.SetHeader("Cache-Control", "private, max-age=3600")
			_, _ = hctx.BodyWriter().Write(image.Data)
		}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "reportReaderPage",
		Method:      http.MethodPost,
		Path:        "/v1/reader/files/{id}/progress",
		Summary:     "Report the page the reader is on",
		Description: "Reaching the last page counts the chapter as read on the user's list. The tracker decides what that means for the list and never lowers progress.",
		Tags:        []string{"reader"},
	}, func(ctx context.Context, in *ReadInput) (*ReadOutput, error) {
		counted, err := h.svc.ReportPage(ctx, in.ID, in.Body.Page)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &ReadOutput{}
		out.Body.Counted = counted

		return out, nil
	})
}
