package anilist

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

const (
	maxAttempts      = 3
	maxResponseBytes = 64 << 20
	fallbackBackoff  = time.Minute
	defaultInterval  = 700 * time.Millisecond
)

var (
	ErrNotAuthenticated = errors.New("anilist account is not connected")
	ErrTokenRejected    = errors.New("anilist rejected the access token")
)

type Options struct {
	Endpoint    string
	Timeout     time.Duration
	UserAgent   string
	Tokens      *TokenStore
	MinInterval time.Duration
}

type Client struct {
	endpoint  string
	userAgent string
	http      *http.Client
	tokens    *TokenStore
	pacer     *pacer
}

func New(opts Options) *Client {
	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = 30 * time.Second
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
		endpoint:  opts.Endpoint,
		userAgent: userAgent,
		http:      &http.Client{Timeout: timeout},
		tokens:    opts.Tokens,
		pacer:     newPacer(interval),
	}
}

func (c *Client) Tokens() *TokenStore {
	return c.tokens
}

type graphQLRequest struct {
	Query     string         `json:"query"`
	Variables map[string]any `json:"variables,omitempty"`
}

type graphQLResponse struct {
	Data   json.RawMessage `json:"data"`
	Errors []graphQLError  `json:"errors"`
}

type graphQLError struct {
	Message string `json:"message"`
	Status  int    `json:"status"`
}

func (c *Client) storedToken() (string, error) {
	if c.tokens == nil {
		return "", apperr.Wrap(ErrNotAuthenticated, apperr.KindPrecondition, "anilist account is not connected")
	}

	token, err := c.tokens.Token()
	if err != nil {
		return "", apperr.Wrap(err, apperr.KindInternal, "read anilist token")
	}

	if token == "" {
		return "", apperr.Wrap(ErrNotAuthenticated, apperr.KindPrecondition, "anilist account is not connected")
	}

	return token, nil
}

func (c *Client) query(ctx context.Context, token, query string, variables map[string]any, out any) error {
	body, err := json.Marshal(graphQLRequest{Query: query, Variables: variables})
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "encode anilist request")
	}

	for attempt := 1; ; attempt++ {
		if err := c.pacer.wait(ctx); err != nil {
			return apperr.Wrap(err, apperr.KindUnavailable, "anilist request cancelled")
		}

		retry, err := c.send(ctx, token, body, out)
		if !retry {
			return err
		}

		if attempt >= maxAttempts {
			return apperr.New(apperr.KindUnavailable, "anilist rate limit did not reset in time")
		}
	}
}

func (c *Client) send(ctx context.Context, token string, body []byte, out any) (bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(body))
	if err != nil {
		return false, apperr.Wrap(err, apperr.KindInternal, "build anilist request")
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", c.userAgent)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return false, apperr.Wrap(err, apperr.KindUnavailable, "anilist is unreachable")
	}
	defer func() { _ = resp.Body.Close() }()

	now := time.Now()

	if resp.StatusCode == http.StatusTooManyRequests {
		until, ok := resetTime(resp.Header, now)
		if !ok {
			until = now.Add(fallbackBackoff)
		}
		c.pacer.blockUntil(until)

		return true, nil
	}

	if resp.Header.Get("X-RateLimit-Remaining") == "0" {
		if until, ok := resetTime(resp.Header, now); ok {
			c.pacer.blockUntil(until)
		}
	}

	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		return false, apperr.Wrap(err, apperr.KindUnavailable, "read anilist response")
	}

	if resp.StatusCode == http.StatusUnauthorized {
		return false, apperrTokenRejected()
	}

	var decoded graphQLResponse
	if err := json.Unmarshal(raw, &decoded); err != nil {
		if resp.StatusCode >= http.StatusInternalServerError {
			return false, apperr.New(apperr.KindUpstream, "anilist returned %d", resp.StatusCode)
		}
		return false, apperr.Wrap(err, apperr.KindUpstream, "decode anilist response")
	}

	if len(decoded.Errors) > 0 {
		return false, classify(decoded.Errors, resp.StatusCode)
	}

	if resp.StatusCode >= http.StatusBadRequest {
		return false, apperr.New(apperr.KindUpstream, "anilist returned %d", resp.StatusCode)
	}

	if out != nil {
		if err := json.Unmarshal(decoded.Data, out); err != nil {
			return false, apperr.Wrap(err, apperr.KindUpstream, "decode anilist data")
		}
	}

	return false, nil
}

func classify(errs []graphQLError, httpStatus int) error {
	first := errs[0]

	for _, e := range errs {
		if e.Status == http.StatusUnauthorized || strings.Contains(strings.ToLower(e.Message), "invalid token") {
			return apperrTokenRejected()
		}
	}

	status := first.Status
	if status == 0 {
		status = httpStatus
	}

	if status == http.StatusNotFound {
		return apperr.New(apperr.KindNotFound, "anilist: %s", first.Message)
	}

	return apperr.New(apperr.KindUpstream, "anilist: %s", first.Message)
}

func apperrTokenRejected() error {
	return apperr.Wrap(ErrTokenRejected, apperr.KindUnauthorized, "anilist rejected the access token")
}

func IsTokenRejected(err error) bool {
	return errors.Is(err, ErrTokenRejected)
}
