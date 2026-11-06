// Package imagesearch finds pictures for a title no catalog has a poster for on
// Wikimedia Commons, which needs no key. It only finds them; the node downloads
// the one the user picks.
package imagesearch

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

const (
	SourceWikimedia = "wikimedia"
	SourceCatalog   = "catalog"

	maxResults = 24
)

// Image is one picture a search found. Width and height are zero when the
// source did not say.
type Image struct {
	URL        string `json:"url" doc:"The picture itself, as the source links it. The node downloads it only when the user picks it."`
	Thumbnail  string `json:"thumbnail" doc:"A small copy to show in the list of candidates."`
	Width      int    `json:"width,omitempty"`
	Height     int    `json:"height,omitempty"`
	SourcePage string `json:"source_page,omitempty" doc:"The page the picture was found on."`
	Source     string `json:"source" enum:"catalog,wikimedia" doc:"Which search found it: a catalog of the title's kind, which holds its real poster, or Wikimedia Commons, which only matches words."`
}

type Options struct {
	WikimediaEndpoint string
	UserAgent         string
	Timeout           time.Duration

	// HTTP is the client for the search; tests point it at a fake.
	HTTP *http.Client
}

type Client struct {
	opts  Options
	httpc *http.Client
}

func New(opts Options) *Client {
	client := opts.HTTP
	if client == nil {
		client = &http.Client{Timeout: opts.Timeout}
	}

	return &Client{opts: opts, httpc: client}
}

// Search asks Wikimedia Commons, which matches the words of a file's own
// description, so the query is best kept to little more than the title's name.
func (c *Client) Search(ctx context.Context, query string) ([]Image, error) {
	if c.opts.WikimediaEndpoint == "" {
		return []Image{}, nil
	}

	images, err := c.wikimedia(ctx, query)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindUnavailable, "picture search is unreachable")
	}

	return images, nil
}

func (c *Client) get(ctx context.Context, address string, out any) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, address, http.NoBody)
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "build picture search request")
	}

	request.Header.Set("Accept", "application/json")
	request.Header.Set("User-Agent", c.opts.UserAgent)

	response, err := c.httpc.Do(request)
	if err != nil {
		return apperr.Wrap(err, apperr.KindUnavailable, "picture search is unreachable")
	}
	defer func() { _ = response.Body.Close() }()

	switch {
	case response.StatusCode == http.StatusTooManyRequests:
		return apperr.New(apperr.KindUnavailable, "the picture search is busy, try again in a moment")
	case response.StatusCode != http.StatusOK:
		return apperr.New(apperr.KindUpstream, "the picture search answered %d", response.StatusCode)
	}

	if err := json.NewDecoder(response.Body).Decode(out); err != nil {
		return apperr.Wrap(err, apperr.KindUpstream, "read picture search answer")
	}

	return nil
}

type commonsAnswer struct {
	Query struct {
		Pages map[string]struct {
			Index     int `json:"index"`
			ImageInfo []struct {
				URL            string `json:"url"`
				ThumbURL       string `json:"thumburl"`
				Width          int    `json:"width"`
				Height         int    `json:"height"`
				Mime           string `json:"mime"`
				DescriptionURL string `json:"descriptionurl"`
			} `json:"imageinfo"`
		} `json:"pages"`
	} `json:"query"`
}

func (c *Client) wikimedia(ctx context.Context, query string) ([]Image, error) {
	address := c.opts.WikimediaEndpoint + "?" + url.Values{
		"action":       {"query"},
		"format":       {"json"},
		"generator":    {"search"},
		"gsrsearch":    {query},
		"gsrnamespace": {"6"},
		"gsrlimit":     {strconv.Itoa(maxResults)},
		"prop":         {"imageinfo"},
		"iiprop":       {"url|size|mime"},
		"iiurlwidth":   {"300"},
	}.Encode()

	var answer commonsAnswer
	if err := c.get(ctx, address, &answer); err != nil {
		return nil, err
	}

	ordered := make([]Image, maxResults+1)
	var images []Image

	for _, page := range answer.Query.Pages {
		if len(page.ImageInfo) == 0 {
			continue
		}

		info := page.ImageInfo[0]
		if !strings.HasPrefix(info.Mime, "image/") || info.Mime == "image/svg+xml" || info.URL == "" {
			continue
		}

		image := Image{
			URL:        info.URL,
			Thumbnail:  info.ThumbURL,
			Width:      info.Width,
			Height:     info.Height,
			SourcePage: info.DescriptionURL,
			Source:     SourceWikimedia,
		}

		// Pages come keyed by id; the search's own order is in index.
		if page.Index > 0 && page.Index <= maxResults && ordered[page.Index].URL == "" {
			ordered[page.Index] = image
			continue
		}

		images = append(images, image)
	}

	result := make([]Image, 0, len(images)+maxResults)
	for _, image := range ordered {
		if image.URL != "" {
			result = append(result, image)
		}
	}

	return append(result, images...), nil
}
