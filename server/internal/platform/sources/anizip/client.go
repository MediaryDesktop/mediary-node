// Package anizip reads episode listings from ani.zip, which joins an AniList id to
// TheTVDB's and AniDB's per-episode titles, synopses and stills. AniList itself
// has no episode-level data beyond the few titles a streaming site exposes.
//
// ani.zip publishes no terms and no rate limit. The node treats it like any other
// source without stated terms: on demand only, a day of cache at most, one request
// at a time.
package anizip

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

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

const (
	maxResponseBytes = 8 << 20
	minInterval      = 500 * time.Millisecond
)

type Options struct {
	Endpoint  string
	Timeout   time.Duration
	UserAgent string
}

type Client struct {
	endpoint  string
	userAgent string
	http      *http.Client

	mu   sync.Mutex
	next time.Time
}

func New(opts Options) *Client {
	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = 15 * time.Second
	}

	return &Client{endpoint: strings.TrimRight(opts.Endpoint, "/"), userAgent: opts.UserAgent, http: &http.Client{Timeout: timeout}}
}

// Mapping is the part of an ani.zip answer the node reads. Episodes is keyed the
// way ani.zip keys it: "1", "2" for the season's own episodes, "S1", "S2" for
// specials, which AniList usually lists as titles of their own.
type Mapping struct {
	EpisodeCount *int               `json:"episodeCount"`
	Episodes     map[string]Episode `json:"episodes"`
}

type Episode struct {
	Episode       string            `json:"episode"`
	EpisodeNumber *int              `json:"episodeNumber"`
	Title         map[string]string `json:"title"`
	Overview      *string           `json:"overview"`
	Summary       *string           `json:"summary"`
	Image         *string           `json:"image"`
	Runtime       *float64          `json:"runtime"`
	Length        *float64          `json:"length"`
	AirDate       *string           `json:"airDate"`
}

// ByAniList returns what ani.zip knows of an AniList title, or nil when it knows
// nothing: most short and recent titles have no listing yet, and that is an
// answer, not a failure.
func (c *Client) ByAniList(ctx context.Context, aniListID int) (*Mapping, error) {
	if err := c.wait(ctx); err != nil {
		return nil, apperr.Wrap(err, apperr.KindUnavailable, "ani.zip request cancelled")
	}

	query := url.Values{"anilist_id": {strconv.Itoa(aniListID)}}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.endpoint+"/mappings?"+query.Encode(), http.NoBody)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "build ani.zip request")
	}

	req.Header.Set("Accept", "application/json")
	if c.userAgent != "" {
		req.Header.Set("User-Agent", c.userAgent)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindUnavailable, "ani.zip is unreachable")
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}

	if resp.StatusCode != http.StatusOK {
		return nil, apperr.New(apperr.KindUpstream, "ani.zip returned %d", resp.StatusCode)
	}

	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindUnavailable, "read ani.zip response")
	}

	var mapping Mapping
	if err := json.Unmarshal(raw, &mapping); err != nil {
		return nil, apperr.Wrap(err, apperr.KindUpstream, "decode ani.zip response")
	}

	return &mapping, nil
}

func (c *Client) wait(ctx context.Context) error {
	c.mu.Lock()
	now := time.Now()
	at := c.next
	if at.Before(now) {
		at = now
	}
	c.next = at.Add(minInterval)
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
