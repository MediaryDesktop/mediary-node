package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/metainfo"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/release"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/torznab"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

const (
	// How long one source's answer to one query is reused.
	searchTTL = 10 * time.Minute
	// How long a result can still be downloaded by its id after the search.
	releaseTTL = 30 * time.Minute
	// The most title names one search asks for.
	maxQueries = 3
	// How long a search waits for the slowest source or plugin; more than either
	// gives itself, so each fails with its own reason.
	searchTimeout = 25 * time.Second
)

// Titles is where the names of a title come from, wired by internal/app.
type Titles interface {
	// Names are the title's names worth searching for, best first; none when the
	// node does not know the title.
	Names(ctx context.Context, mediaRef string) ([]string, error)
	// TotalEpisodes is how many episodes the title has, when the source knows.
	TotalEpisodes(ctx context.Context, mediaRef string) (*int, error)
}

type SearchRequest struct {
	MediaRef string
	// Episode narrows the results to releases that hold it; 0 for any.
	Episode int
	// Season narrows the results to releases of that season, for a show numbered
	// by season; Episode then counts within it. 0 for a title that is not.
	Season int
	// Query replaces the title's names.
	Query string
}

// TorrentRelease is one search result.
type TorrentRelease struct {
	ID          string     `json:"id" doc:"Pass as release_id to download it."`
	SourceID    int64      `json:"source_id" doc:"The Torznab source it came from; 0 when a plugin found it."`
	SourceName  string     `json:"source_name"`
	Plugin      string     `json:"plugin,omitempty" doc:"The search plugin it came from, by id."`
	Indexer     string     `json:"indexer,omitempty" doc:"The site behind the source, when the source says."`
	Title       string     `json:"title"`
	PageURL     string     `json:"page_url,omitempty"`
	Size        int64      `json:"size"`
	Seeders     int        `json:"seeders"`
	Peers       int        `json:"peers"`
	Grabs       int        `json:"grabs"`
	PublishedAt *time.Time `json:"published_at,omitempty"`
	InfoHash    string     `json:"info_hash,omitempty"`
	Cached      *bool      `json:"cached,omitempty" doc:"With a debrid service as the client, whether it already holds the release, which then arrives at once. Absent with other clients, or when the service could not be asked."`

	release.Info

	Match string `json:"match" enum:"episode,batch,unknown,any" doc:"How it fits the episode searched for: the episode alone, a batch that holds it, a name without episodes, or no episode was asked."`

	Score    int  `json:"score" doc:"How well it fits the release profile; higher is better."`
	Eligible bool `json:"eligible" doc:"False when an excluded word or too few seeders keep it from being the best."`
	Best     bool `json:"best" doc:"The one result the profile would pick."`

	// Kept on the node: a link may carry the source's key.
	magnet string
	link   string
}

// TorrentSourceOutcome is how one source answered.
type TorrentSourceOutcome struct {
	ID      int64  `json:"id" doc:"The Torznab source; 0 for a plugin."`
	Plugin  string `json:"plugin,omitempty" doc:"The search plugin, by id."`
	Name    string `json:"name"`
	Results int    `json:"results"`
	Error   string `json:"error,omitempty"`
}

type TorrentSearchResult struct {
	Queries  []string               `json:"queries"`
	Releases []TorrentRelease       `json:"releases"`
	Sources  []TorrentSourceOutcome `json:"sources"`
	// CacheService names the service the cached marks are about.
	CacheService string `json:"cache_service,omitempty" example:"TorBox" doc:"The debrid service the releases' cached marks are about; absent when there are none."`
}

type searchCache struct {
	mu       sync.Mutex
	answers  map[string]cachedAnswer
	plugins  map[string]cachedPluginAnswer
	releases map[string]cachedRelease
}

type cachedAnswer struct {
	items []torznab.Item
	at    time.Time
}

type cachedRelease struct {
	release TorrentRelease
	at      time.Time
}

func (s *Service) forgetSearches() {
	s.search.mu.Lock()
	defer s.search.mu.Unlock()

	s.search.answers = map[string]cachedAnswer{}
	s.search.plugins = map[string]cachedPluginAnswer{}
}

func (s *Service) Search(ctx context.Context, req SearchRequest) (*TorrentSearchResult, error) {
	if req.Episode < 0 {
		return nil, apperr.Invalid("episode", "an episode number cannot be negative")
	}
	if req.Season < 0 {
		return nil, apperr.Invalid("season", "a season number cannot be negative")
	}

	queries, names, err := s.queries(ctx, req)
	if err != nil {
		return nil, err
	}

	sources, err := s.store.Sources(ctx)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "list search sources")
	}

	var providers []Provider
	if s.opts.Providers != nil {
		if providers, err = s.opts.Providers.TorrentProviders(ctx); err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "list search plugins")
		}
	}

	if len(sources) == 0 && len(providers) == 0 {
		return nil, apperr.New(apperr.KindPrecondition, "add a Torznab source — Jackett or Prowlarr — or install a search plugin first")
	}

	// The wait is the sources' alone: reading the profile and asking the debrid
	// service afterwards still have the request's own time.
	askCtx, cancel := context.WithTimeout(ctx, s.opts.SearchTimeout)
	defer cancel()

	// One answer from one source or plugin to one query, already turned into
	// releases.
	type answer struct {
		outcome  string
		releases []TorrentRelease
		err      error
	}

	answers := make(chan answer)
	var wg sync.WaitGroup

	outcomes := make(map[string]*TorrentSourceOutcome, len(sources)+len(providers))
	order := make([]string, 0, len(sources)+len(providers))

	for _, source := range sources {
		key, keyErr := s.secrets.Get(sourceKey(source.ID))
		if keyErr != nil {
			return nil, apperr.Wrap(keyErr, apperr.KindInternal, "read a search source's key")
		}

		outcomeKey := "t" + strconv.FormatInt(source.ID, 10)
		outcomes[outcomeKey] = &TorrentSourceOutcome{ID: source.ID, Name: source.Name}
		order = append(order, outcomeKey)

		for _, query := range queries {
			wg.Add(1)
			go func(source store.Source, query string) {
				defer wg.Done()
				items, askErr := s.ask(askCtx, source, key, query)

				found := make([]TorrentRelease, 0, len(items))
				for i := range items {
					found = append(found, s.releaseOf(source, items[i]))
				}
				answers <- answer{outcome: outcomeKey, releases: found, err: askErr}
			}(source, query)
		}
	}

	anilistID, tmdbID := titleIDs(req.MediaRef)

	for _, provider := range providers {
		outcomeKey := "p" + provider.ID
		outcomes[outcomeKey] = &TorrentSourceOutcome{Plugin: provider.ID, Name: provider.Name}
		order = append(order, outcomeKey)

		for _, query := range queries {
			wg.Add(1)
			go func(provider Provider, query string) {
				defer wg.Done()
				items, askErr := s.askPlugin(askCtx, provider, ProviderQuery{
					Query:     query,
					Titles:    names,
					Episode:   req.Episode,
					Season:    req.Season,
					AniListID: anilistID,
					TMDBID:    tmdbID,
				})

				found := make([]TorrentRelease, 0, len(items))
				for i := range items {
					found = append(found, s.releaseOfPlugin(provider, items[i]))
				}
				answers <- answer{outcome: outcomeKey, releases: found, err: askErr}
			}(provider, query)
		}
	}

	go func() {
		wg.Wait()
		close(answers)
	}()

	byID := map[string]TorrentRelease{}

	for got := range answers {
		outcome := outcomes[got.outcome]

		if got.err != nil {
			if outcome.Error == "" {
				outcome.Error = messageOf(got.err)
			}
			continue
		}

		for i := range got.releases {
			found := got.releases[i]
			outcome.Results++

			if existing, ok := byID[found.ID]; !ok || better(found, existing) {
				byID[found.ID] = found
			}
		}
	}

	releases := make([]TorrentRelease, 0, len(byID))
	for id := range byID {
		found := byID[id]
		found.Match = matchOf(found.Info, req.Episode, req.Season)
		if found.Match == "" {
			continue
		}
		releases = append(releases, found)
	}

	profile, err := s.Profile(ctx)
	if err != nil {
		return nil, err
	}

	cacheService := s.markCached(ctx, releases)

	rank(releases, profile)
	sortReleases(releases)
	s.keep(releases)

	result := &TorrentSearchResult{Queries: queries, Releases: releases, CacheService: cacheService}
	for _, key := range order {
		result.Sources = append(result.Sources, *outcomes[key])
	}

	return result, nil
}

// How long a search waits for the debrid service to say what it holds; past
// this the results come without the marks rather than late.
const cacheCheckTimeout = 10 * time.Second

// markCached asks a debrid client which releases it already holds and marks
// them, returning the service's name; "" when the client is not one or could not
// be asked, and then no release is marked either way.
func (s *Service) markCached(ctx context.Context, releases []TorrentRelease) string {
	// The debrid service set up, whatever the torrent client: a release it holds
	// plays at once even when the library downloads through qBittorrent.
	active, err := s.activeDebrid(ctx)
	if err != nil || active == nil {
		return ""
	}

	checker, ok := active.service.Client.(CacheChecker)
	if !ok {
		return ""
	}

	byHash := map[string][]int{}
	for i := range releases {
		hash := strings.ToLower(releases[i].InfoHash)
		if hash == "" && releases[i].magnet != "" {
			if info, magnetErr := metainfo.FromMagnet(releases[i].magnet); magnetErr == nil {
				hash = info.InfoHash
			}
		}
		if hash != "" {
			byHash[hash] = append(byHash[hash], i)
		}
	}
	if len(byHash) == 0 {
		return ""
	}

	hashes := make([]string, 0, len(byHash))
	for hash := range byHash {
		hashes = append(hashes, hash)
	}
	slices.Sort(hashes)

	checkCtx, cancel := context.WithTimeout(ctx, cacheCheckTimeout)
	defer cancel()

	cached, err := checker.Cached(checkCtx, hashes)
	if err != nil {
		s.logger.Debug().Err(err).Msg("could not ask the debrid service what it holds")
		return ""
	}

	for hash, indexes := range byHash {
		held := cached[hash]
		for _, i := range indexes {
			releases[i].Cached = &held
		}
	}

	return checker.Service()
}

// queries are what each source is asked, at most maxQueries; names are every
// name the title goes by, which a plugin is given beside its query.
func (s *Service) queries(ctx context.Context, req SearchRequest) (queries, names []string, err error) {
	if query := strings.TrimSpace(req.Query); query != "" {
		return []string{query}, []string{query}, nil
	}

	if s.opts.Titles == nil || strings.TrimSpace(req.MediaRef) == "" {
		return nil, nil, apperr.Invalid("q", "type what to search for")
	}

	names, err = s.opts.Titles.Names(ctx, req.MediaRef)
	if err != nil {
		return nil, nil, err
	}

	seen := map[string]bool{}

	for _, name := range names {
		name = strings.TrimSpace(name)
		key := strings.ToLower(name)
		if name == "" || seen[key] {
			continue
		}

		seen[key] = true

		// Indexers match words, and a show's releases carry "S02" in their names:
		// asking for it narrows a long show to the season wanted.
		if req.Season > 0 {
			name = fmt.Sprintf("%s S%02d", name, req.Season)
		}

		queries = append(queries, name)

		if len(queries) == maxQueries {
			break
		}
	}

	if len(queries) == 0 {
		return nil, nil, apperr.Invalid("q", "the node does not know this title's names yet; type what to search for")
	}

	return queries, names, nil
}

// ask is one source's answer to one query, from the cache while it is fresh.
func (s *Service) ask(ctx context.Context, source store.Source, key, query string) ([]torznab.Item, error) {
	cacheKey := strconv.FormatInt(source.ID, 10) + "\x00" + strings.ToLower(query)
	now := s.opts.Now()

	s.search.mu.Lock()
	cached, ok := s.search.answers[cacheKey]
	s.search.mu.Unlock()

	if ok && now.Sub(cached.at) < searchTTL {
		return cached.items, nil
	}

	items, err := s.opts.Torznab.Search(ctx, torznab.Source{URL: source.URL, APIKey: key}, query)
	if err != nil {
		return nil, err
	}

	// An empty answer is not kept: Jackett can answer a cold query with nothing
	// and the same query a moment later with results.
	if len(items) > 0 {
		s.search.mu.Lock()
		s.search.answers[cacheKey] = cachedAnswer{items: items, at: now}
		s.search.mu.Unlock()
	}

	return items, nil
}

func (s *Service) releaseOf(source store.Source, item torznab.Item) TorrentRelease {
	found := TorrentRelease{
		SourceID:   source.ID,
		SourceName: source.Name,
		Indexer:    item.Indexer,
		Title:      item.Title,
		PageURL:    item.PageURL,
		Size:       item.Size,
		Seeders:    item.Seeders,
		Peers:      item.Peers,
		Grabs:      item.Grabs,
		InfoHash:   item.InfoHash,
		Info:       release.Parse(item.Title),
		magnet:     item.MagnetURL,
		link:       item.Link,
	}

	if !item.PublishedAt.IsZero() {
		published := item.PublishedAt.UTC()
		found.PublishedAt = &published
	}

	// The same torrent found by two queries or two sources is one result.
	if found.InfoHash != "" {
		found.ID = "h" + found.InfoHash
	} else {
		sum := sha256.Sum256([]byte(strconv.FormatInt(source.ID, 10) + "\x00" + item.GUID + "\x00" + item.Link + "\x00" + item.MagnetURL))
		found.ID = "r" + hex.EncodeToString(sum[:12])
	}

	return found
}

// better prefers the copy more peers share, then the one that comes as a magnet.
func better(candidate, existing TorrentRelease) bool {
	if candidate.Seeders != existing.Seeders {
		return candidate.Seeders > existing.Seeders
	}

	return candidate.magnet != "" && existing.magnet == ""
}

// matchOf says how a release fits the season and episode asked for, or "" when
// it does not. A release of another season does not fit; one whose name gives no
// season might.
func matchOf(info release.Info, episode, season int) string {
	if season > 0 && info.Season != nil && *info.Season != season {
		return ""
	}

	episodes := info.Episodes

	switch {
	case episode == 0 && season > 0 && info.Season == nil:
		return "unknown"
	case episode == 0:
		return "any"
	case episodes == nil && season > 0 && info.Season != nil:
		return "batch"
	case episodes == nil:
		return "unknown"
	case !episodes.Contains(episode):
		return ""
	case episodes.From == episodes.To:
		return "episode"
	default:
		return "batch"
	}
}

var matchRank = map[string]int{"episode": 0, "batch": 1, "any": 1, "unknown": 2}

func sortReleases(releases []TorrentRelease) {
	sort.SliceStable(releases, func(i, j int) bool {
		a, b := &releases[i], &releases[j]

		if a.Best != b.Best {
			return a.Best
		}
		if matchRank[a.Match] != matchRank[b.Match] {
			return matchRank[a.Match] < matchRank[b.Match]
		}
		if a.Score != b.Score {
			return a.Score > b.Score
		}
		if a.Seeders != b.Seeders {
			return a.Seeders > b.Seeders
		}

		return a.Title < b.Title
	})
}

// keep remembers results so one can be downloaded by its id.
func (s *Service) keep(releases []TorrentRelease) {
	now := s.opts.Now()

	s.search.mu.Lock()
	defer s.search.mu.Unlock()

	for id := range s.search.releases {
		if now.Sub(s.search.releases[id].at) > releaseTTL {
			delete(s.search.releases, id)
		}
	}

	for i := range releases {
		s.search.releases[releases[i].ID] = cachedRelease{release: releases[i], at: now}
	}
}

// resolveRelease turns a search result into what the client is given: its magnet,
// or its .torrent file fetched from the source.
func (s *Service) resolveRelease(ctx context.Context, id string) (magnet string, torrent []byte, err error) {
	s.search.mu.Lock()
	cached, ok := s.search.releases[id]
	s.search.mu.Unlock()

	if !ok || s.opts.Now().Sub(cached.at) > releaseTTL {
		return "", nil, apperr.New(apperr.KindNotFound, "this search result has expired; search again")
	}

	if cached.release.magnet != "" {
		return cached.release.magnet, nil, nil
	}

	// A plugin's link is fetched under that plugin's rules — its own hosts,
	// public addresses — never with the Torznab client, which reaches the
	// user's own Jackett on the local network by design.
	if cached.release.Plugin != "" {
		if s.opts.Providers == nil {
			return "", nil, apperr.New(apperr.KindUnavailable, "search plugins do not run on this node")
		}

		data, linked, fetchErr := s.opts.Providers.FetchTorrent(ctx, cached.release.Plugin, cached.release.link)
		if fetchErr != nil {
			return "", nil, apperr.Wrap(fetchErr, apperr.KindUpstream, "could not fetch the torrent from %s: %s", cached.release.SourceName, messageOf(fetchErr))
		}

		return linked, data, nil
	}

	data, magnet, err := s.opts.Torznab.Fetch(ctx, cached.release.link)

	return magnet, data, err
}
