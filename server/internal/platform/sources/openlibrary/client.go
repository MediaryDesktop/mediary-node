// Package openlibrary reads books from Open Library, on demand and on behalf of the
// node's user. The data is openly licensed; the terms ask for one request a
// second, or three with a User-Agent that names a contact, and no bulk downloads.
package openlibrary

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

const (
	maxAttempts      = 3
	maxResponseBytes = 8 << 20
	fallbackBackoff  = 10 * time.Second

	anonymousInterval = time.Second
	contactInterval   = 350 * time.Millisecond
)

type Options struct {
	Endpoint string
	Timeout  time.Duration

	// UserAgent names the node; Contact, when set, is appended to it and earns
	// the faster rate Open Library grants an identified client.
	UserAgent string
	Contact   string

	MinInterval time.Duration
}

type Client struct {
	endpoint  string
	userAgent string
	http      *http.Client

	mu           sync.Mutex
	interval     time.Duration
	next         time.Time
	blockedUntil time.Time
}

func New(opts Options) *Client {
	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = 20 * time.Second
	}

	userAgent := opts.UserAgent
	if userAgent == "" {
		userAgent = "mediary-node"
	}

	interval := anonymousInterval
	if contact := strings.TrimSpace(opts.Contact); contact != "" {
		userAgent += " (" + contact + ")"
		interval = contactInterval
	}

	if opts.MinInterval > 0 {
		interval = opts.MinInterval
	}

	return &Client{
		endpoint:  strings.TrimRight(opts.Endpoint, "/"),
		userAgent: userAgent,
		http:      &http.Client{Timeout: timeout},
		interval:  interval,
	}
}

func (c *Client) get(ctx context.Context, path string, query url.Values, out any) error {
	for attempt := 1; ; attempt++ {
		if err := c.wait(ctx); err != nil {
			return apperr.Wrap(err, apperr.KindUnavailable, "open library request cancelled")
		}

		retry, err := c.send(ctx, path, query, out)
		if !retry {
			return err
		}

		if attempt >= maxAttempts {
			return apperr.New(apperr.KindUnavailable, "Open Library rate limit did not reset in time")
		}
	}
}

func (c *Client) send(ctx context.Context, path string, query url.Values, out any) (bool, error) {
	link := c.endpoint + path
	if len(query) > 0 {
		link += "?" + query.Encode()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, link, http.NoBody)
	if err != nil {
		return false, apperr.Wrap(err, apperr.KindInternal, "build open library request")
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", c.userAgent)

	resp, err := c.http.Do(req)
	if err != nil {
		return false, apperr.Wrap(err, apperr.KindUnavailable, "Open Library is unreachable")
	}
	defer func() { _ = resp.Body.Close() }()

	switch {
	case resp.StatusCode == http.StatusTooManyRequests:
		c.blockUntil(retryAt(resp.Header, time.Now()))
		return true, nil
	case resp.StatusCode == http.StatusNotFound:
		return false, apperr.New(apperr.KindNotFound, "Open Library has no such book")
	case resp.StatusCode != http.StatusOK:
		return false, apperr.New(apperr.KindUpstream, "Open Library returned %d", resp.StatusCode)
	}

	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		return false, apperr.Wrap(err, apperr.KindUnavailable, "read open library response")
	}

	if err := json.Unmarshal(raw, out); err != nil {
		return false, apperr.Wrap(err, apperr.KindUpstream, "decode open library response")
	}

	return false, nil
}

func (c *Client) wait(ctx context.Context) error {
	c.mu.Lock()
	now := time.Now()
	at := c.next
	if at.Before(now) {
		at = now
	}
	if c.blockedUntil.After(at) {
		at = c.blockedUntil
	}
	c.next = at.Add(c.interval)
	c.mu.Unlock()

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

func (c *Client) blockUntil(until time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if until.After(c.blockedUntil) {
		c.blockedUntil = until
	}
}

func retryAt(headers http.Header, now time.Time) time.Time {
	raw := headers.Get("Retry-After")

	if seconds, err := strconv.Atoi(raw); err == nil && seconds >= 0 {
		return now.Add(time.Duration(seconds) * time.Second)
	}

	if parsed, err := http.ParseTime(raw); err == nil {
		return parsed
	}

	return now.Add(fallbackBackoff)
}
