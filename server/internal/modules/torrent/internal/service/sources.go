package service

import (
	"context"
	"strconv"
	"strings"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/torznab"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

// TorrentSource is one of the user's Torznab endpoints. The API key is never
// returned; HasAPIKey says whether one is saved.
type TorrentSource struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	URL       string `json:"url"`
	HasAPIKey bool   `json:"has_api_key"`
}

type SourceInput struct {
	Name string
	URL  string
	// Nil keeps the saved key; "" removes it.
	APIKey *string
}

const maxSourceName = 100

func sourceKey(id int64) string {
	return "torznab:" + strconv.FormatInt(id, 10)
}

func (s *Service) Sources(ctx context.Context) ([]TorrentSource, error) {
	rows, err := s.store.Sources(ctx)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "list search sources")
	}

	sources := make([]TorrentSource, 0, len(rows))
	for _, row := range rows {
		key, err := s.secrets.Get(sourceKey(row.ID))
		if err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "read a search source's key")
		}

		sources = append(sources, TorrentSource{ID: row.ID, Name: row.Name, URL: row.URL, HasAPIKey: key != ""})
	}

	return sources, nil
}

func (s *Service) CreateSource(ctx context.Context, in SourceInput) (*TorrentSource, error) {
	name, address, err := checkSource(in)
	if err != nil {
		return nil, err
	}

	row, err := s.store.InsertSource(ctx, name, address, s.opts.Now())
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "save the search source")
	}

	if in.APIKey != nil {
		if err := s.secrets.Set(sourceKey(row.ID), *in.APIKey); err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "save the search source's key")
		}
	}

	s.forgetSearches()

	return &TorrentSource{ID: row.ID, Name: row.Name, URL: row.URL, HasAPIKey: in.APIKey != nil && *in.APIKey != ""}, nil
}

func (s *Service) UpdateSource(ctx context.Context, id int64, in SourceInput) (*TorrentSource, error) {
	name, address, err := checkSource(in)
	if err != nil {
		return nil, err
	}

	row, err := s.store.UpdateSource(ctx, id, name, address, s.opts.Now())
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "save the search source")
	}
	if row == nil {
		return nil, apperr.New(apperr.KindNotFound, "search source %d does not exist", id)
	}

	if in.APIKey != nil {
		if err = s.secrets.Set(sourceKey(id), *in.APIKey); err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "save the search source's key")
		}
	}

	key, err := s.secrets.Get(sourceKey(id))
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read the search source's key")
	}

	s.forgetSearches()

	return &TorrentSource{ID: row.ID, Name: row.Name, URL: row.URL, HasAPIKey: key != ""}, nil
}

func (s *Service) DeleteSource(ctx context.Context, id int64) error {
	deleted, err := s.store.DeleteSource(ctx, id)
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "delete the search source")
	}
	if !deleted {
		return apperr.New(apperr.KindNotFound, "search source %d does not exist", id)
	}

	if err := s.secrets.Set(sourceKey(id), ""); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "forget the search source's key")
	}

	s.forgetSearches()

	return nil
}

// CheckSource asks an endpoint what it is, before or after it is saved. Without a
// key it uses the saved source's key.
func (s *Service) CheckSource(ctx context.Context, sourceID int64, rawURL string, apiKey *string) (*torznab.TorrentSourceCaps, error) {
	address, err := torznab.ParseURL(rawURL)
	if err != nil {
		return nil, err
	}

	key := ""
	switch {
	case apiKey != nil:
		key = *apiKey
	case sourceID != 0:
		if key, err = s.secrets.Get(sourceKey(sourceID)); err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "read the search source's key")
		}
	}

	return s.opts.Torznab.Caps(ctx, torznab.Source{URL: address, APIKey: key})
}

func checkSource(in SourceInput) (name, address string, err error) {
	name = strings.TrimSpace(in.Name)
	if name == "" {
		return "", "", apperr.Invalid("name", "a search source needs a name")
	}
	if len([]rune(name)) > maxSourceName {
		return "", "", apperr.Invalid("name", "the name is at most %d characters", maxSourceName)
	}

	address, err = torznab.ParseURL(in.URL)
	if err != nil {
		return "", "", err
	}

	return name, address, nil
}
