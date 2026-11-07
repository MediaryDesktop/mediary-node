// Package torznab searches the user's own indexer proxy — Jackett or Prowlarr —
// through the Torznab API they both speak. The node ships no indexers of its own:
// which sites are searched is whatever the user set up there.
package torznab

import (
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

// A search answer larger than this is not a feed of results.
const maxResponseBytes = 16 << 20

type Client struct {
	http      *http.Client
	userAgent string
}

func New(timeout time.Duration, userAgent string) *Client {
	return &Client{http: &http.Client{Timeout: timeout}, userAgent: userAgent}
}

// Source is one Torznab endpoint, e.g.
// http://localhost:9117/api/v2.0/indexers/all/results/torznab/.
type Source struct {
	URL    string
	APIKey string
}

// ParseURL checks a Torznab address and drops a query the user may have pasted
// along with it, the API key above all: the key is kept apart from the address.
func ParseURL(raw string) (string, error) {
	address, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (address.Scheme != "http" && address.Scheme != "https") || address.Host == "" {
		return "", apperr.Invalid("url", "%q is not an http(s) address", raw)
	}

	address.RawQuery = ""
	address.Fragment = ""

	return address.String(), nil
}

type TorrentSourceCaps struct {
	Title  string `json:"title"`
	Search bool   `json:"search" doc:"Whether the endpoint takes a free-text search."`
}

// Item is one search result.
type Item struct {
	Title       string
	Indexer     string
	GUID        string
	Link        string
	PageURL     string
	PublishedAt time.Time
	Size        int64
	Seeders     int
	Peers       int
	Grabs       int
	InfoHash    string
	MagnetURL   string
}

func (c *Client) Caps(ctx context.Context, src Source) (*TorrentSourceCaps, error) {
	var doc struct {
		XMLName xml.Name `xml:"caps"`
		Server  struct {
			Title string `xml:"title,attr"`
		} `xml:"server"`
		Searching struct {
			Search struct {
				Available string `xml:"available,attr"`
			} `xml:"search"`
		} `xml:"searching"`
	}

	if err := c.get(ctx, src, url.Values{"t": {"caps"}}, &doc); err != nil {
		return nil, err
	}

	return &TorrentSourceCaps{Title: doc.Server.Title, Search: doc.Searching.Search.Available == "yes"}, nil
}

func (c *Client) Search(ctx context.Context, src Source, query string) ([]Item, error) {
	var doc struct {
		XMLName xml.Name `xml:"rss"`
		Items   []struct {
			Title    string `xml:"title"`
			GUID     string `xml:"guid"`
			Link     string `xml:"link"`
			Comments string `xml:"comments"`
			PubDate  string `xml:"pubDate"`
			Size     string `xml:"size"`
			Grabs    string `xml:"grabs"`
			Jackett  string `xml:"jackettindexer"`
			Prowlarr string `xml:"prowlarrindexer"`

			Enclosure struct {
				URL    string `xml:"url,attr"`
				Length string `xml:"length,attr"`
			} `xml:"enclosure"`

			Attrs []struct {
				Name  string `xml:"name,attr"`
				Value string `xml:"value,attr"`
			} `xml:"attr"`
		} `xml:"channel>item"`
	}

	if err := c.get(ctx, src, url.Values{"t": {"search"}, "q": {query}, "limit": {"100"}}, &doc); err != nil {
		return nil, err
	}

	items := make([]Item, 0, len(doc.Items))

	for i := range doc.Items {
		raw := &doc.Items[i]

		item := Item{
			Title:   strings.TrimSpace(raw.Title),
			Indexer: strings.TrimSpace(firstOf(raw.Jackett, raw.Prowlarr)),
			GUID:    raw.GUID,
			Link:    firstOf(raw.Link, raw.Enclosure.URL),
			PageURL: webPage(raw.Comments),
		}

		item.Size, _ = strconv.ParseInt(firstOf(raw.Size, raw.Enclosure.Length), 10, 64)
		// Jackett gives grabs as an element of its own, Torznab as an attribute.
		item.Grabs, _ = strconv.Atoi(raw.Grabs)

		if published, err := time.Parse(time.RFC1123Z, raw.PubDate); err == nil {
			item.PublishedAt = published
		}

		for _, attr := range raw.Attrs {
			switch attr.Name {
			case "seeders":
				item.Seeders, _ = strconv.Atoi(attr.Value)
			case "peers":
				item.Peers, _ = strconv.Atoi(attr.Value)
			case "grabs":
				item.Grabs, _ = strconv.Atoi(attr.Value)
			case "infohash":
				item.InfoHash = strings.ToLower(attr.Value)
			case "magneturl":
				item.MagnetURL = attr.Value
			case "size":
				if item.Size == 0 {
					item.Size, _ = strconv.ParseInt(attr.Value, 10, 64)
				}
			}
		}

		// Torznab counts seeders among peers.
		if item.Peers >= item.Seeders {
			item.Peers -= item.Seeders
		}

		if strings.HasPrefix(item.Link, "magnet:") && item.MagnetURL == "" {
			item.MagnetURL, item.Link = item.Link, ""
		}

		if item.Title != "" && (item.Link != "" || item.MagnetURL != "") {
			items = append(items, item)
		}
	}

	return items, nil
}

func (c *Client) get(ctx context.Context, src Source, query url.Values, out any) error {
	address, err := url.Parse(src.URL)
	if err != nil {
		return apperr.Invalid("url", "%q is not an address", src.URL)
	}

	values := address.Query()
	for key, list := range query {
		values[key] = list
	}
	if src.APIKey != "" {
		values.Set("apikey", src.APIKey)
	}
	address.RawQuery = values.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, address.String(), http.NoBody)
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "build the Torznab request")
	}
	req.Header.Set("User-Agent", c.userAgent)

	resp, err := c.http.Do(req)
	if err != nil {
		if errors.Is(ctx.Err(), context.Canceled) {
			return ctx.Err()
		}
		return apperr.Wrap(err, apperr.KindUnavailable, "%s is not reachable", redacted(address))
	}
	defer func() { _ = resp.Body.Close() }()

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		return apperr.Wrap(err, apperr.KindUnavailable, "read the answer from %s", redacted(address))
	}

	// Torznab reports its own errors as <error code="…" description="…"/>, with
	// any status code, so the body is looked at first.
	var problem struct {
		XMLName     xml.Name `xml:"error"`
		Code        string   `xml:"code,attr"`
		Description string   `xml:"description,attr"`
	}
	if xml.Unmarshal(data, &problem) == nil && problem.XMLName.Local == "error" {
		return apperr.New(apperr.KindUpstream, "%s: %s", redacted(address), problem.Description)
	}

	if resp.StatusCode >= 400 {
		return apperr.New(apperr.KindUpstream, "%s answered %d", redacted(address), resp.StatusCode)
	}

	if err := xml.Unmarshal(data, out); err != nil {
		return apperr.Wrap(err, apperr.KindUpstream, "%s did not answer with a Torznab feed", redacted(address))
	}

	return nil
}

// Fetch downloads a result's .torrent file. A link that redirects to a magnet —
// Jackett does this for sites that only give magnets — is returned as the magnet.
func (c *Client) Fetch(ctx context.Context, link string) (data []byte, magnet string, err error) {
	client := *c.http
	client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		if req.URL.Scheme == "magnet" || len(via) >= 5 {
			return http.ErrUseLastResponse
		}
		return nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, link, http.NoBody)
	if err != nil {
		return nil, "", apperr.Invalid("link", "the result's link is not an address")
	}
	req.Header.Set("User-Agent", c.userAgent)

	resp, err := client.Do(req)
	if err != nil {
		return nil, "", apperr.Wrap(err, apperr.KindUnavailable, "could not fetch the torrent")
	}
	defer func() { _ = resp.Body.Close() }()

	if location := resp.Header.Get("Location"); strings.HasPrefix(location, "magnet:") {
		return nil, location, nil
	}

	if resp.StatusCode >= 400 {
		return nil, "", apperr.New(apperr.KindUpstream, "the indexer answered %d for the torrent", resp.StatusCode)
	}

	data, err = io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		return nil, "", apperr.Wrap(err, apperr.KindUnavailable, "could not fetch the torrent")
	}

	return data, "", nil
}

// redacted names an endpoint in an error without its API key.
func redacted(address *url.URL) string {
	return fmt.Sprintf("%s://%s%s", address.Scheme, address.Host, address.Path)
}

func firstOf(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}

	return ""
}

// webPage is a release page the user may open, or "" for anything else. The
// address comes from the indexer — and behind Jackett, from whatever tracker it
// scraped — and the desktop hands it to the operating system, which acts on any
// scheme it is given: only a web address is ever passed on, as plugins' are.
func webPage(raw string) string {
	raw = strings.TrimSpace(raw)

	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" || u.User != nil {
		return ""
	}

	return raw
}
