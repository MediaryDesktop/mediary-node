package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/MediaryDesktop/mediary-node/server/internal/httpapi"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/manga/internal/store"
)

type MangaDownloadBody struct {
	ID         int64  `json:"id"`
	ChapterRef string `json:"chapter_ref"`
	MediaRef   string `json:"media_ref"`
	Series     string `json:"series"`
	Title      string `json:"title"`
	Number     string `json:"number,omitempty"`
	SourceName string `json:"source_name"`
	State      string `json:"state" enum:"queued,running,done,failed,cancelled"`
	PagesDone  int    `json:"pages_done"`
	PagesTotal int    `json:"pages_total"`
	RelPath    string `json:"rel_path,omitempty" doc:"Where the chapter is saved, inside the download folder."`
	Error      string `json:"error,omitempty"`
}

type MangaDownloadsOutput struct {
	Body struct {
		Downloads []MangaDownloadBody `json:"downloads"`
	}
}

type EnqueueMangaDownloadsInput struct {
	Body struct {
		Refs []string `json:"refs" minItems:"1" maxItems:"500" doc:"Chapter references, as the chapter listing gives them."`
	}
}

type MangaDownloadIDInput struct {
	ID int64 `path:"id"`
}

type MangaDownloadSettingsBody struct {
	RootID        int64  `json:"root_id" doc:"Library folder chapters are saved to; 0 saves them into default_folder."`
	DefaultFolder string `json:"default_folder" doc:"The node's own folder for chapters, used while no library folder is chosen. It joins the library as a folder of manga on the first download; empty when the node has none."`
}

type MangaDownloadSettingsOutput struct {
	Body MangaDownloadSettingsBody
}

type PutMangaDownloadSettingsInput struct {
	Body struct {
		RootID int64 `json:"root_id" minimum:"1"`
	}
}

func (h *Handler) registerDownloads(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "listMangaDownloads",
		Method:      http.MethodGet,
		Path:        "/v1/manga/downloads",
		Summary:     "Chapter downloads",
		Description: "The queue and recent downloads, newest first. Changes arrive on the manga.download topic.",
		Tags:        []string{"manga"},
	}, func(ctx context.Context, _ *struct{}) (*MangaDownloadsOutput, error) {
		items, err := h.queue.List(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return downloadsOutput(items), nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "enqueueMangaDownloads",
		Method:        http.MethodPost,
		Path:          "/v1/manga/downloads",
		Summary:       "Save chapters to disk",
		Description:   "Queues the chapters as CBZ files in the download folder. A chapter already queued or saved is left as it is; a failed one is queued again.",
		Tags:          []string{"manga"},
		DefaultStatus: http.StatusAccepted,
	}, func(ctx context.Context, in *EnqueueMangaDownloadsInput) (*MangaDownloadsOutput, error) {
		items, err := h.queue.Enqueue(ctx, in.Body.Refs)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return downloadsOutput(items), nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "cancelMangaDownload",
		Method:        http.MethodPost,
		Path:          "/v1/manga/downloads/{id}/cancel",
		Summary:       "Stop a download",
		Tags:          []string{"manga"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, in *MangaDownloadIDInput) (*struct{}, error) {
		return nil, httpapi.ToHTTP(h.queue.Cancel(ctx, in.ID))
	})

	huma.Register(api, huma.Operation{
		OperationID:   "retryMangaDownload",
		Method:        http.MethodPost,
		Path:          "/v1/manga/downloads/{id}/retry",
		Summary:       "Try a failed download again",
		Tags:          []string{"manga"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, in *MangaDownloadIDInput) (*struct{}, error) {
		return nil, httpapi.ToHTTP(h.queue.Retry(ctx, in.ID))
	})

	huma.Register(api, huma.Operation{
		OperationID:   "forgetMangaDownload",
		Method:        http.MethodDelete,
		Path:          "/v1/manga/downloads/{id}",
		Summary:       "Remove a finished download from the list",
		Description:   "The saved file stays where it is.",
		Tags:          []string{"manga"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, in *MangaDownloadIDInput) (*struct{}, error) {
		return nil, httpapi.ToHTTP(h.queue.Forget(ctx, in.ID))
	})

	huma.Register(api, huma.Operation{
		OperationID: "getMangaDownloadSettings",
		Method:      http.MethodGet,
		Path:        "/v1/manga/downloads/settings",
		Summary:     "Where chapters are saved",
		Tags:        []string{"manga"},
	}, func(ctx context.Context, _ *struct{}) (*MangaDownloadSettingsOutput, error) {
		rootID, err := h.queue.Root(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &MangaDownloadSettingsOutput{}
		out.Body.RootID = rootID
		out.Body.DefaultFolder = h.queue.DefaultFolder()

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "putMangaDownloadSettings",
		Method:      http.MethodPut,
		Path:        "/v1/manga/downloads/settings",
		Summary:     "Choose where chapters are saved",
		Description: "One of the library folders, so a saved chapter is part of the library at once.",
		Tags:        []string{"manga"},
	}, func(ctx context.Context, in *PutMangaDownloadSettingsInput) (*MangaDownloadSettingsOutput, error) {
		if err := h.queue.SetRoot(ctx, in.Body.RootID); err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &MangaDownloadSettingsOutput{}
		out.Body.RootID = in.Body.RootID
		out.Body.DefaultFolder = h.queue.DefaultFolder()

		return out, nil
	})
}

func downloadsOutput(items []store.Download) *MangaDownloadsOutput {
	out := &MangaDownloadsOutput{}
	out.Body.Downloads = make([]MangaDownloadBody, 0, len(items))

	for i := range items {
		item := &items[i]
		out.Body.Downloads = append(out.Body.Downloads, MangaDownloadBody{
			ID:         item.ID,
			ChapterRef: item.ChapterRef,
			MediaRef:   item.MediaRef,
			Series:     item.Series,
			Title:      item.Title,
			Number:     item.Number,
			SourceName: item.SourceName,
			State:      item.State,
			PagesDone:  item.PagesDone,
			PagesTotal: item.PagesTotal,
			RelPath:    item.RelPath,
			Error:      item.Error,
		})
	}

	return out
}
