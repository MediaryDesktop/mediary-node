package service

import (
	"context"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// A book's page takes Open Library two requests at one a second, and a card
// grid asks for several books at once: the last in line can wait longer than
// the client does. The fetch is finished regardless and cached, so the page
// that gave up opens at once the next time.
const detachedFetchTimeout = 45 * time.Second

type flight struct {
	done    chan struct{}
	details *MediaDetails
	err     error
}

// shared runs fetch once per key however many ask at the same time, and lets it
// outlive the callers: one that stops waiting only stops waiting.
func (s *Service) shared(
	ctx context.Context, key string, fetch func(context.Context) (*MediaDetails, error),
) (*MediaDetails, error) {
	s.mu.Lock()
	current, running := s.flights[key]
	if !running {
		current = &flight{done: make(chan struct{})}
		s.flights[key] = current

		fetchCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), detachedFetchTimeout)

		go func() {
			defer cancel()

			current.details, current.err = fetch(fetchCtx)

			s.mu.Lock()
			delete(s.flights, key)
			s.mu.Unlock()

			close(current.done)
		}()
	}
	s.mu.Unlock()

	select {
	case <-current.done:
		return current.details, current.err
	case <-ctx.Done():
		return nil, apperr.Wrap(ctx.Err(), apperr.KindUnavailable, "the request ended before the source answered")
	}
}
