package opds

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

var (
	ErrUnauthorized = errors.New("the server refused the user name or password")
	ErrNotOPDS      = errors.New("the address does not serve an OPDS catalogue")
	ErrUnreachable  = errors.New("the server could not be reached")
	ErrNoSearch     = errors.New("the catalogue offers no search")
	ErrOtherHost    = errors.New("the catalogue points to another server")
)

const (
	// A feed is text; anything this large is not one.
	maxFeedBytes = 8 << 20
	// The same ceiling as a page inside a local archive.
	maxPageBytes = 64 << 20

	// Series feeds are paged. A series with more pages than this is not one the
	// reader can list sensibly anyway.
	maxSeriesPages = 50
)

// Server is one catalogue and the credentials for it.
type Server struct {
	URL      string
	Username string
	Password string
}

type Client struct {
	http      *http.Client
	userAgent string
}

func New(timeout time.Duration, userAgent string) *Client {
	return &Client{
		http: &http.Client{
			Timeout: timeout,
			// A redirect to another host would carry the password with it.
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) >= 5 {
					return errors.New("too many redirects")
				}
				if !sameOrigin(req.URL, via[0].URL) {
					return ErrOtherHost
				}

				return nil
			},
		},
		userAgent: userAgent,
	}
}

// Series is one series a catalogue holds, as found by a search.
type Series struct {
	// ID is the series feed's path on the server, with its query. It is what the
	// node stores; the host stays in the server's own address.
	ID    string
	Title string
}

// Book is one chapter of a series.
type Book struct {
	ID     string
	Title  string
	Number string
	// PageTemplate is the page-streaming path with {pageNumber} in it, and Pages
	// the number of pages. Both are empty for a book that cannot be streamed.
	PageTemplate string
	Pages        int
	Updated      time.Time
}

// Check reads the catalogue's root, which is enough to tell a wrong address from
// a wrong password.
func (c *Client) Check(ctx context.Context, server Server) error {
	_, err := c.feed(ctx, server, "")

	return err
}

// Search finds series by name, through the search the catalogue describes.
func (c *Client) Search(ctx context.Context, server Server, query string) ([]Series, error) {
	root, err := c.feed(ctx, server, "")
	if err != nil {
		return nil, err
	}

	link, ok := root.Link(RelSearch)
	if !ok {
		return nil, ErrNoSearch
	}

	template := link.Href
	if !strings.Contains(template, "{searchTerms}") {
		body, getErr := c.get(ctx, server, link.Href, maxFeedBytes)
		if getErr != nil {
			return nil, getErr
		}

		if template, err = parseOpenSearch(bytes.NewReader(body)); err != nil {
			return nil, err
		}
	}

	results, err := c.feed(ctx, server, strings.ReplaceAll(template, "{searchTerms}", url.QueryEscape(query)))
	if err != nil {
		return nil, err
	}

	base, err := url.Parse(server.URL)
	if err != nil {
		return nil, err
	}

	var series []Series
	for _, entry := range results.Entries {
		link, ok := entry.Link(RelSubsection)
		if !ok || !link.IsCatalogue() {
			continue
		}

		id, err := serverPath(base, link.Href)
		if err != nil {
			continue
		}

		series = append(series, Series{ID: id, Title: strings.TrimSpace(entry.Title)})
	}

	return series, nil
}

// Books lists a series' chapters, following the feed's pages.
func (c *Client) Books(ctx context.Context, server Server, seriesID string) ([]Book, error) {
	base, err := url.Parse(server.URL)
	if err != nil {
		return nil, err
	}

	var books []Book
	next := seriesID

	for range maxSeriesPages {
		feed, err := c.feed(ctx, server, next)
		if err != nil {
			return nil, err
		}

		for _, entry := range feed.Entries {
			books = append(books, book(base, entry))
		}

		link, ok := feed.Link(RelNext)
		if !ok {
			return books, nil
		}
		if next, err = serverPath(base, link.Href); err != nil {
			return nil, err
		}
	}

	return books, nil
}

func book(base *url.URL, entry Entry) Book {
	title := strings.TrimSpace(entry.Title)
	out := Book{ID: entry.ID, Title: title, Number: ChapterNumber(title)}

	if updated, err := time.Parse(time.RFC3339, entry.Updated); err == nil {
		out.Updated = updated
	}

	if stream, ok := entry.Link(RelPSEStream); ok && stream.Count > 0 && strings.Contains(stream.Href, "{pageNumber}") {
		// The template is resolved by hand: url.Parse would escape its braces.
		if path, err := serverPath(base, stream.Href); err == nil {
			out.PageTemplate = path
			out.Pages = stream.Count
		}
	}

	return out
}

// Page fetches one page of a streamed book. Page numbers start at 0, as the
// extension specifies.
func (c *Client) Page(ctx context.Context, server Server, template string, index int) (data []byte, contentType string, err error) {
	path := strings.ReplaceAll(template, "{pageNumber}", strconv.Itoa(index))

	req, err := c.request(ctx, server, path)
	if err != nil {
		return nil, "", err
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, "", unreachable(err)
	}
	defer func() { _ = resp.Body.Close() }()

	if statusErr := status(resp); statusErr != nil {
		return nil, "", statusErr
	}

	data, err = readLimited(resp.Body, maxPageBytes)
	if err != nil {
		return nil, "", err
	}

	contentType = resp.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		contentType = http.DetectContentType(data)
	}

	return data, contentType, nil
}

func (c *Client) feed(ctx context.Context, server Server, path string) (*Feed, error) {
	body, err := c.get(ctx, server, path, maxFeedBytes)
	if err != nil {
		return nil, err
	}

	return ParseFeed(bytes.NewReader(body))
}

func (c *Client) get(ctx context.Context, server Server, path string, limit int64) ([]byte, error) {
	req, err := c.request(ctx, server, path)
	if err != nil {
		return nil, err
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, unreachable(err)
	}
	defer func() { _ = resp.Body.Close() }()

	if err := status(resp); err != nil {
		return nil, err
	}

	return readLimited(resp.Body, limit)
}

// request builds a GET for a path on the server; an empty path is the catalogue
// root. A path that resolves to another host is refused, because the request
// carries the password.
func (c *Client) request(ctx context.Context, server Server, path string) (*http.Request, error) {
	base, err := url.Parse(server.URL)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrNotOPDS, err)
	}

	target := base
	if path != "" {
		if target, err = base.Parse(path); err != nil {
			return nil, fmt.Errorf("%w: %w", ErrNotOPDS, err)
		}
	}
	if !sameOrigin(target, base) {
		return nil, ErrOtherHost
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), http.NoBody)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", c.userAgent)
	req.Header.Set("Accept", "application/atom+xml, application/xml;q=0.9, image/*;q=0.8, */*;q=0.1")
	if server.Username != "" || server.Password != "" {
		req.SetBasicAuth(server.Username, server.Password)
	}

	return req, nil
}

// serverPath turns a link into the path and query on the server it came from.
func serverPath(base *url.URL, href string) (string, error) {
	target, err := base.Parse(href)
	if err != nil {
		return "", err
	}
	if !sameOrigin(target, base) {
		return "", ErrOtherHost
	}

	path := target.EscapedPath()
	// url.Parse escapes the braces of a template; the template needs them back.
	path = strings.ReplaceAll(strings.ReplaceAll(path, "%7B", "{"), "%7D", "}")
	if target.RawQuery != "" {
		path += "?" + target.RawQuery
	}

	return path, nil
}

func sameOrigin(a, b *url.URL) bool {
	return strings.EqualFold(a.Scheme, b.Scheme) && strings.EqualFold(a.Host, b.Host)
}

func status(resp *http.Response) error {
	switch {
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		return ErrUnauthorized
	case resp.StatusCode == http.StatusNotFound:
		return fmt.Errorf("%w: %s answered 404", ErrNotOPDS, resp.Request.URL.Path)
	case resp.StatusCode >= 400:
		return fmt.Errorf("%w: %s answered %d", ErrUnreachable, resp.Request.URL.Path, resp.StatusCode)
	}

	return nil
}

func unreachable(err error) error {
	if errors.Is(err, ErrOtherHost) || errors.Is(err, context.Canceled) {
		return err
	}

	return fmt.Errorf("%w: %w", ErrUnreachable, err)
}

func readLimited(r io.Reader, limit int64) ([]byte, error) {
	data, err := io.ReadAll(io.LimitReader(r, limit+1))
	if err != nil {
		return nil, unreachable(err)
	}
	if int64(len(data)) > limit {
		return nil, fmt.Errorf("%w: the response is larger than %d bytes", ErrNotOPDS, limit)
	}

	return data, nil
}
