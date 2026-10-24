package service

import (
	"context"
	"errors"
	"sync"
	"time"

	"golang.org/x/mod/semver"

	"github.com/mediaryorg/mediary-node/server/internal/modules/extension/internal/repository"
	"github.com/mediaryorg/mediary-node/server/internal/modules/extension/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

const (
	maxRepositories = 20
	// How long a repository read is reused. The catalog is opened often and
	// changes rarely; a refresh reads every repository again.
	catalogTTL = time.Hour
)

// RepositoryInfo is a repository the user added, with what its last read
// found.
type ExtensionRepository struct {
	ID        int64      `json:"id"`
	URL       string     `json:"url"`
	Name      string     `json:"name"`
	AddedAt   time.Time  `json:"added_at"`
	Plugins   int        `json:"plugins" doc:"How many plugins it lists that this node can run."`
	Skipped   int        `json:"skipped" doc:"Entries left out: another type of plugin, or not well formed."`
	CheckedAt *time.Time `json:"checked_at,omitempty"`
	Error     string     `json:"error,omitempty" doc:"Why the last read failed; the plugins shown are from the read before."`
}

// CatalogEntry is a plugin a repository lists. What it says is the
// repository's word, shown and nothing more: installing reads the plugin's own
// manifest and asks for consent to that.
type CatalogPlugin struct {
	ManifestURL    string `json:"manifest_url" doc:"Preview and install from here."`
	ID             string `json:"id"`
	Name           string `json:"name"`
	Version        string `json:"version"`
	Type           string `json:"type" enum:"torrent-provider,manga-provider"`
	Author         string `json:"author"`
	Description    string `json:"description,omitempty"`
	Lang           string `json:"lang,omitempty"`
	Icon           string `json:"icon,omitempty"`
	RepositoryID   int64  `json:"repository_id"`
	RepositoryName string `json:"repository_name"`
	Installed      string `json:"installed,omitempty" doc:"The version installed under this plugin's id, if any."`
	InstalledHere  bool   `json:"installed_here" doc:"Installed from this very manifest address."`
	Update         bool   `json:"update" doc:"Installed from here, and the repository lists a newer version."`
}

type ExtensionCatalog struct {
	Plugins      []CatalogPlugin       `json:"plugins"`
	Repositories []ExtensionRepository `json:"repositories"`
}

// read is what a repository answered last, kept between catalog views.
type read struct {
	at      time.Time
	repo    *repository.Repository
	skipped int
	err     string
}

type catalogCache struct {
	// refresh is held while repositories are read, so two views opened at
	// once read each repository once.
	refresh sync.Mutex

	mu    sync.Mutex
	reads map[int64]read
}

func (s *Service) AddRepository(ctx context.Context, rawURL string) (*ExtensionRepository, error) {
	if !repository.HTTPSURL(rawURL) {
		return nil, apperr.Invalid("url", "a repository is at an https:// address")
	}

	repos, err := s.store.Repositories(ctx)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "list repositories")
	}
	if len(repos) >= maxRepositories {
		return nil, apperr.New(apperr.KindPrecondition, "at most %d repositories; remove one first", maxRepositories)
	}

	// Read before saving: an address that is not a repository is the user's
	// typo, and saying so now beats an entry that never works.
	r := s.readRepository(ctx, rawURL)
	if r.repo == nil {
		return nil, apperr.New(apperr.KindInvalid, "%s is not a plugin repository: %s", rawURL, r.err)
	}

	saved, err := s.store.InsertRepository(ctx, rawURL, r.repo.Name, s.opts.Now())
	if errors.Is(err, store.ErrRepositoryExists) {
		return nil, apperr.New(apperr.KindConflict, "the repository is already added")
	}
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "save repository")
	}

	s.catalog.mu.Lock()
	s.catalog.reads[saved.ID] = r
	s.catalog.mu.Unlock()

	s.logger.Info().Str("repository", rawURL).Int("plugins", len(r.repo.Plugins)).Msg("plugin repository added")
	s.publish("")

	info := infoOf(*saved, r)

	return &info, nil
}

func (s *Service) RemoveRepository(ctx context.Context, id int64) error {
	removed, err := s.store.DeleteRepository(ctx, id)
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "remove repository")
	}
	if !removed {
		return apperr.New(apperr.KindNotFound, "no repository %d", id)
	}

	s.catalog.mu.Lock()
	delete(s.catalog.reads, id)
	s.catalog.mu.Unlock()

	s.publish("")

	return nil
}

// Catalog lists every plugin the user's repositories offer, read again when
// older than an hour or when refresh asks for it. A plugin listed in two
// repositories at the same address is shown once.
func (s *Service) Catalog(ctx context.Context, refresh bool) (*ExtensionCatalog, error) {
	repos, err := s.store.Repositories(ctx)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "list repositories")
	}

	reads := s.readAll(ctx, repos, refresh)

	installed, err := s.store.List(ctx)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "list plugins")
	}
	byID := make(map[string]*store.Extension, len(installed))
	for i := range installed {
		byID[installed[i].ID] = &installed[i]
	}

	out := &ExtensionCatalog{Plugins: []CatalogPlugin{}, Repositories: make([]ExtensionRepository, 0, len(repos))}
	seen := map[string]bool{}

	for _, repo := range repos {
		r := reads[repo.ID]
		out.Repositories = append(out.Repositories, infoOf(repo, r))

		if r.repo == nil {
			continue
		}

		name := repo.Name
		if r.repo.Name != "" {
			name = r.repo.Name
		}

		for i := range r.repo.Plugins {
			entry := &r.repo.Plugins[i]
			if seen[entry.Manifest] {
				continue
			}
			seen[entry.Manifest] = true

			item := CatalogPlugin{
				ManifestURL:    entry.Manifest,
				ID:             entry.ID,
				Name:           entry.Name,
				Version:        entry.Version,
				Type:           entry.Type,
				Author:         entry.Author,
				Description:    entry.Description,
				Lang:           entry.Lang,
				Icon:           entry.Icon,
				RepositoryID:   repo.ID,
				RepositoryName: name,
			}
			if ext, ok := byID[entry.ID]; ok {
				item.Installed = ext.Manifest.Version
				item.InstalledHere = ext.ManifestURL == entry.Manifest
				item.Update = item.InstalledHere && semver.Compare("v"+entry.Version, "v"+ext.Manifest.Version) > 0
			}
			out.Plugins = append(out.Plugins, item)
		}
	}

	return out, nil
}

// readAll reads the repositories that are stale, four at a time. A read that
// fails keeps the plugins of the last one that did not, with the error beside
// them: a repository down for an hour does not empty the catalog.
func (s *Service) readAll(ctx context.Context, repos []store.Repository, refresh bool) map[int64]read {
	s.catalog.refresh.Lock()
	defer s.catalog.refresh.Unlock()

	now := s.opts.Now()

	s.catalog.mu.Lock()
	current := make(map[int64]read, len(repos))
	var stale []store.Repository
	for _, repo := range repos {
		r, ok := s.catalog.reads[repo.ID]
		current[repo.ID] = r
		if refresh || !ok || now.Sub(r.at) > catalogTTL {
			stale = append(stale, repo)
		}
	}
	s.catalog.mu.Unlock()

	var mu sync.Mutex
	var wg sync.WaitGroup
	slots := make(chan struct{}, 4)

	for _, repo := range stale {
		wg.Add(1)
		go func() {
			defer wg.Done()
			slots <- struct{}{}
			defer func() { <-slots }()

			fresh := s.readRepository(ctx, repo.URL)

			mu.Lock()
			defer mu.Unlock()

			if fresh.repo == nil {
				fresh.repo, fresh.skipped = current[repo.ID].repo, current[repo.ID].skipped
			} else if fresh.repo.Name != "" && fresh.repo.Name != repo.Name {
				if err := s.store.RenameRepository(ctx, repo.ID, fresh.repo.Name); err != nil {
					s.logger.Warn().Err(err).Int64("repository", repo.ID).Msg("could not keep the repository's new name")
				}
			}
			current[repo.ID] = fresh
		}()
	}
	wg.Wait()

	s.catalog.mu.Lock()
	for id, r := range current {
		s.catalog.reads[id] = r
	}
	s.catalog.mu.Unlock()

	return current
}

func (s *Service) readRepository(ctx context.Context, rawURL string) read {
	r := read{at: s.opts.Now()}

	raw, err := s.download(ctx, rawURL, repository.MaxSize)
	if err != nil {
		r.err = messageOf(err)
		return r
	}

	repo, skipped, err := repository.Parse(raw)
	if err != nil {
		r.err = err.Error()
		return r
	}

	r.repo, r.skipped = repo, skipped

	return r
}

func infoOf(repo store.Repository, r read) ExtensionRepository {
	info := ExtensionRepository{
		ID:      repo.ID,
		URL:     repo.URL,
		Name:    repo.Name,
		AddedAt: repo.AddedAt,
		Skipped: r.skipped,
		Error:   r.err,
	}

	if r.repo != nil {
		info.Plugins = len(r.repo.Plugins)
		if r.repo.Name != "" {
			info.Name = r.repo.Name
		}
	}
	if !r.at.IsZero() {
		at := r.at
		info.CheckedAt = &at
	}

	return info
}
