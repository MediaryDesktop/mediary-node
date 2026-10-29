// Package imagesearch finds pictures for a title no catalog has a poster for:
// Brave's image search with the user's own key, and Wikimedia Commons, which
// needs none. It only finds them; the node downloads the one the user picks.
package imagesearch

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/secrets"
)

const (
	SourceBrave     = "brave"
	SourceWikimedia = "wikimedia"

	braveKeyEntry = "brave.api_key"
	maxResults    = 24
)

// Image is one picture a search found. Width and height are zero when the
// source did not say.
type Image struct {
	URL        string `json:"url" doc:"The picture itself, as the source links it. The node downloads it only when the user picks it."`
	Thumbnail  string `json:"thumbnail" doc:"A small copy to show in the list of candidates."`
	Width      int    `json:"width,omitempty"`
	Height     int    `json:"height,omitempty"`
	SourcePage string `json:"source_page,omitempty" doc:"The page the picture was found on."`
	Source     string `json:"source" enum:"brave,wikimedia" doc:"Which search found it."`
}

type Options struct {
	BraveEndpoint     string
	WikimediaEndpoint string
	UserAgent         string
	Timeout           time.Duration

	// Store keeps the user's Brave key in a file only they can read.
	Store *secrets.Store

	// HTTP is the client for both searches; tests point it at a fake.
	HTTP *http.Client
}

type Client struct {
	opts  Options
	keys  *secrets.APIKey
	httpc *http.Client
}

func New(opts Options) *Client {
	client := opts.HTTP
	if client == nil {
		client = &http.Client{Timeout: opts.Timeout}
	}

	return &Client{opts: opts, keys: secrets.NewAPIKey(opts.Store, braveKeyEntry, ""), httpc: client}
}

func (c *Client) Keys() *secrets.APIKey {
	return c.keys
}

// Query is what to look for, phrased for each source: a web search does best
// with everything known about the title, Commons with little more than its name,
// since it matches the words of a file's own description.
type Query struct {
	Web     string
	Commons string
}

// Search asks Brave when the user saved a key, then Wikimedia Commons, and
// returns what both found, Brave's first: it finds posters, Commons mostly finds
// freely licensed photographs. A source that fails only leaves its part empty.
func (c *Client) Search(ctx context.Context, query Query) ([]Image, error) {
	var (
		found  []Image
		failed []error
	)

	key, err := c.keys.Key()
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read brave api key")
	}

	if key != "" && c.opts.BraveEndpoint != "" {
		images, braveErr := c.brave(ctx, key, query.Web)
		if braveErr != nil {
			failed = append(failed, braveErr)
		}

		found = append(found, images...)
	}

	if c.opts.WikimediaEndpoint != "" {
		images, wikiErr := c.wikimedia(ctx, query.Commons)
		if wikiErr != nil {
			failed = append(failed, wikiErr)
		}

		found = append(found, images...)
	}

	if len(found) == 0 && len(failed) > 0 {
		return nil, apperr.Wrap(errors.Join(failed...), apperr.KindUnavailable, "picture search is unreachable")
	}

	return found, nil
}

// Check asks Brave whether it accepts the key with the smallest search it runs.
func (c *Client) Check(ctx context.Context, key string) error {
	if c.opts.BraveEndpoint == "" {
		return apperr.New(apperr.KindPrecondition, "Brave search is turned off on this node")
	}

	_, err := c.brave(ctx, key, "poster")

	return err
}

func (c *Client) get(ctx context.Context, address string, header http.Header, out any) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, address, http.NoBody)
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "build picture search request")
	}

	request.Header = header
	request.Header.Set("Accept", "application/json")
	request.Header.Set("User-Agent", c.opts.UserAgent)

	response, err := c.httpc.Do(request)
	if err != nil {
		return apperr.Wrap(err, apperr.KindUnavailable, "picture search is unreachable")
	}
	defer func() { _ = response.Body.Close() }()

	switch {
	case response.StatusCode == http.StatusUnauthorized || response.StatusCode == http.StatusForbidden:
		return apperr.New(apperr.KindPrecondition, "the picture search did not accept the API key")
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

// braveAnswer reads only the fields every result is known to carry; the rest
// of Brave's answer is left alone, so a field it adds or drops breaks nothing.
type braveAnswer struct {
	Results []struct {
		Title      string `json:"title"`
		URL        string `json:"url"`
		Properties struct {
			URL    string          `json:"url"`
			Width  json.RawMessage `json:"width"`
			Height json.RawMessage `json:"height"`
		} `json:"properties"`
		Thumbnail struct {
			Src string `json:"src"`
		} `json:"thumbnail"`
	} `json:"results"`
}

func (c *Client) brave(ctx context.Context, key, query string) ([]Image, error) {
	address := c.opts.BraveEndpoint + "?" + url.Values{
		"q":          {query},
		"count":      {strconv.Itoa(maxResults)},
		"safesearch": {"strict"},
	}.Encode()

	header := http.Header{}
	header.Set("X-Subscription-Token", key)

	var answer braveAnswer
	if err := c.get(ctx, address, header, &answer); err != nil {
		return nil, err
	}

	images := make([]Image, 0, len(answer.Results))

	for i := range answer.Results {
		result := &answer.Results[i]
		if result.Properties.URL == "" {
			continue
		}

		thumbnail := result.Thumbnail.Src
		if thumbnail == "" {
			thumbnail = result.Properties.URL
		}

		images = append(images, Image{
			URL:        result.Properties.URL,
			Thumbnail:  thumbnail,
			Width:      looseInt(result.Properties.Width),
			Height:     looseInt(result.Properties.Height),
			SourcePage: result.URL,
			Source:     SourceBrave,
		})
	}

	return images, nil
}

// looseInt reads a number that may come as one or as a string.
func looseInt(raw json.RawMessage) int {
	text := strings.Trim(string(raw), `"`)

	value, err := strconv.Atoi(text)
	if err != nil || value < 0 {
		return 0
	}

	return value
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
	if err := c.get(ctx, address, http.Header{}, &answer); err != nil {
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
