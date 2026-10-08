// Package tmdb reads movies and TV shows from The Movie Database's v3 API, on
// demand and on behalf of the node's user, as AniList is read for anime.
//
// TMDB's terms: cache no longer than six months, show TMDB's logo and notice next
// to its data, no commercial use without an agreement. The API asks for about
// fifty requests a second at most; the node stays far below that.
package tmdb

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

const (
	maxAttempts      = 3
	maxResponseBytes = 16 << 20
	fallbackBackoff  = 10 * time.Second
	defaultInterval  = 100 * time.Millisecond
)

// ErrNoKey is the answer while neither the build nor the user has given the node
// a key: TMDB answers nothing without one.
var ErrNoKey = errors.New("tmdb has no api key")

type Options struct {
	Endpoint    string
	Timeout     time.Duration
	UserAgent   string
	Keys        *Keys
	MinInterval time.Duration
}

type Client struct {
	endpoint  string
	userAgent string
	http      *http.Client
	keys      *Keys

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

	interval := opts.MinInterval
	if interval <= 0 {
		interval = defaultInterval
	}

	userAgent := opts.UserAgent
	if userAgent == "" {
		userAgent = "mediary-node"
	}

	return &Client{
		endpoint:  strings.TrimRight(opts.Endpoint, "/"),
		userAgent: userAgent,
		http:      &http.Client{Timeout: timeout},
		keys:      opts.Keys,
		interval:  interval,
	}
}

func (c *Client) Keys() *Keys {
	return c.keys
}

// Check asks TMDB whether key is one it accepts, before the node stores it.
func (c *Client) Check(ctx context.Context, key string) error {
	var out struct {
		Success bool `json:"success"`
	}

	if err := c.get(ctx, key, "/authentication", nil, &out); err != nil {
		return err
	}

	if !out.Success {
		return rejected()
	}

	return nil
}

func (c *Client) call(ctx context.Context, path string, query url.Values, out any) error {
	key, err := c.keys.Key()
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "read tmdb api key")
	}

	if key == "" {
		return apperr.Wrap(ErrNoKey, apperr.KindPrecondition, "TMDB is not set up: add an API key in the settings")
	}

	return c.get(ctx, key, path, query, out)
}

func (c *Client) get(ctx context.Context, key, path string, query url.Values, out any) error {
	for attempt := 1; ; attempt++ {
		if err := c.wait(ctx); err != nil {
			return apperr.Wrap(err, apperr.KindUnavailable, "tmdb request cancelled")
		}

		retry, err := c.send(ctx, key, path, query, out)
		if !retry {
			return err
		}

		if attempt >= maxAttempts {
			return apperr.New(apperr.KindUnavailable, "tmdb rate limit did not reset in time")
		}
	}
}

func (c *Client) send(ctx context.Context, key, path string, query url.Values, out any) (bool, error) {
	params := url.Values{}
	for name, values := range query {
		params[name] = values
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.endpoint+path, http.NoBody)
	if err != nil {
		return false, apperr.Wrap(err, apperr.KindInternal, "build tmdb request")
	}

	// TMDB gives an account two credentials: the v4 read access token (a JWT) goes
	// in the header, the older v3 key in the query. Users paste either.
	if isAccessToken(key) {
		req.Header.Set("Authorization", "Bearer "+key)
	} else {
		params.Set("api_key", key)
	}

	req.URL.RawQuery = params.Encode()
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", c.userAgent)

	resp, err := c.http.Do(req)
	if err != nil {
		return false, apperr.Wrap(err, apperr.KindUnavailable, "TMDB is unreachable")
	}
	defer func() { _ = resp.Body.Close() }()

	switch {
	case resp.StatusCode == http.StatusTooManyRequests:
		c.blockUntil(retryAt(resp.Header, time.Now()))
		return true, nil
	case resp.StatusCode == http.StatusUnauthorized:
		return false, rejected()
	case resp.StatusCode == http.StatusNotFound:
		return false, apperr.New(apperr.KindNotFound, "TMDB has no such title")
	case resp.StatusCode != http.StatusOK:
		return false, apperr.New(apperr.KindUpstream, "TMDB returned %d", resp.StatusCode)
	}

	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		return false, apperr.Wrap(err, apperr.KindUnavailable, "read tmdb response")
	}

	if err := json.Unmarshal(raw, out); err != nil {
		return false, apperr.Wrap(err, apperr.KindUpstream, "decode tmdb response")
	}

	return false, nil
}

// rejected is a precondition, not unauthorized: the desktop reads a 401 as the
// end of its own session with the node.
func rejected() error {
	return apperr.New(apperr.KindPrecondition, "TMDB rejected the API key")
}

func isAccessToken(key string) bool {
	return strings.HasPrefix(key, "eyJ") && strings.Count(key, ".") == 2
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
