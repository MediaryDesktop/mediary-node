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

// Extractor pulls subtitle tracks and fonts out of a file for the renderer.
type Extractor interface {
	Extract(ctx context.Context, path string, info *videofile.MediaInfo) (videofile.Extracted, error)
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

	info, err := s.info(ctx, file)
	if err != nil {
		return nil, err
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

func (s *Service) info(ctx context.Context, file *PlayableFile) (*videofile.MediaInfo, error) {
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

	return info, nil
}

func (s *Service) extracted(ctx context.Context, fileID int64) (*videofile.MediaInfo, videofile.Extracted, error) {
	file, err := s.playable(ctx, fileID)
	if err != nil {
		return nil, videofile.Extracted{}, err
	}

	info, err := s.info(ctx, file)
	if err != nil {
		return nil, videofile.Extracted{}, err
	}

	if s.opts.Extractor == nil {
		return nil, videofile.Extracted{}, apperr.New(apperr.KindPrecondition, "subtitle extraction is not configured on this node")
	}

	out, err := s.opts.Extractor.Extract(ctx, file.Path, info)
	if err != nil {
		if errors.Is(err, exec.ErrNotFound) {
			return nil, videofile.Extracted{}, apperr.Wrap(err, apperr.KindPrecondition,
				"ffmpeg was not found on PATH: install FFmpeg or set NODE_FFMPEG_PATH")
		}

		return nil, videofile.Extracted{}, apperr.Wrap(err, apperr.KindInternal, "could not extract the subtitles of %s", file.Path)
	}

	return info, out, nil
}

// SubtitlePath is one subtitle track of a library file, as ASS.
func (s *Service) SubtitlePath(ctx context.Context, fileID int64, index uint32) (string, error) {
	info, out, err := s.extracted(ctx, fileID)
	if err != nil {
		return "", err
	}

	for _, sub := range info.Subtitles {
		if sub.Index == index {
			return out.Subtitle(index), nil
		}
	}

	return "", apperr.New(apperr.KindNotFound, "file %d has no text subtitle track %d", fileID, index)
}

// FontPath is one font attached to a library file.
func (s *Service) FontPath(ctx context.Context, fileID int64, index uint32) (string, error) {
	info, out, err := s.extracted(ctx, fileID)
	if err != nil {
		return "", err
	}

	for _, font := range info.Fonts {
		if font.Index == index {
			return out.Font(font), nil
		}
	}

	return "", apperr.New(apperr.KindNotFound, "file %d has no attached font %d", fileID, index)
}
