package app

import (
	"context"
	"strconv"
	"strings"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library"
	"github.com/mediaryorg/mediary-node/server/internal/modules/manga"
	"github.com/mediaryorg/mediary-node/server/internal/modules/reader"
	"github.com/mediaryorg/mediary-node/server/internal/modules/tracker"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
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

// opdsChapters lets the reader open chapters on the user's OPDS servers. The manga
// module knows the servers; the reader knows reading. Neither imports the other.
type opdsChapters struct {
	manga *manga.Module
}

func (o opdsChapters) Chapter(ctx context.Context, chapter reader.ChapterRef) (*reader.Chapter, error) {
	serverID, key, err := opdsKey(chapter)
	if err != nil {
		return nil, err
	}

	found, err := o.manga.OPDSChapter(ctx, serverID, key)
	if err != nil {
		return nil, err
	}

	pages := make([]reader.Page, found.Pages)
	for i := range pages {
		pages[i] = reader.Page{Index: i}
	}

	return &reader.Chapter{
		Ref:        chapter,
		Title:      found.Title,
		MediaRef:   found.MediaRef,
		Number:     found.Number,
		Pages:      pages,
		SourceName: found.SourceName,
		Groups:     found.Groups,
	}, nil
}

func (o opdsChapters) Page(ctx context.Context, chapter reader.ChapterRef, index int) (reader.Image, error) {
	serverID, key, err := opdsKey(chapter)
	if err != nil {
		return reader.Image{}, err
	}

	data, contentType, err := o.manga.OPDSPage(ctx, serverID, key, index)
	if err != nil {
		return reader.Image{}, err
	}

	return reader.Image{Data: data, ContentType: contentType}, nil
}

// opdsKey splits the key of opds:<server>:<key>; the reference parser has already
// checked the server id is a number.
func opdsKey(chapter reader.ChapterRef) (serverID int64, key string, err error) {
	raw, key, _ := strings.Cut(chapter.Key, ":")

	serverID, err = strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return 0, "", apperr.Invalid("ref", "%s is not an OPDS chapter", chapter)
	}

	return serverID, key, nil
}

// downloadFolders lets the manga module save chapters into library folders and add
// them to the library, without knowing the library module.
type downloadFolders struct {
	library *library.Module
}

func (d downloadFolders) RootPath(ctx context.Context, rootID int64) (path string, found bool, err error) {
	return d.library.RootPath(ctx, rootID)
}

func (d downloadFolders) ImportFile(ctx context.Context, rootID int64, relPath, mediaRef string, chapter *int) (int64, error) {
	return d.library.ImportFile(ctx, rootID, relPath, mediaRef, chapter)
}

func (d downloadFolders) NameEpisode(relPath string) (video bool, episode *int) {
	return d.library.NameEpisode(relPath)
}

// mangaDexChapters lets the reader open MangaDex chapters through the manga module.
type mangaDexChapters struct {
	manga *manga.Module
}

func (m mangaDexChapters) Chapter(ctx context.Context, chapter reader.ChapterRef) (*reader.Chapter, error) {
	found, err := m.manga.MangaDexChapter(ctx, chapter.Key)
	if err != nil {
		return nil, err
	}

	pages := make([]reader.Page, found.Pages)
	for i := range pages {
		pages[i] = reader.Page{Index: i}
	}

	return &reader.Chapter{
		Ref:        chapter,
		Title:      found.Title,
		MediaRef:   found.MediaRef,
		Number:     found.Number,
		Pages:      pages,
		SourceName: found.SourceName,
		Groups:     found.Groups,
	}, nil
}

func (m mangaDexChapters) Page(ctx context.Context, chapter reader.ChapterRef, index int) (reader.Image, error) {
	data, contentType, err := m.manga.MangaDexPage(ctx, chapter.Key, index)
	if err != nil {
		return reader.Image{}, err
	}

	return reader.Image{Data: data, ContentType: contentType}, nil
}
