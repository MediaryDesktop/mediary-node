package service

import (
	"context"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/archive"
	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/ref"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// Source is where chapters come from. The reader, the progress rule and the page
// endpoint are the same for every source; only finding the pages differs.
type Source interface {
	Chapter(ctx context.Context, chapter ref.ChapterRef) (*Chapter, error)
	Page(ctx context.Context, chapter ref.ChapterRef, index int) (archive.Image, error)
}

// localSource reads chapters that are CBZ files in the user's library.
type localSource struct {
	library Library
}

func (l localSource) Chapter(ctx context.Context, chapter ref.ChapterRef) (*Chapter, error) {
	file, err := l.comic(ctx, chapter)
	if err != nil {
		return nil, err
	}

	pages, err := archive.Pages(file.Path)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindPrecondition, "could not read %s", filepath.Base(file.Path))
	}

	var number string
	if file.Chapter != nil {
		number = strconv.Itoa(*file.Chapter)
	}

	return &Chapter{
		Ref:      chapter,
		FileID:   file.ID,
		Title:    file.Title,
		MediaRef: file.MediaRef,
		Number:   number,
		Pages:    pages,
	}, nil
}

func (l localSource) Page(ctx context.Context, chapter ref.ChapterRef, index int) (archive.Image, error) {
	file, err := l.comic(ctx, chapter)
	if err != nil {
		return archive.Image{}, err
	}

	image, err := archive.ReadPage(file.Path, index)
	if err != nil {
		return archive.Image{}, apperr.Wrap(err, apperr.KindNotFound, "no page %d in %s", index, filepath.Base(file.Path))
	}

	return image, nil
}

func (l localSource) comic(ctx context.Context, chapter ref.ChapterRef) (*PlayableFile, error) {
	fileID, ok := chapter.FileID()
	if !ok {
		return nil, apperr.Invalid("ref", "%s is not a library file", chapter)
	}

	file, err := l.library.Playable(ctx, fileID)
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
