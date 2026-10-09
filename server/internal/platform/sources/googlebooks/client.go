// Package googlebooks reads books from the Google Books API, on demand and on
// behalf of the node's user. It is the fallback behind Open Library: it knows the
// editions Open Library does not, Ukrainian ones above all, but it lists every
// edition apart and spends a daily quota, so it is asked only when Open Library
// has nothing.
//
// Google's terms: keep no copies longer than needed to serve the user, show
// Google's attribution next to its data. An anonymous caller is refused, so the
// node needs a key.
package googlebooks

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/secrets"
)

const (
	maxResponseBytes = 8 << 20
	defaultInterval  = 200 * time.Millisecond

	// Google answers a share of ordinary requests with 503 and the same request
	// a moment later with the books, so a failure on its side is tried again.
	maxAttempts  = 3
	retryBackoff = 700 * time.Millisecond
)

// ErrNoKey is the answer while neither the build nor the user has given the node
// a key.
var ErrNoKey = errors.New("google books has no api key")

type Options struct {
	Endpoint    string
	Timeout     time.Duration
	UserAgent   string
	Keys        *secrets.APIKey
	MinInterval time.Duration
}

type Client struct {
	endpoint  string
	userAgent string
	http      *http.Client
	keys      *secrets.APIKey

	backoff time.Duration

	mu       sync.Mutex
	interval time.Duration
	next     time.Time
}

func NewKeys(store *secrets.Store, fallback string) *secrets.APIKey {
	return secrets.NewAPIKey(store, "googlebooks.api_key", fallback)
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
		backoff:   retryBackoff,
	}
}

func (c *Client) Keys() *secrets.APIKey {
	return c.keys
}

// Check asks Google whether key is one it accepts, before the node stores it.
func (c *Client) Check(ctx context.Context, key string) error {
	var out SearchPage

	return c.get(ctx, key, "/volumes", url.Values{"q": {"isbn:9780441172719"}, "maxResults": {"1"}}, &out)
}

func (c *Client) call(ctx context.Context, path string, query url.Values, out any) error {
	key, err := c.keys.Key()
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "read google books api key")
	}

	if key == "" {
		return apperr.Wrap(ErrNoKey, apperr.KindPrecondition, "Google Books is not set up: add an API key in the settings")
	}

	return c.get(ctx, key, path, query, out)
}

type apiError struct {
	Error struct {
		Message string `json:"message"`
		Errors  []struct {
			Reason string `json:"reason"`
		} `json:"errors"`
	} `json:"error"`
}

func (c *Client) get(ctx context.Context, key, path string, query url.Values, out any) error {
	for attempt := 1; ; attempt++ {
		retry, err := c.send(ctx, key, path, query, out)
		if !retry || attempt >= maxAttempts {
			return err
		}

		timer := time.NewTimer(time.Duration(attempt) * c.backoff)
		select {
		case <-ctx.Done():
			timer.Stop()
			return apperr.Wrap(ctx.Err(), apperr.KindUnavailable, "google books request cancelled")
		case <-timer.C:
		}
	}
}

// send makes one request, and reports whether a failure is worth another.
func (c *Client) send(ctx context.Context, key, path string, query url.Values, out any) (bool, error) {
	if err := c.wait(ctx); err != nil {
		return false, apperr.Wrap(err, apperr.KindUnavailable, "google books request cancelled")
	}

	params := url.Values{}
	for name, values := range query {
		params[name] = values
	}
	params.Set("key", key)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.endpoint+path+"?"+params.Encode(), http.NoBody)
	if err != nil {
		return false, apperr.Wrap(err, apperr.KindInternal, "build google books request")
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", c.userAgent)

	resp, err := c.http.Do(req)
	if err != nil {
		// The URL carries the key, so the transport's error, which quotes it, is
		// not passed on.
		return true, apperr.New(apperr.KindUnavailable, "Google Books is unreachable")
	}
	defer func() { _ = resp.Body.Close() }()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		return true, apperr.Wrap(err, apperr.KindUnavailable, "read google books response")
	}

	if resp.StatusCode != http.StatusOK {
		return resp.StatusCode >= http.StatusInternalServerError, statusError(resp.StatusCode, raw)
	}

	if err := json.Unmarshal(raw, out); err != nil {
		return false, apperr.Wrap(err, apperr.KindUpstream, "decode google books response")
	}

	return false, nil
}

// statusError tells a key Google refuses — which the user can fix in the
// settings — from a quota spent for the day, which only waiting fixes.
func statusError(status int, raw []byte) error {
	var body apiError
	_ = json.Unmarshal(raw, &body)

	reasons := make([]string, 0, len(body.Error.Errors))
	for _, item := range body.Error.Errors {
		reasons = append(reasons, item.Reason)
	}
	reason := strings.Join(reasons, ",")

	switch {
	case status == http.StatusNotFound:
		return apperr.New(apperr.KindNotFound, "Google Books has no such book")
	case strings.Contains(reason, "keyInvalid") || strings.Contains(body.Error.Message, "API key not valid"):
		return rejected()
	case status == http.StatusTooManyRequests || strings.Contains(reason, "Exceeded"):
		return apperr.New(apperr.KindUnavailable, "Google Books quota is spent for now")
	case status == http.StatusForbidden:
		// The key exists but may not call the Books API: it is not enabled in the
		// key's project, or the key is restricted to other APIs.
		return apperr.New(apperr.KindPrecondition, "Google Books refused the API key: %s", body.Error.Message)
	case status >= http.StatusInternalServerError:
		return apperr.New(apperr.KindUnavailable, "Google Books returned %d", status)
	default:
		return apperr.New(apperr.KindUpstream, "Google Books returned %d", status)
	}
}

// rejected is a precondition, not unauthorized: the desktop reads a 401 as the
// end of its own session with the node.
func rejected() error {
	return apperr.New(apperr.KindPrecondition, "Google Books rejected the API key")
}

func (c *Client) wait(ctx context.Context) error {
	c.mu.Lock()
	now := time.Now()
	at := c.next
	if at.Before(now) {
		at = now
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
