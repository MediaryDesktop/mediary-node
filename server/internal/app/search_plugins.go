package app

import (
	"context"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/extension"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent"
)

// searchPlugins lets a release search ask the user's plugins, which the
// extension module runs in its sandbox. The torrent module knows neither the
// sandbox nor manifests; the extension module knows nothing of releases'
// ranking or downloads.
type searchPlugins struct {
	extension *extension.Module
}

func (p searchPlugins) TorrentProviders(ctx context.Context) ([]torrent.Provider, error) {
	found, err := p.extension.TorrentProviders(ctx)
	if err != nil {
		return nil, err
	}

	out := make([]torrent.Provider, 0, len(found))
	for _, provider := range found {
		out = append(out, torrent.Provider{ID: provider.ID, Name: provider.Name, Revision: provider.Revision})
	}

	return out, nil
}

func (p searchPlugins) Search(ctx context.Context, id string, query torrent.ProviderQuery) ([]torrent.ProviderRelease, error) {
	releases, err := p.extension.SearchTorrents(ctx, id, extension.SearchRequest{
		Query:     query.Query,
		Titles:    query.Titles,
		Episode:   query.Episode,
		Season:    query.Season,
		AniListID: query.AniListID,
		TMDBID:    query.TMDBID,
	})
	if err != nil {
		return nil, err
	}

	out := make([]torrent.ProviderRelease, 0, len(releases))
	for i := range releases {
		r := &releases[i]
		out = append(out, torrent.ProviderRelease{
			Title:       r.Title,
			Magnet:      r.Magnet,
			Link:        r.Link,
			InfoHash:    r.InfoHash,
			Size:        r.Size,
			Seeders:     r.Seeders,
			Peers:       r.Peers,
			Grabs:       r.Grabs,
			PublishedAt: r.PublishedAt,
			PageURL:     r.PageURL,
		})
	}

	return out, nil
}

func (p searchPlugins) FetchTorrent(ctx context.Context, id, link string) (data []byte, magnet string, err error) {
	return p.extension.FetchTorrent(ctx, id, link)
}
