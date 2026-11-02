package app

import (
	"context"

	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource"
	"github.com/mediaryorg/mediary-node/server/internal/modules/library"
	"github.com/mediaryorg/mediary-node/server/internal/modules/media"
)

// bookFolders lets the booksource module save books into library folders of
// books and add them to the library, without touching the library's tables.
type bookFolders struct {
	library *library.Module
}

func (b bookFolders) RootPath(ctx context.Context, rootID int64) (path string, found bool, err error) {
	return b.library.RootPath(ctx, rootID)
}

func (b bookFolders) RootContent(ctx context.Context, rootID int64) (content string, found bool, err error) {
	return b.library.RootContent(ctx, rootID)
}

func (b bookFolders) EnsureRootOf(ctx context.Context, path, content string) (rootID int64, relDir string, err error) {
	return b.library.EnsureRootOf(ctx, path, content)
}

func (b bookFolders) ImportFile(ctx context.Context, rootID int64, relPath, mediaRef string, episode *int) (int64, error) {
	return b.library.ImportFile(ctx, rootID, relPath, mediaRef, episode)
}

// bookWorks names a book for a search of free copies, from the details the node
// fetched when its page was opened; a book it never saw is fetched now.
type bookWorks struct {
	media *media.Module
}

func (b bookWorks) Work(ctx context.Context, mediaRef string) (*booksource.Work, error) {
	details, err := b.media.Cached(ctx, mediaRef)
	if err != nil {
		return nil, err
	}
	if details == nil {
		if details, err = b.media.Details(ctx, mediaRef); err != nil {
			return nil, err
		}
	}
	if details == nil || details.Title.UserPreferred == nil {
		return nil, nil
	}

	return &booksource.Work{Title: *details.Title.UserPreferred, Authors: details.Authors}, nil
}
