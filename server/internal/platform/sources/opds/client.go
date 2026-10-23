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

	// A whole chapter archive; a volume of a large manga is well under this.
	MaxArchiveBytes = 1 << 30
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
	// Archive is the path of the book's own comic archive, when the server offers
	// it as one, so a download can keep the file exactly as the server has it.
	Archive string
	Updated time.Time
}

// Check reads the catalogue's root, which is enough to tell a wrong address from
// a wrong password.
func (c *Client) Check(ctx context.Context, server Server) error {
	_, err := c.feed(ctx, server, "")

	return err
}

// Search finds series by name, through the search the catalogue describes.
func (c *Client) Search(ctx context.Context, server Server, query string) ([]Series, error) {
	results, base, err := c.search(ctx, server, query)
	if err != nil {
		return nil, err
	}

	var series []Series
	for i := range results.Entries {
		entry := &results.Entries[i]

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

// search runs the catalogue's own search and returns the first page of results,
// with the server's address to resolve their links against.
func (c *Client) search(ctx context.Context, server Server, query string) (*Feed, *url.URL, error) {
	root, err := c.feed(ctx, server, "")
	if err != nil {
		return nil, nil, err
	}

	link, ok := root.Link(RelSearch)
	if !ok {
		return nil, nil, ErrNoSearch
	}

	template := link.Href
	if !strings.Contains(template, "{searchTerms}") {
		body, getErr := c.get(ctx, server, link.Href, maxFeedBytes)
		if getErr != nil {
			return nil, nil, getErr
		}

		if template, err = parseOpenSearch(bytes.NewReader(body)); err != nil {
			return nil, nil, err
		}
	}

	results, err := c.feed(ctx, server, strings.ReplaceAll(template, "{searchTerms}", url.QueryEscape(query)))
	if err != nil {
		return nil, nil, err
	}

	base, err := url.Parse(server.URL)
	if err != nil {
		return nil, nil, err
	}

	return results, base, nil
}

// Publication is one book a catalogue offers as files to take whole, as
// Calibre-Web and Standard Ebooks do, rather than a series of chapters.
type Publication struct {
	ID       string
	Title    string
	Authors  []string
	Language string
	Issued   string
	Summary  string
	Files    []File
}

// File is one way to take a publication: a format and where it is on the server.
type File struct {
	Path string
	// Type is the media type without its parameters, in lower case.
	Type string
	// Length is the size in bytes, 0 when the catalogue does not say.
	Length int64
}

// SearchPublications finds books through the catalogue's search. An entry
// without a file anyone may take — a navigation entry, a book only for sale or
// lending — is left out.
func (c *Client) SearchPublications(ctx context.Context, server Server, query string) ([]Publication, error) {
	results, base, err := c.search(ctx, server, query)
	if err != nil {
		return nil, err
	}

	var out []Publication
	for i := range results.Entries {
		entry := &results.Entries[i]

		pub := Publication{
			ID:       strings.TrimSpace(entry.ID),
			Title:    strings.TrimSpace(entry.Title),
			Language: strings.TrimSpace(entry.Language),
			Issued:   strings.TrimSpace(entry.Issued),
			Summary:  strings.TrimSpace(entry.Summary),
		}
		for _, author := range entry.Authors {
			if name := strings.TrimSpace(author.Name); name != "" {
				pub.Authors = append(pub.Authors, name)
			}
		}

		for _, link := range entry.Links {
			if link.Rel != RelAcquisition && link.Rel != RelOpenAccess {
				continue
			}
			if link.IsCatalogue() {
				continue
			}

			path, pathErr := serverPath(base, link.Href)
			if pathErr != nil {
				continue
			}

			pub.Files = append(pub.Files, File{Path: path, Type: mediaType(link.Type), Length: link.Length})
		}

		if len(pub.Files) > 0 && pub.Title != "" {
			out = append(out, pub)
		}
	}

	return out, nil
}

func mediaType(value string) string {
	return strings.ToLower(strings.TrimSpace(strings.Split(value, ";")[0]))
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

		for i := range feed.Entries {
			books = append(books, book(base, &feed.Entries[i]))
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

func book(base *url.URL, entry *Entry) Book {
	title := strings.TrimSpace(entry.Title)
	out := Book{ID: entry.ID, Title: title, Number: ChapterNumber(title)}

	if updated, err := time.Parse(time.RFC3339, entry.Updated); err == nil {
		out.Updated = updated
	}

	for _, link := range entry.Links {
		if link.Rel == RelAcquisition && isComicArchive(link) {
			if path, err := serverPath(base, link.Href); err == nil {
				out.Archive = path
			}
		}
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

// isComicArchive says whether an acquisition link is a CBZ. Servers name the type
// several ways; an EPUB or a PDF is not one the reader opens.
func isComicArchive(link Link) bool {
	switch strings.ToLower(strings.TrimSpace(strings.Split(link.Type, ";")[0])) {
	case "application/zip", "application/x-cbz", "application/vnd.comicbook+zip":
		return true
	}

	return strings.HasSuffix(strings.ToLower(strings.Split(link.Href, "?")[0]), ".cbz")
}

// Archive opens a book's archive for reading. The caller closes it; reading past
// MaxArchiveBytes fails rather than filling the disk.
func (c *Client) Archive(ctx context.Context, server Server, path string) (io.ReadCloser, error) {
	body, _, err := c.Open(ctx, server, path, MaxArchiveBytes)

	return body, err
}

// Open opens a file on the server for reading, with the type the server gave it.
// The caller closes it; what it reads stops one byte past limit, so a caller that
// reads limit+1 bytes knows the file was too large.
func (c *Client) Open(ctx context.Context, server Server, path string, limit int64) (io.ReadCloser, string, error) {
	req, err := c.request(ctx, server, path)
	if err != nil {
		return nil, "", err
	}

	// The client's timeout covers the whole body, and a file takes longer to
	// arrive than a feed; the caller's context bounds it instead.
	fileClient := *c.http
	fileClient.Timeout = 0

	resp, err := fileClient.Do(req)
	if err != nil {
		return nil, "", unreachable(err)
	}

	if statusErr := status(resp); statusErr != nil {
		_ = resp.Body.Close()
		return nil, "", statusErr
	}

	return limitedBody{Reader: io.LimitReader(resp.Body, limit+1), body: resp.Body}, mediaType(resp.Header.Get("Content-Type")), nil
}

type limitedBody struct {
	io.Reader
	body io.Closer
}

func (l limitedBody) Close() error { return l.body.Close() }

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
