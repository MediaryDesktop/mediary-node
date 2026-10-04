package app

import (
	"context"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library"
	"github.com/mediaryorg/mediary-node/server/internal/modules/reader"
	"github.com/mediaryorg/mediary-node/server/internal/modules/tracker"
)

// readableFiles hands the reader a library file by id, never a path the client
// chose, the same way the player does.
type readableFiles struct {
	library *library.Module
}

func (r readableFiles) Playable(ctx context.Context, fileID int64) (*reader.ReadableFile, error) {
	file, err := r.library.Playable(ctx, fileID)
	if err != nil || file == nil {
		return nil, err
	}

	return &reader.ReadableFile{
		ID:       file.ID,
		Path:     file.Path,
		Title:    file.Title,
		MediaRef: file.MediaRef,
		Chapter:  file.Episode,
		Missing:  file.Missing,
	}, nil
}

// readChapters carries read chapters to the tracker, which owns what they mean for
// the user's list.
type readChapters struct {
	tracker *tracker.Module
}

func (c readChapters) MarkRead(ctx context.Context, mediaRef string, chapter int) error {
	return c.tracker.MarkRead(ctx, mediaRef, chapter)
}
