// Package gutenberg fetches from Project Gutenberg the two things its terms let a
// program have: the offline catalogue, downloaded whole, and a book's file, one
// at a time when the user asks for it. The site itself is "intended for human
// users only" and its search is closed to robots, so nothing here searches it.
package gutenberg

import (
	"context"
	"errors"
	"fmt"
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
	catalogPath = "/cache/epub/feeds/pg_catalog.csv.gz"

	// The site asks harvesters for two seconds between requests; a user clicking
	// "download" on several books gets the same pause.
	defaultInterval = 2 * time.Second
	maxRedirects    = 5
)

// ErrNotModified is the catalogue answering that it has not changed since the
// copy the node has.
var ErrNotModified = errors.New("the catalogue has not changed")

type Options struct {
	// Endpoint is the site, https://www.gutenberg.org; a test points it at its
	// own server.
	Endpoint string
	Timeout  time.Duration

	// UserAgent names the node; Contact, when set, is appended to it, so the
	// site can reach whoever runs it instead of blocking it.
	UserAgent string
	Contact   string

	MinInterval time.Duration
}

type Client struct {
	endpoint  *url.URL
	userAgent string
	http      *http.Client
	interval  time.Duration

	mu   sync.Mutex
	next time.Time
}

func New(opts Options) (*Client, error) {
	endpoint, err := url.Parse(strings.TrimRight(opts.Endpoint, "/"))
	if err != nil || endpoint.Host == "" || (endpoint.Scheme != "https" && endpoint.Scheme != "http") {
		return nil, fmt.Errorf("project gutenberg endpoint %q is not an http(s) address", opts.Endpoint)
	}

	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = 10 * time.Minute
	}

	userAgent := opts.UserAgent
	if userAgent == "" {
		userAgent = "mediary-node"
	}
	if contact := strings.TrimSpace(opts.Contact); contact != "" {
		userAgent += " (+" + contact + ")"
	}

	interval := opts.MinInterval
	if interval <= 0 {
		interval = defaultInterval
	}

	c := &Client{endpoint: endpoint, userAgent: userAgent, interval: interval}
	c.http = &http.Client{Timeout: timeout, CheckRedirect: c.checkRedirect}

	return c, nil
}

// checkRedirect follows the site to its own hosts only: a file is never fetched
// from wherever a redirect points.
func (c *Client) checkRedirect(req *http.Request, via []*http.Request) error {
	if len(via) >= maxRedirects {
		return errors.New("too many redirects")
	}

	host := req.URL.Hostname()
	if req.URL.Host == c.endpoint.Host || host == "gutenberg.org" || strings.HasSuffix(host, ".gutenberg.org") {
		if req.URL.Scheme == "https" || req.URL.Scheme == c.endpoint.Scheme {
			return nil
		}
	}

	return fmt.Errorf("project gutenberg redirected to %s, which is not its own site", req.URL.Redacted())
}

// Catalog is the catalogue's compressed CSV.
type Catalog struct {
	Body io.ReadCloser
	// LastModified is to be sent back on the next check.
	LastModified string
}

// Catalog downloads the catalogue, or returns ErrNotModified when it has not
// changed since lastModified.
func (c *Client) Catalog(ctx context.Context, lastModified string) (*Catalog, error) {
	resp, err := c.get(ctx, catalogPath, lastModified)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode == http.StatusNotModified {
		_ = resp.Body.Close()
		return nil, ErrNotModified
	}

	return &Catalog{Body: resp.Body, LastModified: resp.Header.Get("Last-Modified")}, nil
}

// Book opens the EPUB of book id, with its images. The caller closes it.
func (c *Client) Book(ctx context.Context, id int) (io.ReadCloser, error) {
	if id <= 0 {
		return nil, apperr.Invalid("ref", "%d is not a Project Gutenberg book number", id)
	}

	number := strconv.Itoa(id)

	resp, err := c.get(ctx, "/cache/epub/"+number+"/pg"+number+"-images-3.epub", "")
	if err != nil {
		return nil, err
	}

	return resp.Body, nil
}

func (c *Client) get(ctx context.Context, path, lastModified string) (*http.Response, error) {
	if err := c.wait(ctx); err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.endpoint.String()+path, http.NoBody)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "build project gutenberg request")
	}

	req.Header.Set("User-Agent", c.userAgent)
	if lastModified != "" {
		req.Header.Set("If-Modified-Since", lastModified)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindUnavailable, "Project Gutenberg is unreachable")
	}

	switch resp.StatusCode {
	case http.StatusOK, http.StatusNotModified:
		return resp, nil
	}

	_ = resp.Body.Close()

	switch resp.StatusCode {
	// A busy or blocking site is told about, not retried: asking again is what
	// gets an address blocked.
	case http.StatusTooManyRequests, http.StatusServiceUnavailable, http.StatusForbidden:
		return nil, apperr.New(apperr.KindUnavailable, "Project Gutenberg asked to wait (%d); try again later", resp.StatusCode)
	case http.StatusNotFound:
		return nil, apperr.New(apperr.KindNotFound, "Project Gutenberg has no such file")
	default:
		return nil, apperr.New(apperr.KindUpstream, "Project Gutenberg returned %d", resp.StatusCode)
	}
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
		return apperr.Wrap(ctx.Err(), apperr.KindUnavailable, "project gutenberg request cancelled")
	case <-timer.C:
		return nil
	}
}
