package app

import (
	"context"
	"strings"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/extension"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/manga"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/reader"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

// mangaPlugins lets the manga module read from the user's manga plugins, which
// the extension module runs in its sandbox. The manga module knows neither the
// sandbox nor manifests; the extension module knows nothing of links,
// chapters' order or the reader.
type mangaPlugins struct {
	extension *extension.Module
}

func (p mangaPlugins) MangaProviders(ctx context.Context) ([]manga.PluginProvider, error) {
	found, err := p.extension.MangaProviders(ctx)
	if err != nil {
		return nil, err
	}

	out := make([]manga.PluginProvider, 0, len(found))
	for _, provider := range found {
		out = append(out, manga.PluginProvider{ID: provider.ID, Name: provider.Name, Revision: provider.Revision})
	}

	return out, nil
}

func (p mangaPlugins) MangaSearch(ctx context.Context, id, query string, titles []string, anilistID int) ([]manga.PluginSeries, error) {
	found, err := p.extension.MangaSearch(ctx, id, extension.MangaSearchRequest{Query: query, Titles: titles, AniListID: anilistID})
	if err != nil {
		return nil, err
	}

	out := make([]manga.PluginSeries, 0, len(found))
	for _, series := range found {
		out = append(out, manga.PluginSeries{ID: series.ID, Title: series.Title, Detail: series.Detail})
	}

	return out, nil
}

func (p mangaPlugins) MangaChapters(ctx context.Context, id, seriesID string) ([]manga.PluginChapter, error) {
	found, err := p.extension.MangaChapters(ctx, id, seriesID)
	if err != nil {
		return nil, err
	}

	out := make([]manga.PluginChapter, 0, len(found))
	for _, c := range found {
		out = append(out, manga.PluginChapter{
			ID:       c.ID,
			Number:   c.Number,
			Title:    c.Title,
			Volume:   c.Volume,
			Language: c.Language,
			Groups:   c.Groups,
		})
	}

	return out, nil
}

func (p mangaPlugins) MangaPages(ctx context.Context, id, chapterID string) ([]manga.PluginPage, error) {
	found, err := p.extension.MangaPages(ctx, id, chapterID)
	if err != nil {
		return nil, err
	}

	out := make([]manga.PluginPage, 0, len(found))
	for _, page := range found {
		out = append(out, manga.PluginPage{URL: page.URL, Referer: page.Referer})
	}

	return out, nil
}

func (p mangaPlugins) FetchImage(ctx context.Context, id string, page manga.PluginPage) (data []byte, contentType string, err error) {
	return p.extension.FetchImage(ctx, id, extension.Page{URL: page.URL, Referer: page.Referer})
}

// pluginChapters lets the reader open a manga plugin's chapters through the
// manga module.
type pluginChapters struct {
	manga *manga.Module
}

func (c pluginChapters) Chapter(ctx context.Context, chapter reader.ChapterRef) (*reader.Chapter, error) {
	pluginID, key, err := pluginKey(chapter)
	if err != nil {
		return nil, err
	}

	found, err := c.manga.PluginChapter(ctx, pluginID, key)
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

func (c pluginChapters) Page(ctx context.Context, chapter reader.ChapterRef, index int) (reader.Image, error) {
	pluginID, key, err := pluginKey(chapter)
	if err != nil {
		return reader.Image{}, err
	}

	data, contentType, err := c.manga.PluginPage(ctx, pluginID, key, index)
	if err != nil {
		return reader.Image{}, err
	}

	return reader.Image{Data: data, ContentType: contentType}, nil
}

// pluginKey splits the key of plugin:<id>:<key>, which the reference parser
// has already checked.
func pluginKey(chapter reader.ChapterRef) (pluginID, key string, err error) {
	pluginID, key, ok := strings.Cut(chapter.Key, ":")
	if !ok {
		return "", "", apperr.Invalid("ref", "%s is not a plugin's chapter", chapter)
	}

	return pluginID, key, nil
}
