package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/mediaryorg/mediary-node/server/internal/modules/playback/internal/videofile"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// Prober reads what streams a file holds. The real one runs ffprobe and keeps
// the answer per file version.
type Prober interface {
	Info(ctx context.Context, path string) (*videofile.MediaInfo, error)
}

// Extractor pulls subtitle tracks and fonts out of a file for the renderer. key
// names the file for the cache; empty means the file's own version on disk.
type Extractor interface {
	Extract(ctx context.Context, path, key string, info *videofile.MediaInfo) (videofile.Extracted, error)
}

// Thumbnailer cuts a still out of a video file, for an episode no source has an
// image for.
type Thumbnailer interface {
	Thumbnail(ctx context.Context, path string, duration float64) (string, error)
}

// Stream is what the built-in player needs before it can choose how to play a
// file: what is inside it, and where to fetch it from.
type Stream struct {
	FileID   int64  `json:"file_id" doc:"Library file this describes."`
	Title    string `json:"title" doc:"Title as the library reads it, for the UI."`
	MediaRef string `json:"media_ref,omitempty" doc:"Title this file is matched to. Absent while unmatched."`
	Episode  *int   `json:"episode,omitempty" doc:"Episode number within that title."`

	Info *videofile.MediaInfo `json:"info" doc:"Streams, codecs and chapters as ffprobe reports them."`

	DirectURL string `json:"direct_url" doc:"Path that serves the file as it is, with range requests. The renderer appends the URL token as ?token= because a video element cannot send headers."`

	HLSURL string `json:"hls_url,omitempty" doc:"Master playlist of the file transcoded to HLS, for when the renderer cannot play it directly. Absent while transcoding is turned off."`
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
		HLSURL:    s.hlsURL(file.ID),
	}, nil
}

func (s *Service) hlsURL(fileID int64) string {
	if s.opts.Transcoder == nil {
		return ""
	}

	return fmt.Sprintf("/v1/playback/files/%d/hls/master.m3u8", fileID)
}

// DirectSource is what a direct-play request serves: a file on disk, or a
// stream's link to pass the request on to.
type DirectSource struct {
	Path   string
	Remote bool
	// Open, when set, reads the stream from the node's own client in place of
	// passing the request on to Path.
	Open func(ctx context.Context) (io.ReadSeekCloser, error)
	// Name is the file's own name, whose extension says the container.
	Name string
}

// DirectSource resolves a direct-play request. Only library files and streams
// the node made can be served, by id, so the endpoint never reads a path or
// fetches an address a caller chose.
func (s *Service) DirectSource(ctx context.Context, fileID int64) (*DirectSource, error) {
	file, err := s.playable(ctx, fileID)
	if err != nil {
		return nil, err
	}

	if file.Remote {
		return &DirectSource{Path: file.Path, Remote: true, Open: file.Open, Name: file.Title}, nil
	}

	return &DirectSource{Path: file.Path, Name: file.Path}, nil
}

// RenewDirectSource is DirectSource with a fresh link, after the service's CDN
// refused the one it had.
func (s *Service) RenewDirectSource(ctx context.Context, fileID int64) (*DirectSource, error) {
	renewer, ok := s.opts.Library.(LinkRenewer)
	if !ok {
		return nil, apperr.New(apperr.KindUpstream, "the debrid service refused the stream")
	}

	renewer.RenewLink(fileID)

	return s.DirectSource(ctx, fileID)
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

	// A stream is probed over the network, so its answer is kept for the
	// session: the player asks for it before every track and segment.
	if file.Remote {
		s.mu.Lock()
		cached := s.remoteInfo[file.Key]
		s.mu.Unlock()
		if cached != nil {
			return cached, nil
		}
	}

	source, err := s.source(file)
	if err != nil {
		return nil, err
	}

	info, err := s.opts.Prober.Info(ctx, source)
	if err != nil {
		if errors.Is(err, exec.ErrNotFound) {
			return nil, missingTool(err, "ffprobe")
		}

		if file.Remote {
			return nil, apperr.Wrap(err, apperr.KindUpstream, "could not read the streams of %s from the service", file.Title)
		}

		return nil, apperr.Wrap(err, apperr.KindInternal, "could not read the streams of %s", file.Path)
	}

	if file.Remote {
		// The probe saw the node's own address; the container is in the name.
		info.Extension = strings.TrimPrefix(filepath.Ext(file.Title), ".")

		s.mu.Lock()
		if s.remoteInfo == nil {
			s.remoteInfo = map[string]*videofile.MediaInfo{}
		}
		s.remoteInfo[file.Key] = info
		s.mu.Unlock()
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

	source, err := s.source(file)
	if err != nil {
		return nil, videofile.Extracted{}, err
	}

	// A stream's tracks are read through the whole file, over the network: it
	// takes as long as fetching the file once.
	out, err := s.opts.Extractor.Extract(ctx, source, file.Key, info)
	if err != nil {
		if errors.Is(err, exec.ErrNotFound) {
			return nil, videofile.Extracted{}, missingTool(err, "ffmpeg")
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

// ThumbnailPath is a still from a library file, cut on first request and kept
// while the file stays the same.
func (s *Service) ThumbnailPath(ctx context.Context, fileID int64) (string, error) {
	if s.opts.Thumbnailer == nil {
		return "", apperr.New(apperr.KindPrecondition, "thumbnails are not configured on this node")
	}

	file, err := s.playable(ctx, fileID)
	if err != nil {
		return "", err
	}

	// A still would mean reading into the middle of a file nobody downloaded.
	if file.Remote {
		return "", apperr.New(apperr.KindNotFound, "a stream has no still")
	}

	var duration float64
	if file.Duration != nil {
		duration = file.Duration.Seconds()
	}

	path, err := s.opts.Thumbnailer.Thumbnail(ctx, file.Path, duration)
	if err != nil {
		if errors.Is(err, exec.ErrNotFound) {
			return "", missingTool(err, "ffmpeg")
		}

		return "", apperr.Wrap(err, apperr.KindInternal, "could not cut a still from %s", file.Path)
	}

	return path, nil
}

// missingTool is the error for a program the node could not run. The finder's
// own message says what to do — install it, or fix the path set by hand — so it
// is the message, as with mpv.
func missingTool(err error, program string) error {
	var missing interface {
		error
		MissingProgram() string
	}
	if errors.As(err, &missing) {
		return apperr.Wrap(err, apperr.KindPrecondition, "%v", missing)
	}

	return apperr.Wrap(err, apperr.KindPrecondition,
		"%s was not found: install FFmpeg on the Extensions page, under Dependencies", program)
}
