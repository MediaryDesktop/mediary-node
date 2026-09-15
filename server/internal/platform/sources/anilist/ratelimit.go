package anilist

import (
	"context"
	"net/http"
	"strconv"
	"sync"
	"time"
)

type pacer struct {
	mu           sync.Mutex
	minInterval  time.Duration
	nextAllowed  time.Time
	blockedUntil time.Time
	now          func() time.Time
}

func newPacer(minInterval time.Duration) *pacer {
	return &pacer{minInterval: minInterval, now: time.Now}
}

func (p *pacer) wait(ctx context.Context) error {
	for {
		p.mu.Lock()
		now := p.now()
		until := p.nextAllowed
		if p.blockedUntil.After(until) {
			until = p.blockedUntil
		}

		if !now.Before(until) {
			p.nextAllowed = now.Add(p.minInterval)
			p.mu.Unlock()
			return nil
		}
		p.mu.Unlock()

		timer := time.NewTimer(until.Sub(now))
		select {
		case <-ctx.Done():
			timer.Stop()
			return ctx.Err()
		case <-timer.C:
		}
	}
}

func (p *pacer) blockUntil(until time.Time) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if until.After(p.blockedUntil) {
		p.blockedUntil = until
	}
}

func resetTime(headers http.Header, now time.Time) (time.Time, bool) {
	if raw := headers.Get("Retry-After"); raw != "" {
		if seconds, err := strconv.Atoi(raw); err == nil && seconds >= 0 {
			return now.Add(time.Duration(seconds+1) * time.Second), true
		}

		if parsed, err := http.ParseTime(raw); err == nil {
			return parsed, true
		}
	}

	if raw := headers.Get("X-RateLimit-Reset"); raw != "" {
		if unix, err := strconv.ParseInt(raw, 10, 64); err == nil && unix > 0 {
			return time.Unix(unix, 0), true
		}
	}

	return time.Time{}, false
}
