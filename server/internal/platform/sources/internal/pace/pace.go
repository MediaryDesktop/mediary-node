// Package pace spaces a client's requests to a source: no closer together than
// the interval the source asks for, and none at all before a moment it named in
// a Retry-After.
package pace

import (
	"context"
	"net/http"
	"strconv"
	"sync"
	"time"
)

type Pacer struct {
	mu           sync.Mutex
	interval     time.Duration
	next         time.Time
	blockedUntil time.Time
}

func New(interval time.Duration) *Pacer {
	return &Pacer{interval: interval}
}

func (p *Pacer) Interval() time.Duration {
	return p.interval
}

// Wait books the next free slot and waits for it. The slot is taken at once, so
// callers that arrive together leave one interval apart; only ctx ends the wait
// early.
func (p *Pacer) Wait(ctx context.Context) error {
	p.mu.Lock()
	now := time.Now()
	at := p.next
	if at.Before(now) {
		at = now
	}
	if p.blockedUntil.After(at) {
		at = p.blockedUntil
	}
	p.next = at.Add(p.interval)
	p.mu.Unlock()

	delay := time.Until(at)
	if delay <= 0 {
		return nil
	}

	timer := time.NewTimer(delay)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

// BlockUntil holds every later request back until the given moment; of two
// blocks the longer one stands.
func (p *Pacer) BlockUntil(until time.Time) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if until.After(p.blockedUntil) {
		p.blockedUntil = until
	}
}

// RetryAt is when a response's Retry-After lets the next request go: in seconds
// or as an HTTP date; without a readable one, fallback from now.
func RetryAt(headers http.Header, now time.Time, fallback time.Duration) time.Time {
	raw := headers.Get("Retry-After")

	if seconds, err := strconv.Atoi(raw); err == nil && seconds >= 0 {
		return now.Add(time.Duration(seconds) * time.Second)
	}

	if parsed, err := http.ParseTime(raw); err == nil {
		return parsed
	}

	return now.Add(fallback)
}
