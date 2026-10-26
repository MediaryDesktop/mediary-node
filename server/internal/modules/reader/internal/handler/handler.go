package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/archive"
	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/ref"
	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/service"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

type Handler struct {
	svc *service.Service
}

func New(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

const refDoc = "Chapter reference: local:<file id>, opds:<server id>:<entry id> or plugin:<plugin id>:<key>."

type ChapterInput struct {
	Ref string `path:"ref" doc:"Chapter reference: local:<file id>, opds:<server id>:<entry id> or plugin:<plugin id>:<key>."`
}

type ChapterPageInput struct {
	Ref   string `path:"ref" doc:"Chapter reference, as in getReaderChapterByRef."`
	Index int    `path:"index" minimum:"0" doc:"Position in reading order, from the chapter listing."`
}

type ChapterReadInput struct {
	Ref  string `path:"ref" doc:"Chapter being read, as in getReaderChapterByRef."`
	Body ReadBody
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
	Body ReadBody
}

type ReadBody struct {
	Page int `json:"page" minimum:"0" doc:"Page the reader is on, starting at 0."`
}

type ChapterBody struct {
	Ref      string         `json:"ref" doc:"Chapter reference, for the page and progress endpoints."`
	FileID   int64          `json:"file_id,omitempty" doc:"Library file this chapter is. Absent for a chapter from any other source."`
	Title    string         `json:"title" doc:"Title as the source names it, for the UI."`
	MediaRef string         `json:"media_ref,omitempty" doc:"Title this chapter is matched to. Absent while unmatched."`
	Number   string         `json:"number,omitempty" doc:"Chapter number as the source writes it, such as 12 or 12.5. Absent for an unnumbered chapter."`
	Pages    []archive.Page `json:"pages" doc:"Every page, in reading order."`

	SourceName string   `json:"source_name,omitempty" doc:"Where an online chapter comes from, to credit it."`
	Groups     []string `json:"groups,omitempty" doc:"Who translated it, to credit them."`
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

	h.registerChapters(api)
	h.registerFiles(api)
	h.registerBooks(api)
}

// registerChapters is the reader's API for a chapter from any source.
func (h *Handler) registerChapters(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "getReaderChapterByRef",
		Method:      http.MethodGet,
		Path:        "/v1/reader/chapters/{ref}",
		Summary:     "Pages of a chapter",
		Description: "The chapter's pages in reading order, from whichever source the reference names. " + refDoc,
		Tags:        []string{"reader"},
	}, func(ctx context.Context, in *ChapterInput) (*ChapterOutput, error) {
		chapterRef, err := parseRef(in.Ref)
		if err != nil {
			return nil, err
		}

		return h.chapter(ctx, chapterRef)
	})

	huma.Register(api, huma.Operation{
		OperationID: "getReaderPageByRef",
		Method:      http.MethodGet,
		Path:        "/v1/reader/chapters/{ref}/pages/{index}",
		Summary:     "One page of a chapter",
		Description: "The page's image, served by the node whichever source it comes from. Accepts ?token=, because an image element cannot send headers.",
		Tags:        []string{"reader"},
	}, func(ctx context.Context, in *ChapterPageInput) (*huma.StreamResponse, error) {
		chapterRef, err := parseRef(in.Ref)
		if err != nil {
			return nil, err
		}

		return h.page(ctx, chapterRef, in.Index)
	})

	huma.Register(api, huma.Operation{
		OperationID: "reportReaderPageByRef",
		Method:      http.MethodPost,
		Path:        "/v1/reader/chapters/{ref}/progress",
		Summary:     "Report the page the reader is on",
		Description: "Reaching the last page counts the chapter as read. Only a whole chapter number moves the user's list; an extra such as 12.5 is read without moving it. The tracker never lowers progress.",
		Tags:        []string{"reader"},
	}, func(ctx context.Context, in *ChapterReadInput) (*ReadOutput, error) {
		chapterRef, err := parseRef(in.Ref)
		if err != nil {
			return nil, err
		}

		return h.report(ctx, chapterRef, in.Body.Page)
	})
}

// registerFiles keeps the routes by library file id, which name the same chapters
// as local:<id>.
func (h *Handler) registerFiles(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "getReaderChapter",
		Method:      http.MethodGet,
		Path:        "/v1/reader/files/{id}/chapter",
		Summary:     "Pages of a comic chapter",
		Description: "The same as getReaderChapterByRef with local:<id>.",
		Tags:        []string{"reader"},
	}, func(ctx context.Context, in *FileInput) (*ChapterOutput, error) {
		return h.chapter(ctx, ref.Local(in.ID))
	})

	huma.Register(api, huma.Operation{
		OperationID: "getReaderPage",
		Method:      http.MethodGet,
		Path:        "/v1/reader/files/{id}/pages/{index}",
		Summary:     "One page of a comic chapter",
		Description: "The same as getReaderPageByRef with local:<id>. Accepts ?token=, because an image element cannot send headers.",
		Tags:        []string{"reader"},
	}, func(ctx context.Context, in *PageInput) (*huma.StreamResponse, error) {
		return h.page(ctx, ref.Local(in.ID), in.Index)
	})

	huma.Register(api, huma.Operation{
		OperationID: "reportReaderPage",
		Method:      http.MethodPost,
		Path:        "/v1/reader/files/{id}/progress",
		Summary:     "Report the page the reader is on",
		Description: "The same as reportReaderPageByRef with local:<id>.",
		Tags:        []string{"reader"},
	}, func(ctx context.Context, in *ReadInput) (*ReadOutput, error) {
		return h.report(ctx, ref.Local(in.ID), in.Body.Page)
	})
}

func parseRef(raw string) (ref.ChapterRef, error) {
	chapterRef, err := ref.Parse(raw)
	if err != nil {
		return ref.ChapterRef{}, httpapi.ToHTTP(apperr.Invalid("ref", "%s", err.Error()))
	}

	return chapterRef, nil
}

func (h *Handler) chapter(ctx context.Context, chapterRef ref.ChapterRef) (*ChapterOutput, error) {
	chapter, err := h.svc.Chapter(ctx, chapterRef)
	if err != nil {
		return nil, httpapi.ToHTTP(err)
	}

	out := &ChapterOutput{}
	out.Body.Chapter = ChapterBody{
		Ref:      chapter.Ref.String(),
		FileID:   chapter.FileID,
		Title:    chapter.Title,
		MediaRef: chapter.MediaRef,
		Number:   chapter.Number,
		Pages:    chapter.Pages,

		SourceName: chapter.SourceName,
		Groups:     chapter.Groups,
	}

	return out, nil
}

func (h *Handler) page(ctx context.Context, chapterRef ref.ChapterRef, index int) (*huma.StreamResponse, error) {
	image, err := h.svc.PageImage(ctx, chapterRef, index)
	if err != nil {
		return nil, httpapi.ToHTTP(err)
	}

	return &huma.StreamResponse{Body: func(hctx huma.Context) {
		hctx.SetHeader("Content-Type", image.ContentType)
		// A page never changes under its index while the chapter stays the same.
		hctx.SetHeader("Cache-Control", "private, max-age=3600")
		_, _ = hctx.BodyWriter().Write(image.Data)
	}}, nil
}

func (h *Handler) report(ctx context.Context, chapterRef ref.ChapterRef, page int) (*ReadOutput, error) {
	counted, err := h.svc.ReportPage(ctx, chapterRef, page)
	if err != nil {
		return nil, httpapi.ToHTTP(err)
	}

	out := &ReadOutput{}
	out.Body.Counted = counted

	return out, nil
}
