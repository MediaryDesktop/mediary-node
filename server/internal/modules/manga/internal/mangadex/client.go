// Package mangadex reads MangaDex's public API: series, their chapter feeds, and
// the at-home servers that hold the pages. It follows the API's rules as written
// at https://api.mangadex.org/docs/2-limitations: a real User-Agent, about five
// requests a second, forty at-home lookups a minute, images fetched by the node
// rather than hotlinked, and a report for every image a MangaDex@Home node served.
package mangadex

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	ErrNotFound  = errors.New("MangaDex has no such item")
	ErrExternal  = errors.New("the chapter is on the publisher's site, not on MangaDex")
	ErrUnhealthy = errors.New("MangaDex did not answer as expected")
)

const (
	// Under the global limit of about five a second, so a burst never earns a ban.
	apiInterval = 250 * time.Millisecond
	// Forty at-home lookups a minute, with room to spare.
	atHomeInterval = 1600 * time.Millisecond

	maxBodyBytes  = 16 << 20
	maxImageBytes = 64 << 20

	// The API refuses offset + limit beyond this.
	maxFeedItems = 10_000
	feedPage     = 500
)

type Options struct {
	Endpoint       string
	ReportEndpoint string
	Timeout        time.Duration
	UserAgent      string
}

type Client struct {
	http      *http.Client
	endpoint  string
	reportURL string
	userAgent string

	api    *pacer
	atHome *pacer
}

func New(opts Options) *Client {
	return &Client{
		http:      &http.Client{Timeout: opts.Timeout},
		endpoint:  strings.TrimRight(opts.Endpoint, "/"),
		reportURL: opts.ReportEndpoint,
		userAgent: opts.UserAgent,
		api:       newPacer(apiInterval),
		atHome:    newPacer(atHomeInterval),
	}
}

// Manga is a series as a search finds it.
type Manga struct {
	ID    string
	Title string
	// AniListID is the series' AniList id, when MangaDex records one.
	AniListID string
	Year      int
}

// Chapter is one chapter in one language.
type Chapter struct {
	ID       string
	MangaID  string
	Number   string
	Volume   string
	Title    string
	Language string
	Groups   []string
	Pages    int
	// ExternalURL is set for a chapter only the publisher hosts; it has no pages here.
	ExternalURL string
}

// AtHome is where a chapter's pages are, for the next fifteen minutes or so.
type AtHome struct {
	BaseURL string
	Hash    string
	Files   []string
}

func (c *Client) Search(ctx context.Context, title string) ([]Manga, error) {
	query := url.Values{}
	query.Set("title", title)
	query.Set("limit", "20")
	for _, rating := range []string{"safe", "suggestive", "erotica"} {
		query.Add("contentRating[]", rating)
	}

	var body struct {
		Data []mangaData `json:"data"`
	}
	if err := c.get(ctx, c.api, "/manga?"+query.Encode(), &body); err != nil {
		return nil, err
	}

	out := make([]Manga, 0, len(body.Data))
	for _, data := range body.Data {
		out = append(out, data.manga())
	}

	return out, nil
}

// Feed lists a series' chapters in the given languages, in chapter order, every
// page of it.
func (c *Client) Feed(ctx context.Context, mangaID string, languages []string) ([]Chapter, error) {
	var out []Chapter

	for offset := 0; offset+feedPage <= maxFeedItems; offset += feedPage {
		query := url.Values{}
		query.Set("limit", strconv.Itoa(feedPage))
		query.Set("offset", strconv.Itoa(offset))
		query.Set("order[chapter]", "asc")
		query.Add("includes[]", "scanlation_group")
		for _, language := range languages {
			query.Add("translatedLanguage[]", language)
		}
		for _, rating := range []string{"safe", "suggestive", "erotica"} {
			query.Add("contentRating[]", rating)
		}

		var body struct {
			Data  []chapterData `json:"data"`
			Total int           `json:"total"`
		}
		if err := c.get(ctx, c.api, "/manga/"+url.PathEscape(mangaID)+"/feed?"+query.Encode(), &body); err != nil {
			return nil, err
		}

		for _, data := range body.Data {
			out = append(out, data.chapter())
		}

		if offset+len(body.Data) >= body.Total || len(body.Data) == 0 {
			return out, nil
		}
	}

	return out, nil
}

func (c *Client) Chapter(ctx context.Context, chapterID string) (*Chapter, error) {
	var body struct {
		Data chapterData `json:"data"`
	}
	if err := c.get(ctx, c.api, "/chapter/"+url.PathEscape(chapterID)+"?includes[]=scanlation_group", &body); err != nil {
		return nil, err
	}

	chapter := body.Data.chapter()

	return &chapter, nil
}

func (c *Client) AtHome(ctx context.Context, chapterID string) (*AtHome, error) {
	var body struct {
		BaseURL string `json:"baseUrl"`
		Chapter struct {
			Hash string   `json:"hash"`
			Data []string `json:"data"`
		} `json:"chapter"`
	}
	if err := c.get(ctx, c.atHome, "/at-home/server/"+url.PathEscape(chapterID), &body); err != nil {
		return nil, err
	}

	if body.BaseURL == "" || body.Chapter.Hash == "" {
		return nil, fmt.Errorf("%w: no page server for the chapter", ErrUnhealthy)
	}

	return &AtHome{BaseURL: strings.TrimRight(body.BaseURL, "/"), Hash: body.Chapter.Hash, Files: body.Chapter.Data}, nil
}

// Image fetches one page. It carries no credentials, as the API asks, and reports
// how a MangaDex@Home node did, so MangaDex can route readers away from bad ones.
func (c *Client) Image(ctx context.Context, home *AtHome, index int) (data []byte, contentType string, err error) {
	if index < 0 || index >= len(home.Files) {
		return nil, "", ErrNotFound
	}

	address := home.BaseURL + "/data/" + home.Hash + "/" + home.Files[index]
	started := time.Now()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, address, http.NoBody)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("User-Agent", c.userAgent)

	resp, err := c.http.Do(req)
	if err != nil {
		c.report(ctx, address, false, false, 0, started)
		return nil, "", fmt.Errorf("%w: %w", ErrUnhealthy, err)
	}
	defer func() { _ = resp.Body.Close() }()

	cached := strings.HasPrefix(resp.Header.Get("X-Cache"), "HIT")

	if resp.StatusCode != http.StatusOK {
		c.report(ctx, address, false, cached, 0, started)
		return nil, "", fmt.Errorf("%w: the page server answered %d", ErrUnhealthy, resp.StatusCode)
	}

	data, err = io.ReadAll(io.LimitReader(resp.Body, maxImageBytes+1))
	if err != nil || len(data) > maxImageBytes {
		c.report(ctx, address, false, cached, len(data), started)
		return nil, "", fmt.Errorf("%w: the page did not arrive whole", ErrUnhealthy)
	}

	c.report(ctx, address, true, cached, len(data), started)

	contentType = resp.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		contentType = http.DetectContentType(data)
	}

	return data, contentType, nil
}

// report tells MangaDex@Home how a node served a page. Pages from MangaDex's own
// servers are not reported, as the API asks. It never holds up the reader.
func (c *Client) report(ctx context.Context, address string, success, cached bool, size int, started time.Time) {
	if c.reportURL == "" {
		return
	}

	parsed, err := url.Parse(address)
	if err != nil || parsed.Hostname() == "mangadex.org" || strings.HasSuffix(parsed.Hostname(), ".mangadex.org") {
		return
	}

	payload, err := json.Marshal(map[string]any{
		"url":      address,
		"success":  success,
		"cached":   cached,
		"bytes":    size,
		"duration": time.Since(started).Milliseconds(),
	})
	if err != nil {
		return
	}

	go func() {
		reportCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 10*time.Second)
		defer cancel()

		req, err := http.NewRequestWithContext(reportCtx, http.MethodPost, c.reportURL, bytes.NewReader(payload))
		if err != nil {
			return
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", c.userAgent)

		if resp, err := c.http.Do(req); err == nil {
			_ = resp.Body.Close()
		}
	}()
}

func (c *Client) get(ctx context.Context, pace *pacer, path string, out any) error {
	if err := pace.wait(ctx); err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.endpoint+path, http.NoBody)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", c.userAgent)
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrUnhealthy, err)
	}
	defer func() { _ = resp.Body.Close() }()

	switch {
	case resp.StatusCode == http.StatusTooManyRequests:
		pace.blockUntil(retryAt(resp.Header))
		return fmt.Errorf("%w: too many requests, try again shortly", ErrUnhealthy)
	case resp.StatusCode == http.StatusNotFound:
		return ErrNotFound
	case resp.StatusCode >= 400:
		return fmt.Errorf("%w: %s answered %d", ErrUnhealthy, strings.SplitN(path, "?", 2)[0], resp.StatusCode)
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxBodyBytes+1))
	if err != nil {
		return fmt.Errorf("%w: %w", ErrUnhealthy, err)
	}
	if len(data) > maxBodyBytes {
		return fmt.Errorf("%w: the answer is too large", ErrUnhealthy)
	}

	if err := json.Unmarshal(data, out); err != nil {
		return fmt.Errorf("%w: %w", ErrUnhealthy, err)
	}

	return nil
}

// retryAt reads when MangaDex will take requests again: its own header holds a
// Unix time, Retry-After a number of seconds.
func retryAt(headers http.Header) time.Time {
	if raw := headers.Get("X-RateLimit-Retry-After"); raw != "" {
		if unix, err := strconv.ParseInt(raw, 10, 64); err == nil && unix > 0 {
			return time.Unix(unix, 0)
		}
	}
	if raw := headers.Get("Retry-After"); raw != "" {
		if seconds, err := strconv.Atoi(raw); err == nil && seconds >= 0 {
			return time.Now().Add(time.Duration(seconds+1) * time.Second)
		}
	}

	return time.Now().Add(time.Minute)
}

type mangaData struct {
	ID         string `json:"id"`
	Attributes struct {
		Title     map[string]string   `json:"title"`
		AltTitles []map[string]string `json:"altTitles"`
		Links     map[string]string   `json:"links"`
		Year      *int                `json:"year"`
	} `json:"attributes"`
}

func (m mangaData) manga() Manga {
	out := Manga{ID: m.ID, Title: pickTitle(m.Attributes.Title, m.Attributes.AltTitles), AniListID: m.Attributes.Links["al"]}
	if m.Attributes.Year != nil {
		out.Year = *m.Attributes.Year
	}

	return out
}

func pickTitle(titles map[string]string, alt []map[string]string) string {
	if title := titles["en"]; title != "" {
		return title
	}
	for _, names := range alt {
		if title := names["en"]; title != "" {
			return title
		}
	}
	for _, title := range titles {
		if title != "" {
			return title
		}
	}

	return ""
}

type chapterData struct {
	ID         string `json:"id"`
	Attributes struct {
		Volume             *string `json:"volume"`
		Chapter            *string `json:"chapter"`
		Title              *string `json:"title"`
		TranslatedLanguage string  `json:"translatedLanguage"`
		Pages              int     `json:"pages"`
		ExternalURL        *string `json:"externalUrl"`
	} `json:"attributes"`
	Relationships []struct {
		ID         string `json:"id"`
		Type       string `json:"type"`
		Attributes *struct {
			Name string `json:"name"`
		} `json:"attributes"`
	} `json:"relationships"`
}

func (c chapterData) chapter() Chapter {
	out := Chapter{
		ID:       c.ID,
		Number:   deref(c.Attributes.Chapter),
		Volume:   deref(c.Attributes.Volume),
		Title:    deref(c.Attributes.Title),
		Language: c.Attributes.TranslatedLanguage,
		Pages:    c.Attributes.Pages,
	}
	if c.Attributes.ExternalURL != nil && *c.Attributes.ExternalURL != "" {
		out.ExternalURL = *c.Attributes.ExternalURL
	}

	for _, rel := range c.Relationships {
		switch rel.Type {
		case "manga":
			out.MangaID = rel.ID
		case "scanlation_group":
			if rel.Attributes != nil && rel.Attributes.Name != "" {
				out.Groups = append(out.Groups, rel.Attributes.Name)
			}
		}
	}

	return out
}

func deref(s *string) string {
	if s == nil {
		return ""
	}

	return strings.TrimSpace(*s)
}

// pacer spaces requests and holds them all back after a 429 until MangaDex says.
type pacer struct {
	mu           sync.Mutex
	interval     time.Duration
	nextAllowed  time.Time
	blockedUntil time.Time
}

func newPacer(interval time.Duration) *pacer {
	return &pacer{interval: interval}
}

func (p *pacer) wait(ctx context.Context) error {
	for {
		p.mu.Lock()
		now := time.Now()
		until := p.nextAllowed
		if p.blockedUntil.After(until) {
			until = p.blockedUntil
		}

		if !now.Before(until) {
			p.nextAllowed = now.Add(p.interval)
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
