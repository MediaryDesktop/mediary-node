package service

import (
	"context"

	"github.com/mediaryorg/mediary-node/server/internal/modules/playback/internal/videofile"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// The node serves one renderer, so every request is the same client to the
// transcoder's bookkeeping.
const transcodeClient = "desktop"

// Transcoder cuts a file into HLS segments on demand, re-encoding only what the
// renderer cannot play as it is.
type Transcoder interface {
	GetMaster(path, key string, info *videofile.MediaInfo, client, token string) (string, error)
	GetVideoIndex(path, key string, info *videofile.MediaInfo, quality videofile.Quality, token string) (string, error)
	GetAudioIndex(path, key string, info *videofile.MediaInfo, audio int32, token string) (string, error)
	GetVideoSegment(ctx context.Context, path, key string, info *videofile.MediaInfo, quality videofile.Quality, segment int32, client string) (string, error)
	GetAudioSegment(ctx context.Context, path, key string, info *videofile.MediaInfo, audio, segment int32, client string) (string, error)
	Stop(path string)
}

// HLSRequest addresses one part of a file's HLS stream. Quality is empty and
// Audio set for an audio track; Segment below zero asks for the playlist.
type HLSRequest struct {
	FileID  int64
	Quality string
	Audio   int32
	Segment int32
	Token   string
}

type transcodeTarget struct {
	path string
	key  string
	info *videofile.MediaInfo
}

func (s *Service) transcodeTarget(ctx context.Context, fileID int64) (*transcodeTarget, error) {
	if s.opts.Transcoder == nil {
		return nil, apperr.New(apperr.KindPrecondition, "transcoding is turned off on this node")
	}

	file, err := s.playable(ctx, fileID)
	if err != nil {
		return nil, err
	}

	info, err := s.info(ctx, file)
	if err != nil {
		return nil, err
	}

	key, err := videofile.FileKey(file.Path)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindPrecondition, "cannot read %s", file.Path)
	}

	return &transcodeTarget{path: file.Path, key: key, info: info}, nil
}

func (s *Service) HLSMaster(ctx context.Context, fileID int64, token string) (string, error) {
	target, err := s.transcodeTarget(ctx, fileID)
	if err != nil {
		return "", err
	}

	master, err := s.opts.Transcoder.GetMaster(target.path, target.key, target.info, transcodeClient, token)
	if err != nil {
		return "", transcodeError(err)
	}

	return master, nil
}

// HLSPlaylist is a variant playlist: a video quality, or an audio track.
func (s *Service) HLSPlaylist(ctx context.Context, req HLSRequest) (string, error) {
	target, err := s.transcodeTarget(ctx, req.FileID)
	if err != nil {
		return "", err
	}

	var playlist string
	if req.Quality == "" {
		playlist, err = s.opts.Transcoder.GetAudioIndex(target.path, target.key, target.info, req.Audio, req.Token)
	} else {
		quality, qualityErr := videofile.QualityFromString(req.Quality)
		if qualityErr != nil {
			return "", apperr.Invalid("quality", "unknown quality %q", req.Quality)
		}
		playlist, err = s.opts.Transcoder.GetVideoIndex(target.path, target.key, target.info, quality, req.Token)
	}
	if err != nil {
		return "", transcodeError(err)
	}

	return playlist, nil
}

// HLSSegment waits for the segment to be encoded and returns where it is.
func (s *Service) HLSSegment(ctx context.Context, req HLSRequest) (string, error) {
	target, err := s.transcodeTarget(ctx, req.FileID)
	if err != nil {
		return "", err
	}

	var path string
	if req.Quality == "" {
		path, err = s.opts.Transcoder.GetAudioSegment(ctx, target.path, target.key, target.info, req.Audio, req.Segment, transcodeClient)
	} else {
		quality, qualityErr := videofile.QualityFromString(req.Quality)
		if qualityErr != nil {
			return "", apperr.Invalid("quality", "unknown quality %q", req.Quality)
		}
		path, err = s.opts.Transcoder.GetVideoSegment(ctx, target.path, target.key, target.info, quality, req.Segment, transcodeClient)
	}
	if err != nil {
		return "", transcodeError(err)
	}

	return path, nil
}

// StopTranscode ends a file's encoders when the player closes, rather than
// letting them run until the idle reaper notices.
func (s *Service) StopTranscode(ctx context.Context, fileID int64) error {
	if s.opts.Transcoder == nil {
		return nil
	}

	file, err := s.playable(ctx, fileID)
	if err != nil {
		return err
	}

	s.opts.Transcoder.Stop(file.Path)

	return nil
}

func transcodeError(err error) error {
	return apperr.Wrap(err, apperr.KindUnavailable, "the transcoder could not serve this: %v", err)
}
