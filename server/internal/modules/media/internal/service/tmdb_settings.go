package service

import (
	"context"
	"strings"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/sources/tmdb"
)

type TMDBSettings struct {
	Enabled   bool   `json:"enabled" doc:"Whether this node reads TMDB at all. Off when the node was started with an empty TMDB endpoint."`
	KeySource string `json:"key_source" enum:"user,build,none" doc:"Which key the node sends: the user's own, the one this build ships with, or none — then movies and shows cannot be looked up."`
}

func (s *Service) TMDBSettings() (*TMDBSettings, error) {
	if s.opts.TMDB == nil {
		return &TMDBSettings{KeySource: string(tmdb.KeySourceNone)}, nil
	}

	source, err := s.opts.TMDB.Keys().Source()
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read tmdb api key")
	}

	return &TMDBSettings{Enabled: true, KeySource: string(source)}, nil
}

// SetTMDBKey stores the user's own key after TMDB has accepted it. An empty key
// forgets it and goes back to the build's.
func (s *Service) SetTMDBKey(ctx context.Context, key string) (*TMDBSettings, error) {
	client, err := s.tmdbClient()
	if err != nil {
		return nil, err
	}

	key = strings.TrimSpace(key)

	if key != "" {
		if checkErr := client.Check(ctx, key); checkErr != nil {
			return nil, checkErr
		}
	}

	if err := client.Keys().SetUserKey(key); err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "store tmdb api key")
	}

	return s.TMDBSettings()
}
