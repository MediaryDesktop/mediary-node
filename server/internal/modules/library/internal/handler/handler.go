package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/service"
)

type Handler struct {
	svc *service.Service
}

func New(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

type RootsOutput struct {
	Body struct {
		Roots []service.Root `json:"roots" doc:"Folders the user gave the node to watch."`
	}
}

type AddRootInput struct {
	Body struct {
		Path    string `json:"path" minLength:"1" maxLength:"4096" example:"D:\\Anime" doc:"Absolute path to an existing folder on this machine."`
		Content string `json:"content,omitempty" enum:"anime,movies_and_shows,doramas,mixed,manga,books" doc:"What the folder holds, as in listLibraryRoots. Left out means anime."`
	}
}

type UpdateRootInput struct {
	ID   int64 `path:"id" doc:"Identifier of the root."`
	Body struct {
		Content string `json:"content" enum:"anime,movies_and_shows,doramas,mixed,manga,books" required:"true" doc:"What the folder holds, as in listLibraryRoots. A folder turned to manga or books drops the files of other kinds."`
	}
}

type RootOutput struct {
	Body struct {
		Root *service.Root `json:"root" doc:"The root as the node recorded it."`
	}
}

type DeleteRootInput struct {
	ID int64 `path:"id" doc:"Identifier of the root to stop watching."`
}

type ScanInput struct {
	Body struct {
		RootID int64 `json:"root_id,omitempty" doc:"Scan this root alone. Left out or 0 scans every root."`
	}
}

type ScanOutput struct {
	Body struct {
		Scan service.ScanStatus `json:"scan" doc:"State of the node's single scan slot."`
	}
}

type FilesInput struct {
	RootID        int64  `query:"root_id" doc:"Only files under this root."`
	Kind          string `query:"kind" enum:"video,manga,book" doc:"Only files whose extension points at this form of media."`
	Form          string `query:"form" enum:"series,movie,special,extra,manga,book" doc:"Only files whose name reads as this. Use it to leave out openings and extras, which are never episodes."`
	UnmatchedOnly bool   `query:"unmatched" doc:"Only files that still need a title. Files the user set aside are left out — they are asking for nothing."`
	IgnoredOnly   bool   `query:"ignored" doc:"Only files the user told the node to leave alone."`
	MediaRef      string `query:"media_ref" example:"anilist:154587" doc:"Only files matched to this title — the episodes a title page lists."`
	Limit         int    `query:"limit" minimum:"1" maximum:"500" default:"100" doc:"Page size."`
	Offset        int    `query:"offset" minimum:"0" doc:"How many files to skip."`
}

type FilesOutput struct {
	Body struct {
		Files *service.FilePage `json:"files" doc:"One page of scanned files with their matches."`
	}
}

type SetMatchInput struct {
	ID   int64 `path:"id" doc:"Identifier of the file to match."`
	Body struct {
		MediaRef string `json:"media_ref" minLength:"3" example:"anilist:154587" doc:"The title this file belongs to, as provider:id."`
		Season   *int   `json:"season,omitempty" minimum:"0" doc:"Season number, when the title has seasons."`
		Episode  *int   `json:"episode,omitempty" minimum:"0" doc:"Episode or chapter number within the title."`
	}
}

type FileOutput struct {
	Body struct {
		File *service.File `json:"file" doc:"The file with its match applied."`
	}
}

type DeleteMatchInput struct {
	ID int64 `path:"id" doc:"Identifier of the file whose match to forget."`
}

type SetIgnoredInput struct {
	ID   int64 `path:"id" doc:"Identifier of the file to set aside."`
	Body struct {
		Ignored bool `json:"ignored" doc:"True to leave the file alone from now on, false to take that mark off."`
	}
}

type DeleteFileInput struct {
	ID int64 `path:"id" doc:"Identifier of the file to delete."`
}

type SuggestionsInput struct {
	ID int64 `path:"id" doc:"Identifier of the file to find candidates for."`
}

type SuggestionsOutput struct {
	Body struct {
		Suggestions []service.Suggestion `json:"suggestions" doc:"Candidate titles, best first."`
		Sources     []httpapi.Source     `json:"sources" doc:"Attribution for every field that came from an external source."`
	}
}

type CollectionOutput struct {
	Body struct {
		Collection *service.LibraryCollection `json:"collection" doc:"The library seen as titles rather than as files."`
		Sources    []httpapi.Source           `json:"sources" doc:"Attribution for every field that came from an external source."`
	}
}

type ScanHistoryInput struct {
	From   time.Time `query:"from" doc:"Only scans started at or after this time. Left out for no lower bound."`
	To     time.Time `query:"to" doc:"Only scans started at or before this time. Left out for no upper bound."`
	Limit  int       `query:"limit" minimum:"1" maximum:"500" default:"100" doc:"Page size."`
	Offset int       `query:"offset" minimum:"0" doc:"How many scans to skip."`
}

type ScanHistoryOutput struct {
	Body struct {
		History *service.ScanHistoryPage `json:"history" doc:"One page of past scans, newest first."`
	}
}

type ScanRunInput struct {
	ID int64 `path:"id" doc:"Identifier of the scan run."`
}

type ScanRunOutput struct {
	Body struct {
		Run     *service.ScanRunDetail `json:"run" doc:"The scan run in full."`
		Sources []httpapi.Source       `json:"sources" doc:"Attribution for every field that came from an external source."`
	}
}

func (h *Handler) Register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "listLibraryRoots",
		Method:      http.MethodGet,
		Path:        "/v1/library/roots",
		Summary:     "Library folders",
		Description: "The folders the node scans, with how many files each holds and when it was last walked.",
		Tags:        []string{"library"},
	}, func(ctx context.Context, _ *struct{}) (*RootsOutput, error) {
		roots, err := h.svc.Roots(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &RootsOutput{}
		out.Body.Roots = roots

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "addLibraryRoot",
		Method:        http.MethodPost,
		Path:          "/v1/library/roots",
		Summary:       "Add a library folder",
		Description:   "The folder has to exist and must not sit inside — or contain — a folder already watched, which would record the same file twice.",
		Tags:          []string{"library"},
		DefaultStatus: http.StatusCreated,
	}, func(ctx context.Context, in *AddRootInput) (*RootOutput, error) {
		root, err := h.svc.AddRoot(ctx, in.Body.Path, in.Body.Content)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &RootOutput{}
		out.Body.Root = root

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "updateLibraryRoot",
		Method:      http.MethodPatch,
		Path:        "/v1/library/roots/{id}",
		Summary:     "Say what a library folder holds",
		Description: "Switching between anime and movies and shows drops the automatic matches of the folder's videos — they point at the other source — and scans it again to redo them. Matches the user made by hand stay.",
		Tags:        []string{"library"},
	}, func(ctx context.Context, in *UpdateRootInput) (*RootOutput, error) {
		root, err := h.svc.SetRootContent(ctx, in.ID, in.Body.Content)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &RootOutput{}
		out.Body.Root = root

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "deleteLibraryRoot",
		Method:        http.MethodDelete,
		Path:          "/v1/library/roots/{id}",
		Summary:       "Stop watching a folder",
		Description:   "Forgets the folder and everything the node recorded about the files in it, including their matches. Nothing on disk is touched.",
		Tags:          []string{"library"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, in *DeleteRootInput) (*struct{}, error) {
		if err := h.svc.DeleteRoot(ctx, in.ID); err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return nil, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "startLibraryScan",
		Method:        http.MethodPost,
		Path:          "/v1/library/scan",
		Summary:       "Scan the library",
		Description:   "Starts a scan and returns at once: walking a large library takes minutes. Progress arrives as library.scan events on the socket. Only one scan runs at a time. Files whose size and modification time did not change are not touched, so a rescan is cheap, and a folder that cannot be read right now is skipped rather than emptied.",
		Tags:          []string{"library"},
		DefaultStatus: http.StatusAccepted,
	}, func(ctx context.Context, in *ScanInput) (*ScanOutput, error) {
		status, err := h.svc.StartScan(ctx, in.Body.RootID)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &ScanOutput{}
		out.Body.Scan = *status

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getLibraryScan",
		Method:      http.MethodGet,
		Path:        "/v1/library/scan",
		Summary:     "Scan status",
		Description: "What the running scan has found so far, or the outcome of the last one.",
		Tags:        []string{"library"},
	}, func(_ context.Context, _ *struct{}) (*ScanOutput, error) {
		out := &ScanOutput{}
		out.Body.Scan = h.svc.ScanState()

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "listLibraryFiles",
		Method:      http.MethodGet,
		Path:        "/v1/library/files",
		Summary:     "Scanned files",
		Description: "Files the last scan recorded, with the title each was matched to. A file the scan no longer finds is kept and reported as missing, so an unplugged drive does not take the user's manual matches with it.",
		Tags:        []string{"library"},
	}, func(ctx context.Context, in *FilesInput) (*FilesOutput, error) {
		files, err := h.svc.Files(ctx, service.FileQuery{
			RootID:        in.RootID,
			Kind:          in.Kind,
			MediaForm:     in.Form,
			UnmatchedOnly: in.UnmatchedOnly,
			IgnoredOnly:   in.IgnoredOnly,
			MediaRef:      in.MediaRef,
			Limit:         in.Limit,
			Offset:        in.Offset,
		})
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &FilesOutput{}
		out.Body.Files = files

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "listLibraryFileCandidates",
		Method:      http.MethodGet,
		Path:        "/v1/library/files/{id}/candidates",
		Summary:     "What this file could be",
		Description: "Titles the file's name could refer to, best first, each with how well it fits. This is the other half of the automatic match: what the node would not decide on its own it offers here, for the user to confirm with setLibraryFileMatch. Entries already on the user's own list are marked and come from the node's mirror, so they are offered even while the source is unreachable.",
		Tags:        []string{"library"},
	}, func(ctx context.Context, in *SuggestionsInput) (*SuggestionsOutput, error) {
		suggestions, err := h.svc.Suggestions(ctx, in.ID)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &SuggestionsOutput{}
		out.Body.Suggestions = suggestions
		out.Body.Sources = []httpapi.Source{httpapi.AniListSource}

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "setLibraryFileMatch",
		Method:      http.MethodPut,
		Path:        "/v1/library/files/{id}/match",
		Summary:     "Match a file by hand",
		Description: "Ties the file to a title the user picked. A manual match outranks anything a later scan works out on its own, so a correction is made once and not after every scan.",
		Tags:        []string{"library"},
	}, func(ctx context.Context, in *SetMatchInput) (*FileOutput, error) {
		file, err := h.svc.SetMatch(ctx, in.ID, in.Body.MediaRef, in.Body.Season, in.Body.Episode)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &FileOutput{}
		out.Body.File = file

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "deleteLibraryFileMatch",
		Method:        http.MethodDelete,
		Path:          "/v1/library/files/{id}/match",
		Summary:       "Forget a file's match",
		Description:   "Leaves the file unmatched so the next scan can work it out again.",
		Tags:          []string{"library"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, in *DeleteMatchInput) (*struct{}, error) {
		if err := h.svc.DeleteMatch(ctx, in.ID); err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return nil, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "listAllLibraryFiles",
		Method:      http.MethodGet,
		Path:        "/v1/library/files/tree",
		Summary:     "Every scanned file",
		Description: "The whole library in one read, for a view that draws all of it at once. A tree is every file by definition, so paging it would only mean asking page after page before anything can be drawn.",
		Tags:        []string{"library"},
	}, func(ctx context.Context, _ *struct{}) (*FilesOutput, error) {
		files, err := h.svc.AllFiles(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &FilesOutput{}
		out.Body.Files = files

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "setLibraryFileIgnored",
		Method:      http.MethodPut,
		Path:        "/v1/library/files/{id}/ignore",
		Summary:     "Leave a file alone",
		Description: "Sets a file aside so no scan offers it for matching again. A sample, a trailer the parser could not place, a file that belongs to nothing — without this it comes back as unmatched after every scan and the count never reaches zero. Nothing on disk is touched.",
		Tags:        []string{"library"},
	}, func(ctx context.Context, in *SetIgnoredInput) (*FileOutput, error) {
		file, err := h.svc.SetIgnored(ctx, in.ID, in.Body.Ignored)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &FileOutput{}
		out.Body.File = file

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "deleteLibraryFile",
		Method:        http.MethodDelete,
		Path:          "/v1/library/files/{id}",
		Summary:       "Delete a file",
		Description:   "Removes the file from disk and then from the library. A file the node could not delete keeps its row, so nothing is quietly forgotten while it is still there.",
		Tags:          []string{"library"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, in *DeleteFileInput) (*struct{}, error) {
		if err := h.svc.DeleteFile(ctx, in.ID); err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return nil, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getLibraryCollection",
		Method:      http.MethodGet,
		Path:        "/v1/library/collection",
		Summary:     "The library as titles",
		Description: "Every title the library holds files of, by name, with how many files each has. This is what the library shelf is drawn from: grouping a page of files into titles on the client would both cost a page of files and miss everything past it.",
		Tags:        []string{"library"},
	}, func(ctx context.Context, _ *struct{}) (*CollectionOutput, error) {
		collection, err := h.svc.Collection(ctx)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &CollectionOutput{}
		out.Body.Collection = collection
		out.Body.Sources = []httpapi.Source{httpapi.AniListSource}

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "listLibraryScanHistory",
		Method:      http.MethodGet,
		Path:        "/v1/library/scan/history",
		Summary:     "Past scans",
		Description: "Every scan the node has run, newest first, kept independently of the single current-scan slot so a scan from days ago is still readable.",
		Tags:        []string{"library"},
	}, func(ctx context.Context, in *ScanHistoryInput) (*ScanHistoryOutput, error) {
		history, err := h.svc.ScanHistory(ctx, service.ScanHistoryQuery{
			From:   optionalTime(in.From),
			To:     optionalTime(in.To),
			Limit:  in.Limit,
			Offset: in.Offset,
		})
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &ScanHistoryOutput{}
		out.Body.History = history

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getLibraryScanHistoryRun",
		Method:      http.MethodGet,
		Path:        "/v1/library/scan/history/{id}",
		Summary:     "One past scan",
		Description: "What one scan matched, grouped by title, and every file it looked at but could not match.",
		Tags:        []string{"library"},
	}, func(ctx context.Context, in *ScanRunInput) (*ScanRunOutput, error) {
		run, err := h.svc.ScanRun(ctx, in.ID)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &ScanRunOutput{}
		out.Body.Run = run
		out.Body.Sources = []httpapi.Source{httpapi.AniListSource}

		return out, nil
	})
}

// optionalTime turns a query parameter's zero value back into "left out": huma
// has no pointer support for query params, so the zero time plays the same role
// the numeric filters elsewhere play with 0.
func optionalTime(value time.Time) *time.Time {
	if value.IsZero() {
		return nil
	}

	return &value
}
