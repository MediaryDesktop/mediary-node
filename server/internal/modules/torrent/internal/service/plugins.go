package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/metainfo"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/release"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

// Providers are the user's search plugins, wired by internal/app. A plugin
// only finds releases; everything after — parsing, matching, ranking,
// downloading — is this module's, as for a Torznab source.
type Providers interface {
	// TorrentProviders are the plugins on now that search for torrents.
	TorrentProviders(ctx context.Context) ([]Provider, error)
	Search(ctx context.Context, id string, query ProviderQuery) ([]ProviderRelease, error)
	// FetchTorrent downloads the .torrent a plugin's release links to, under
	// the plugin's own rules — never with this module's HTTP client.
	FetchTorrent(ctx context.Context, id, link string) (data []byte, magnet string, err error)
}

type Provider struct {
	ID   string
	Name string
	// Revision changes with the plugin's code or settings, and with it what the
	// plugin would answer.
	Revision string
}

// ProviderQuery is what a plugin is asked: one query of the search, with what
// the node knows of the title.
type ProviderQuery struct {
	Query     string
	Titles    []string
	Episode   int
	Season    int
	AniListID int
	TMDBID    int
}

type ProviderRelease struct {
	Title       string
	Magnet      string
	Link        string
	InfoHash    string
	Size        int64
	Seeders     int
	Peers       int
	Grabs       int
	PublishedAt *time.Time
	PageURL     string
}

// SearchPlugins is how many search plugins are on: with one, a search needs no
// Torznab source.
func (s *Service) SearchPlugins(ctx context.Context) (int, error) {
	if s.opts.Providers == nil {
		return 0, nil
	}

	providers, err := s.opts.Providers.TorrentProviders(ctx)
	if err != nil {
		return 0, apperr.Wrap(err, apperr.KindInternal, "list search plugins")
	}

	return len(providers), nil
}

type cachedPluginAnswer struct {
	releases []ProviderRelease
	at       time.Time
}

// askPlugin is one plugin's answer to one query, from the cache while it is
// fresh. The plugin's revision is part of the key: an update or a changed
// setting answers anew.
func (s *Service) askPlugin(ctx context.Context, provider Provider, query ProviderQuery) ([]ProviderRelease, error) {
	cacheKey := strings.Join([]string{
		provider.ID, provider.Revision,
		strconv.Itoa(query.Episode), strconv.Itoa(query.Season),
		strings.ToLower(query.Query),
	}, "\x00")
	now := s.opts.Now()

	s.search.mu.Lock()
	cached, ok := s.search.plugins[cacheKey]
	s.search.mu.Unlock()

	if ok && now.Sub(cached.at) < searchTTL {
		return cached.releases, nil
	}

	releases, err := s.opts.Providers.Search(ctx, provider.ID, query)
	if err != nil {
		return nil, err
	}

	if len(releases) > 0 {
		s.search.mu.Lock()
		s.search.plugins[cacheKey] = cachedPluginAnswer{releases: releases, at: now}
		s.search.mu.Unlock()
	}

	return releases, nil
}

func (s *Service) releaseOfPlugin(provider Provider, item ProviderRelease) TorrentRelease {
	found := TorrentRelease{
		SourceName:  provider.Name,
		Plugin:      provider.ID,
		Title:       item.Title,
		PageURL:     item.PageURL,
		Size:        item.Size,
		Seeders:     item.Seeders,
		Peers:       item.Peers,
		Grabs:       item.Grabs,
		InfoHash:    item.InfoHash,
		PublishedAt: item.PublishedAt,
		Info:        release.Parse(item.Title),
		magnet:      item.Magnet,
		link:        item.Link,
	}

	// Sites put the hash in the magnet and nowhere else; the node needs it apart
	// to tell one torrent found twice and to ask a debrid service about it.
	if found.InfoHash == "" && found.magnet != "" {
		if info, err := metainfo.FromMagnet(found.magnet); err == nil {
			found.InfoHash = info.InfoHash
		}
	}

	// A hash alone is enough to fetch a torrent: the client finds its peers
	// by it.
	if found.magnet == "" && found.link == "" && found.InfoHash != "" {
		found.magnet = "magnet:?xt=urn:btih:" + found.InfoHash + "&dn=" + url.QueryEscape(item.Title)
	}

	if found.InfoHash != "" {
		found.ID = "h" + found.InfoHash
	} else {
		sum := sha256.Sum256([]byte("plugin\x00" + provider.ID + "\x00" + item.Link + "\x00" + item.Magnet))
		found.ID = "r" + hex.EncodeToString(sum[:12])
	}

	return found
}

// titleIDs reads the ids a plugin can search by out of a media reference:
// "anilist:154587", "tmdb:movie:603", "tmdb:tv:1396".
func titleIDs(mediaRef string) (anilistID, tmdbID int) {
	provider, rest, _ := strings.Cut(mediaRef, ":")

	switch provider {
	case "anilist":
		anilistID, _ = strconv.Atoi(rest)
	case "tmdb":
		_, raw, _ := strings.Cut(rest, ":")
		tmdbID, _ = strconv.Atoi(raw)
	}

	return max(anilistID, 0), max(tmdbID, 0)
}
