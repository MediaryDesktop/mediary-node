package app

import (
	"context"
	"strings"

	"github.com/rs/zerolog"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/library"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/playback"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/progress"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/reader"
)

// playbackPositions keeps where the player stopped. Only here are both the
// library and the episode numbering known, so only here is a file turned into
// a name that means the same on another computer: its title and episode across
// seasons when it is matched to one, what the file holds when it is not.
type playbackPositions struct {
	progress *progress.Module
	library  *library.Module
}

func (p playbackPositions) SavePosition(
	ctx context.Context, file *playback.PlayableFile, position, duration float64, reached bool,
) error {
	key, ok, err := p.key(ctx, file)
	if err != nil || !ok {
		return err
	}

	return p.progress.SaveWatch(ctx, key, position, duration, reached)
}

func (p playbackPositions) ResumeAt(ctx context.Context, file *playback.PlayableFile) (float64, error) {
	key, ok, err := p.key(ctx, file)
	if err != nil || !ok {
		return 0, err
	}

	return p.progress.ResumeAt(ctx, key)
}

// key is false for a stream matched to nothing: it has no file in the library
// to name by its content, and nothing else to name it by.
func (p playbackPositions) key(
	ctx context.Context, file *playback.PlayableFile,
) (key progress.WatchKey, named bool, err error) {
	if file.MediaRef != "" && file.Episode != nil && *file.Episode > 0 {
		return progress.WatchKey{MediaRef: file.MediaRef, Episode: *file.Episode}, true, nil
	}

	if file.Remote || file.ID <= 0 {
		return progress.WatchKey{}, false, nil
	}

	contentKey, err := p.library.ContentKey(ctx, file.ID)
	if err != nil {
		return progress.WatchKey{}, false, err
	}

	return progress.WatchKey{ContentKey: contentKey}, true, nil
}

// readingPositions keeps where the reader left each book and chapter, named the
// way playbackPositions names episodes.
type readingPositions struct {
	progress *progress.Module
	library  *library.Module
}

func (r readingPositions) Book(ctx context.Context, book *reader.BookFile) (*reader.BookPosition, error) {
	contentKey, err := r.library.ContentKey(ctx, book.FileID)
	if err != nil {
		return nil, err
	}

	kept, err := r.progress.Book(ctx, contentKey)
	if err != nil || kept == nil {
		return nil, err
	}

	return &reader.BookPosition{Locator: kept.Locator, Fraction: kept.Fraction, UpdatedAt: kept.UpdatedAt}, nil
}

func (r readingPositions) SaveBook(ctx context.Context, book *reader.BookFile, position reader.BookPosition) error {
	contentKey, err := r.library.ContentKey(ctx, book.FileID)
	if err != nil {
		return err
	}

	return r.progress.SaveBook(ctx, progress.Book{
		ContentKey: contentKey,
		MediaRef:   book.MediaRef,
		Locator:    position.Locator,
		Fraction:   position.Fraction,
		UpdatedAt:  position.UpdatedAt,
	})
}

func (r readingPositions) ResumePage(ctx context.Context, chapter *reader.Chapter) (int, error) {
	key, ok, err := r.key(ctx, chapter)
	if err != nil || !ok {
		return 0, err
	}

	return r.progress.ResumePage(ctx, key)
}

func (r readingPositions) SavePage(ctx context.Context, chapter *reader.Chapter, page int, read bool) error {
	key, ok, err := r.key(ctx, chapter)
	if err != nil || !ok {
		return err
	}

	return r.progress.SaveChapter(ctx, key, page, len(chapter.Pages), read)
}

// key names a chapter by its title and number when it has both; otherwise by
// what its source says it is, or for a library file by what the file holds.
func (r readingPositions) key(
	ctx context.Context, chapter *reader.Chapter,
) (key progress.ChapterKey, named bool, err error) {
	if number := strings.TrimSpace(chapter.Number); chapter.MediaRef != "" && number != "" {
		return progress.ChapterKey{MediaRef: chapter.MediaRef, Chapter: number}, true, nil
	}

	if chapter.Identity != "" {
		return progress.ChapterKey{SourceRef: chapter.Identity}, true, nil
	}

	if chapter.FileID > 0 {
		contentKey, err := r.library.ContentKey(ctx, chapter.FileID)
		if err != nil {
			return progress.ChapterKey{}, false, err
		}

		return progress.ChapterKey{SourceRef: "file:" + contentKey}, true, nil
	}

	return progress.ChapterKey{}, false, nil
}

func moveBookPositions(ctx context.Context, readerModule *reader.Module, logger zerolog.Logger) {
	moved, err := readerModule.MoveLegacyPositions(ctx)
	if err != nil && ctx.Err() == nil {
		logger.Warn().Err(err).Msg("could not move book positions")
	}

	if moved > 0 {
		logger.Info().Int("moved", moved).Msg("moved book positions to where backups find them")
	}
}
