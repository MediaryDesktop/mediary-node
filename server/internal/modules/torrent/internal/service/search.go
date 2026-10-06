package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

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
	// How long a search waits for the slowest source.
	searchTimeout = 25 * time.Second
)

// Titles is where the names of a title come from, wired by internal/app.
type Titles interface {
	// Names are the title's names worth searching for, best first; none when the
	// node does not know the title.
	Names(ctx context.Context, mediaRef string) ([]string, error)
}

type SearchRequest struct {
	MediaRef string
	// Episode narrows the results to releases that hold it; 0 for any.
	Episode int
	// Query replaces the title's names.
	Query string
}

// TorrentRelease is one search result.
type TorrentRelease struct {
	ID          string     `json:"id" doc:"Pass as release_id to download it."`
	SourceID    int64      `json:"source_id"`
	SourceName  string     `json:"source_name"`
	Indexer     string     `json:"indexer,omitempty" doc:"The site behind the source, when the source says."`
	Title       string     `json:"title"`
	PageURL     string     `json:"page_url,omitempty"`
	Size        int64      `json:"size"`
	Seeders     int        `json:"seeders"`
	Peers       int        `json:"peers"`
	Grabs       int        `json:"grabs"`
	PublishedAt *time.Time `json:"published_at,omitempty"`
	InfoHash    string     `json:"info_hash,omitempty"`

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
	ID      int64  `json:"id"`
	Name    string `json:"name"`
	Results int    `json:"results"`
	Error   string `json:"error,omitempty"`
}

type TorrentSearchResult struct {
	Queries  []string               `json:"queries"`
	Releases []TorrentRelease       `json:"releases"`
	Sources  []TorrentSourceOutcome `json:"sources"`
}

type searchCache struct {
	mu       sync.Mutex
	answers  map[string]cachedAnswer
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
}

func (s *Service) Search(ctx context.Context, req SearchRequest) (*TorrentSearchResult, error) {
	if req.Episode < 0 {
		return nil, apperr.Invalid("episode", "an episode number cannot be negative")
	}

	queries, err := s.queries(ctx, req)
	if err != nil {
		return nil, err
	}

	sources, err := s.store.Sources(ctx)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "list search sources")
	}
	if len(sources) == 0 {
		return nil, apperr.New(apperr.KindPrecondition, "add a Torznab source — Jackett or Prowlarr — in the settings first")
	}

	ctx, cancel := context.WithTimeout(ctx, searchTimeout)
	defer cancel()

	type answer struct {
		source store.Source
		items  []torznab.Item
		err    error
	}

	answers := make(chan answer)
	var wg sync.WaitGroup

	for _, source := range sources {
		key, keyErr := s.secrets.Get(sourceKey(source.ID))
		if keyErr != nil {
			return nil, apperr.Wrap(keyErr, apperr.KindInternal, "read a search source's key")
		}

		for _, query := range queries {
			wg.Add(1)
			go func(source store.Source, query string) {
				defer wg.Done()
				items, askErr := s.ask(ctx, source, key, query)
				answers <- answer{source: source, items: items, err: askErr}
			}(source, query)
		}
	}

	go func() {
		wg.Wait()
		close(answers)
	}()

	outcomes := make(map[int64]*TorrentSourceOutcome, len(sources))
	for _, source := range sources {
		outcomes[source.ID] = &TorrentSourceOutcome{ID: source.ID, Name: source.Name}
	}

	byID := map[string]TorrentRelease{}

	for got := range answers {
		outcome := outcomes[got.source.ID]

		if got.err != nil {
			if outcome.Error == "" {
				outcome.Error = messageOf(got.err)
			}
			continue
		}

		for i := range got.items {
			found := s.releaseOf(got.source, got.items[i])
			outcome.Results++

			if existing, ok := byID[found.ID]; !ok || better(found, existing) {
				byID[found.ID] = found
			}
		}
	}

	releases := make([]TorrentRelease, 0, len(byID))
	for id := range byID {
		found := byID[id]
		found.Match = matchOf(found.Episodes, req.Episode)
		if found.Match == "" {
			continue
		}
		releases = append(releases, found)
	}

	profile, err := s.Profile(ctx)
	if err != nil {
		return nil, err
	}

	rank(releases, profile)
	sortReleases(releases)
	s.keep(releases)

	result := &TorrentSearchResult{Queries: queries, Releases: releases}
	for _, source := range sources {
		result.Sources = append(result.Sources, *outcomes[source.ID])
	}

	return result, nil
}

func (s *Service) queries(ctx context.Context, req SearchRequest) ([]string, error) {
	if query := strings.TrimSpace(req.Query); query != "" {
		return []string{query}, nil
	}

	if s.opts.Titles == nil || strings.TrimSpace(req.MediaRef) == "" {
		return nil, apperr.Invalid("q", "type what to search for")
	}

	names, err := s.opts.Titles.Names(ctx, req.MediaRef)
	if err != nil {
		return nil, err
	}

	seen := map[string]bool{}
	var queries []string

	for _, name := range names {
		name = strings.TrimSpace(name)
		key := strings.ToLower(name)
		if name == "" || seen[key] {
			continue
		}

		seen[key] = true
		queries = append(queries, name)

		if len(queries) == maxQueries {
			break
		}
	}

	if len(queries) == 0 {
		return nil, apperr.Invalid("q", "the node does not know this title's names yet; type what to search for")
	}

	return queries, nil
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

	s.search.mu.Lock()
	s.search.answers[cacheKey] = cachedAnswer{items: items, at: now}
	s.search.mu.Unlock()

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

// matchOf says how a release fits the episode asked for, or "" when it does not.
func matchOf(episodes *release.Episodes, episode int) string {
	switch {
	case episode == 0:
		return "any"
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

	data, magnet, err := s.opts.Torznab.Fetch(ctx, cached.release.link)

	return magnet, data, err
}
