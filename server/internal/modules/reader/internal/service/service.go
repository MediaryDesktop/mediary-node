package service

import (
	"context"
	"path/filepath"
	"strings"
	"sync"

	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/archive"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// PlayableFile is what the reader needs to know about a library file. Which files
// exist is the library's business, reached through a port.
type PlayableFile struct {
	ID       int64
	Path     string
	Title    string
	MediaRef string
	// Chapter is the match's number for the file. For a comic it is the chapter.
	Chapter *int
	Missing bool
}

type Library interface {
	Playable(ctx context.Context, fileID int64) (*PlayableFile, error)
}

// Progress records that a chapter was read. The tracker owns what that means for
// the user's list, including never lowering progress they already have.
type Progress interface {
	MarkRead(ctx context.Context, mediaRef string, chapter int) error
}

type Options struct {
	Library  Library
	Progress Progress
}

type Service struct {
	opts Options

	mu sync.Mutex
	// Chapters the reader already counted. The reader reports every page turn past
	// the end, and each would otherwise be another write to the user's list.
	counted map[int64]bool
}

func New(opts Options) *Service {
	return &Service{opts: opts, counted: map[int64]bool{}}
}

func (s *Service) Status(context.Context) (bool, error) {
	return s.opts.Library != nil, nil
}

type Chapter struct {
	FileID   int64
	Title    string
	MediaRef string
	Chapter  *int
	Pages    []archive.Page
}

// Chapter lists the pages of a comic file in reading order.
func (s *Service) Chapter(ctx context.Context, fileID int64) (*Chapter, error) {
	file, err := s.comic(ctx, fileID)
	if err != nil {
		return nil, err
	}

	pages, err := archive.Pages(file.Path)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindPrecondition, "could not read %s", filepath.Base(file.Path))
	}

	return &Chapter{
		FileID:   file.ID,
		Title:    file.Title,
		MediaRef: file.MediaRef,
		Chapter:  file.Chapter,
		Pages:    pages,
	}, nil
}

// PageImage returns one page of a comic chapter.
func (s *Service) PageImage(ctx context.Context, fileID int64, index int) (archive.Image, error) {
	file, err := s.comic(ctx, fileID)
	if err != nil {
		return archive.Image{}, err
	}

	image, err := archive.ReadPage(file.Path, index)
	if err != nil {
		return archive.Image{}, apperr.Wrap(err, apperr.KindNotFound, "no page %d in %s", index, filepath.Base(file.Path))
	}

	return image, nil
}

// ReportPage is the reader's side of the progress rule: reaching the last page
// counts the chapter as read. It reports whether this call counted it.
func (s *Service) ReportPage(ctx context.Context, fileID int64, page int) (bool, error) {
	file, err := s.comic(ctx, fileID)
	if err != nil {
		return false, err
	}

	pages, err := archive.Pages(file.Path)
	if err != nil {
		return false, apperr.Wrap(err, apperr.KindPrecondition, "could not read %s", filepath.Base(file.Path))
	}

	if !CountsAsRead(page, len(pages)) {
		return false, nil
	}

	s.mu.Lock()
	already := s.counted[fileID]
	s.mu.Unlock()
	if already {
		return true, nil
	}

	if file.MediaRef == "" || file.Chapter == nil || s.opts.Progress == nil {
		return false, nil
	}

	if err := s.opts.Progress.MarkRead(ctx, file.MediaRef, *file.Chapter); err != nil {
		return false, apperr.Wrap(err, apperr.KindUnavailable, "could not record the chapter as read")
	}

	s.mu.Lock()
	s.counted[fileID] = true
	s.mu.Unlock()

	return true, nil
}

// CountsAsRead is the whole rule for a chapter, kept apart because it is the part
// the user would notice being wrong.
func CountsAsRead(page, total int) bool {
	return total > 0 && page >= total-1
}

func (s *Service) comic(ctx context.Context, fileID int64) (*PlayableFile, error) {
	if s.opts.Library == nil {
		return nil, apperr.New(apperr.KindPrecondition, "the reader is not configured on this node")
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

	if strings.ToLower(filepath.Ext(file.Path)) != ".cbz" {
		return nil, apperr.New(apperr.KindPrecondition,
			"only CBZ comics can be read for now; %s is another format", filepath.Base(file.Path))
	}

	return file, nil
}
