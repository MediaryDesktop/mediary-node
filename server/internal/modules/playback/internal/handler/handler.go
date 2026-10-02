package handler

import (
	"context"
	"net/http"
	"os"
	"path/filepath"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"

	"github.com/mediaryorg/mediary-node/server/internal/httpapi"
	"github.com/mediaryorg/mediary-node/server/internal/modules/playback/internal/service"
	"github.com/mediaryorg/mediary-node/server/internal/modules/playback/internal/videofile"
)

type Handler struct {
	svc *service.Service
}

func New(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

type PlaybackOutput struct {
	Body struct {
		Playback service.PlaybackStatus `json:"playback" doc:"What the node's single player slot is doing."`
	}
}

type StartInput struct {
	Body struct {
		FileID int64 `json:"file_id" doc:"Library file to play, as listed by listLibraryFiles."`
	}
}

type ControlInput struct {
	Body struct {
		Action   string  `json:"action" enum:"pause,resume,seek" doc:"What to do with the open player."`
		Position float64 `json:"position,omitempty" minimum:"0" doc:"Seconds from the start, for a seek."`
	}
}

type FileInput struct {
	ID int64 `path:"id" doc:"Library file, as listed by listLibraryFiles."`
}

type StreamOutput struct {
	Body struct {
		Stream *service.Stream `json:"stream" doc:"What the file holds and where to fetch it."`
	}
}

func (h *Handler) Register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "getPlaybackStream",
		Method:      http.MethodGet,
		Path:        "/v1/playback/files/{id}/stream",
		Summary:     "Describe a file for the built-in player",
		Description: "Runs ffprobe on the file, once per version of it, and reports its streams together with an RFC 6381 type. The renderer asks its own video element whether it can play that type, which decides between direct play and transcoding.",
		Tags:        []string{"playback"},
	}, func(ctx context.Context, in *FileInput) (*StreamOutput, error) {
		stream, err := h.svc.Stream(ctx, in.ID)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &StreamOutput{}
		out.Body.Stream = stream

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getPlaybackDirect",
		Method:      http.MethodGet,
		Path:        "/v1/playback/files/{id}/direct",
		Summary:     "Serve a file as it is",
		Description: "The file's bytes with range support, for a video element to play directly. Accepts the node token as ?token=, because a video element cannot send headers.",
		Tags:        []string{"playback"},
	}, func(ctx context.Context, in *FileInput) (*huma.StreamResponse, error) {
		path, err := h.svc.DirectPath(ctx, in.ID)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		return &huma.StreamResponse{Body: func(hctx huma.Context) {
			serveFile(hctx, path)
		}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getPlayback",
		Method:      http.MethodGet,
		Path:        "/v1/playback",
		Summary:     "What is playing",
		Description: "The node plays one file at a time. Position and duration come from the player itself and arrive as playback events on the socket; this is the state to start from.",
		Tags:        []string{"playback"},
	}, func(_ context.Context, _ *struct{}) (*PlaybackOutput, error) {
		out := &PlaybackOutput{}
		out.Body.Playback = h.svc.Status()

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "startPlayback",
		Method:      http.MethodPost,
		Path:        "/v1/playback",
		Summary:     "Play a library file",
		Description: "Opens the player on a scanned file. Starting a second file replaces the first — the node keeps one window. A matched file is marked watched once it is far enough through, and the tracker decides what that means for the user's list.",
		Tags:        []string{"playback"},
	}, func(ctx context.Context, in *StartInput) (*PlaybackOutput, error) {
		status, err := h.svc.Start(ctx, in.Body.FileID)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &PlaybackOutput{}
		out.Body.Playback = *status

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "controlPlayback",
		Method:      http.MethodPost,
		Path:        "/v1/playback/command",
		Summary:     "Steer the open player",
		Description: "Pause, resume or jump. Deliberately small: the player's own window is in front of the user, and duplicating its controls would only add ways for the two to disagree.",
		Tags:        []string{"playback"},
	}, func(ctx context.Context, in *ControlInput) (*PlaybackOutput, error) {
		status, err := h.svc.Control(ctx, service.Action(in.Body.Action), in.Body.Position)
		if err != nil {
			return nil, httpapi.ToHTTP(err)
		}

		out := &PlaybackOutput{}
		out.Body.Playback = *status

		return out, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "stopPlayback",
		Method:      http.MethodDelete,
		Path:        "/v1/playback",
		Summary:     "Close the player",
		Description: "Ends the session. Whatever was already recorded as watched stays recorded.",
		Tags:        []string{"playback"},
	}, func(_ context.Context, _ *struct{}) (*PlaybackOutput, error) {
		out := &PlaybackOutput{}
		out.Body.Playback = h.svc.Stop()

		return out, nil
	})
}

func serveFile(hctx huma.Context, path string) {
	r, w := humachi.Unwrap(hctx)

	file, err := os.Open(path)
	if err != nil {
		http.Error(w, "the file cannot be opened", http.StatusNotFound)
		return
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		http.Error(w, "the file cannot be read", http.StatusInternalServerError)
		return
	}

	if contentType := videofile.ContainerMimeType(filepath.Ext(path)); contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}

	http.ServeContent(w, r, filepath.Base(path), stat.ModTime(), file)
}
