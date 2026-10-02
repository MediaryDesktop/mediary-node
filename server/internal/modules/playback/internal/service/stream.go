package service

import (
	"context"
	"errors"
	"fmt"
	"os/exec"

	"github.com/mediaryorg/mediary-node/server/internal/modules/playback/internal/videofile"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// Prober reads what streams a file holds. The real one runs ffprobe and keeps
// the answer per file version.
type Prober interface {
	Info(ctx context.Context, path string) (*videofile.MediaInfo, error)
}

// Stream is what the built-in player needs before it can choose how to play a
// file: what is inside it, and where to fetch it from.
type Stream struct {
	FileID   int64  `json:"file_id" doc:"Library file this describes."`
	Title    string `json:"title" doc:"Title as the library reads it, for the UI."`
	MediaRef string `json:"media_ref,omitempty" doc:"Title this file is matched to. Absent while unmatched."`
	Episode  *int   `json:"episode,omitempty" doc:"Episode number within that title."`

	Info *videofile.MediaInfo `json:"info" doc:"Streams, codecs and chapters as ffprobe reports them."`

	DirectURL string `json:"direct_url" doc:"Path that serves the file as it is, with range requests. The renderer appends the node token as ?token= because a video element cannot send headers."`
}

func (s *Service) Stream(ctx context.Context, fileID int64) (*Stream, error) {
	file, err := s.playable(ctx, fileID)
	if err != nil {
		return nil, err
	}

	if s.opts.Prober == nil {
		return nil, apperr.New(apperr.KindPrecondition, "media probing is not configured on this node")
	}

	info, err := s.opts.Prober.Info(ctx, file.Path)
	if err != nil {
		if errors.Is(err, exec.ErrNotFound) {
			return nil, apperr.Wrap(err, apperr.KindPrecondition,
				"ffprobe was not found on PATH: install FFmpeg or set NODE_FFPROBE_PATH")
		}

		return nil, apperr.Wrap(err, apperr.KindInternal, "could not read the streams of %s", file.Path)
	}

	return &Stream{
		FileID:    file.ID,
		Title:     file.Title,
		MediaRef:  file.MediaRef,
		Episode:   file.Episode,
		Info:      info,
		DirectURL: fmt.Sprintf("/v1/playback/files/%d/direct", file.ID),
	}, nil
}

// DirectPath is the file to hand to a direct-play request. Only library files
// can be served, by id, so the endpoint never reads a path a caller chose.
func (s *Service) DirectPath(ctx context.Context, fileID int64) (string, error) {
	file, err := s.playable(ctx, fileID)
	if err != nil {
		return "", err
	}

	return file.Path, nil
}

func (s *Service) playable(ctx context.Context, fileID int64) (*PlayableFile, error) {
	if s.opts.Library == nil {
		return nil, apperr.New(apperr.KindPrecondition, "playback is not configured on this node")
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

	return file, nil
}
