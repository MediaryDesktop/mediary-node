package service

import (
	"context"
	"math"
	"strconv"
	"strings"
	"sync"

	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/archive"
	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/ref"
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
	opts    Options
	sources map[string]Source

	mu sync.Mutex
	// Chapters the reader already counted, by reference. The reader reports every
	// page turn past the end, and each would otherwise be another write to the
	// user's list.
	counted map[string]bool
}

func New(opts Options) *Service {
	sources := map[string]Source{}
	if opts.Library != nil {
		sources[ref.SourceLocal] = localSource{library: opts.Library}
	}

	return &Service{opts: opts, sources: sources, counted: map[string]bool{}}
}

func (s *Service) Status(context.Context) (bool, error) {
	return s.opts.Library != nil, nil
}

// Chapter is one chapter as the reader shows it, whichever source it came from.
type Chapter struct {
	Ref ref.ChapterRef
	// FileID is the library file of a local chapter, and zero for any other.
	FileID   int64
	Title    string
	MediaRef string
	// Number is the chapter number as the source writes it: "12", "12.5", or empty
	// for an extra. Only a whole number moves progress; see ProgressChapter.
	Number string
	Pages  []archive.Page
}

// Chapter lists the pages of a chapter in reading order.
func (s *Service) Chapter(ctx context.Context, chapter ref.ChapterRef) (*Chapter, error) {
	source, err := s.source(chapter)
	if err != nil {
		return nil, err
	}

	return source.Chapter(ctx, chapter)
}

// PageImage returns one page of a chapter.
func (s *Service) PageImage(ctx context.Context, chapter ref.ChapterRef, index int) (archive.Image, error) {
	source, err := s.source(chapter)
	if err != nil {
		return archive.Image{}, err
	}

	return source.Page(ctx, chapter, index)
}

// ReportPage is the reader's side of the progress rule: reaching the last page
// counts the chapter as read. It reports whether the chapter counts, on this call
// or an earlier one.
func (s *Service) ReportPage(ctx context.Context, chapterRef ref.ChapterRef, page int) (bool, error) {
	chapter, err := s.Chapter(ctx, chapterRef)
	if err != nil {
		return false, err
	}

	if !CountsAsRead(page, len(chapter.Pages)) {
		return false, nil
	}

	key := chapterRef.String()

	s.mu.Lock()
	already := s.counted[key]
	s.mu.Unlock()
	if already {
		return true, nil
	}

	number, whole := ProgressChapter(chapter.Number)
	if chapter.MediaRef == "" || !whole || s.opts.Progress == nil {
		return false, nil
	}

	if err := s.opts.Progress.MarkRead(ctx, chapter.MediaRef, number); err != nil {
		return false, apperr.Wrap(err, apperr.KindUnavailable, "could not record the chapter as read")
	}

	s.mu.Lock()
	s.counted[key] = true
	s.mu.Unlock()

	return true, nil
}

// CountsAsRead is the whole rule for a chapter, kept apart because it is the part
// the user would notice being wrong.
func CountsAsRead(page, total int) bool {
	return total > 0 && page >= total-1
}

// ProgressChapter is the chapter a read chapter moves the user's list to. Lists
// count whole chapters, so "12" moves it to 12, while "12.5" (an extra between two
// chapters) and an unnumbered chapter do not move it at all.
func ProgressChapter(number string) (int, bool) {
	value, err := strconv.ParseFloat(strings.TrimSpace(number), 64)
	if err != nil || value <= 0 || value != math.Trunc(value) || value > math.MaxInt32 {
		return 0, false
	}

	return int(value), true
}

func (s *Service) source(chapter ref.ChapterRef) (Source, error) {
	if chapter.Source == ref.SourceLocal && s.opts.Library == nil {
		return nil, apperr.New(apperr.KindPrecondition, "the reader is not configured on this node")
	}

	source, ok := s.sources[chapter.Source]
	if !ok {
		return nil, apperr.New(apperr.KindPrecondition, "chapters from %s cannot be read on this node yet", chapter.Source)
	}

	return source, nil
}
