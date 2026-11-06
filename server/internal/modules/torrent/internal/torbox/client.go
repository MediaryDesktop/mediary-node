// Package torbox talks to TorBox, a debrid service, through its API v1 with the
// user's own key. It only knows the calls; following torrents and fetching their
// files is the debrid package's work.
package torbox

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

const DefaultBaseURL = "https://api.torbox.app/v1/api"

// A response body larger than this is not one TorBox sends for the calls the
// node makes; a list of a thousand torrents with their files fits.
const maxResponseBytes = 16 << 20

type Options struct {
	// BaseURL is the API root; tests point it at their own server.
	BaseURL string
	// Key returns the user's API key. It is asked on every call, so a key saved
	// in the settings takes effect without a restart.
	Key       func() (string, error)
	UserAgent string
	Timeout   time.Duration
}

type Client struct {
	base string
	key  func() (string, error)
	ua   string
	http *http.Client
}

func New(opts Options) *Client {
	base := strings.TrimRight(opts.BaseURL, "/")
	if base == "" {
		base = DefaultBaseURL
	}

	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = 30 * time.Second
	}

	return &Client{base: base, key: opts.Key, ua: opts.UserAgent, http: &http.Client{Timeout: timeout}}
}

// StaticKey is a Key for a key that is not saved yet, as when the settings try
// one.
func StaticKey(key string) func() (string, error) {
	return func() (string, error) { return key, nil }
}

type User struct {
	Email string `json:"email"`
	// Plan is 0 for the free plan, then 1 Essential, 2 Pro, 3 Standard.
	Plan int `json:"plan"`
}

// PlanName names a plan the way TorBox's own site does.
func PlanName(plan int) string {
	switch plan {
	case 0:
		return "Free"
	case 1:
		return "Essential"
	case 2:
		return "Pro"
	case 3:
		return "Standard"
	default:
		return ""
	}
}

type File struct {
	ID int `json:"id"`
	// Name is the file's path inside the torrent, folder included, with forward
	// slashes.
	Name string `json:"name"`
	Size int64  `json:"size"`
}

type Torrent struct {
	ID            int64   `json:"id"`
	Hash          string  `json:"hash"`
	Name          string  `json:"name"`
	Size          int64   `json:"size"`
	DownloadState string  `json:"download_state"`
	Progress      float64 `json:"progress"`
	DownloadSpeed float64 `json:"download_speed"`
	Seeds         int     `json:"seeds"`
	Peers         int     `json:"peers"`
	ETA           int64   `json:"eta"`
	// Present means TorBox holds the files and links to them can be asked for.
	Present bool   `json:"download_present"`
	Files   []File `json:"files"`
}

// Queued is a torrent waiting for a free slot on the account.
type Queued struct {
	ID   int64  `json:"id"`
	Hash string `json:"hash"`
	Name string `json:"name"`
}

// Created is what adding a torrent gives back: its ID, or its place in the queue
// when the account has no free slot.
type Created struct {
	TorrentID int64  `json:"torrent_id"`
	QueuedID  int64  `json:"queued_id"`
	Hash      string `json:"hash"`
}

type envelope struct {
	Success bool            `json:"success"`
	Error   *string         `json:"error"`
	Detail  string          `json:"detail"`
	Data    json.RawMessage `json:"data"`
}

func (c *Client) Me(ctx context.Context) (*User, error) {
	var user User
	if err := c.call(ctx, http.MethodGet, "user/me", nil, nil, "", &user); err != nil {
		return nil, err
	}

	return &user, nil
}

// Create adds a torrent from a magnet or a .torrent file's content.
func (c *Client) Create(ctx context.Context, magnet string, torrent []byte, name string) (*Created, error) {
	var buf bytes.Buffer
	form := multipart.NewWriter(&buf)

	if magnet != "" {
		_ = form.WriteField("magnet", magnet)
	} else {
		part, err := form.CreateFormFile("file", "download.torrent")
		if err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "build the request to TorBox")
		}
		_, _ = part.Write(torrent)
	}
	if name != "" {
		_ = form.WriteField("name", name)
	}
	if err := form.Close(); err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "build the request to TorBox")
	}

	var created Created
	if err := c.call(ctx, http.MethodPost, "torrents/createtorrent", nil, buf.Bytes(), form.FormDataContentType(), &created); err != nil {
		return nil, err
	}

	return &created, nil
}

// Torrents lists the account's torrents with their files.
func (c *Client) Torrents(ctx context.Context) ([]Torrent, error) {
	var torrents []Torrent
	query := url.Values{"bypass_cache": {"true"}}
	if err := c.call(ctx, http.MethodGet, "torrents/mylist", query, nil, "", &torrents); err != nil {
		return nil, err
	}

	return torrents, nil
}

// The most hashes one cache check asks about; TorBox answers larger lists slowly.
const cacheBatch = 100

// Cached reports which of the hashes TorBox already holds, so adding them gives
// the files at once.
func (c *Client) Cached(ctx context.Context, hashes []string) (map[string]bool, error) {
	cached := make(map[string]bool, len(hashes))

	for start := 0; start < len(hashes); start += cacheBatch {
		batch := hashes[start:min(start+cacheBatch, len(hashes))]

		var items []struct {
			Hash string `json:"hash"`
		}
		query := url.Values{"hash": {strings.Join(batch, ",")}, "format": {"list"}}
		if err := c.call(ctx, http.MethodGet, "torrents/checkcached", query, nil, "", &items); err != nil {
			return nil, err
		}

		for _, item := range items {
			cached[strings.ToLower(item.Hash)] = true
		}
	}

	return cached, nil
}

// Queue lists the torrents waiting for a free slot.
func (c *Client) Queue(ctx context.Context) ([]Queued, error) {
	var queued []Queued
	query := url.Values{"type": {"torrent"}, "bypass_cache": {"true"}}
	if err := c.call(ctx, http.MethodGet, "queued/getqueued", query, nil, "", &queued); err != nil {
		return nil, err
	}

	return queued, nil
}

// Link is a short-lived address one file can be downloaded from. It carries the
// key, so it is never logged.
func (c *Client) Link(ctx context.Context, torrentID int64, fileID int) (string, error) {
	key, err := c.apiKey()
	if err != nil {
		return "", err
	}

	query := url.Values{
		"token":      {key},
		"torrent_id": {strconv.FormatInt(torrentID, 10)},
		"file_id":    {strconv.Itoa(fileID)},
	}

	var link string
	if err := c.call(ctx, http.MethodGet, "torrents/requestdl", query, nil, "", &link); err != nil {
		return "", err
	}
	if link == "" {
		return "", apperr.New(apperr.KindUpstream, "TorBox gave no link for the file")
	}

	return link, nil
}

// Delete removes a torrent from the account, or from its queue when queued.
func (c *Client) Delete(ctx context.Context, id int64, queued bool) error {
	endpoint, body := "torrents/controltorrent", map[string]any{"torrent_id": id, "operation": "delete"}
	if queued {
		endpoint, body = "queued/controlqueued", map[string]any{"queued_id": id, "operation": "delete"}
	}

	data, _ := json.Marshal(body)

	return c.call(ctx, http.MethodPost, endpoint, nil, data, "application/json", nil)
}

func (c *Client) apiKey() (string, error) {
	if c.key == nil {
		return "", apperr.New(apperr.KindPrecondition, "add a TorBox API key in the torrent settings first")
	}

	key, err := c.key()
	if err != nil {
		return "", apperr.Wrap(err, apperr.KindInternal, "read the TorBox API key")
	}
	if key == "" {
		return "", apperr.New(apperr.KindPrecondition, "add a TorBox API key in the torrent settings first")
	}

	return key, nil
}

func (c *Client) call(ctx context.Context, method, endpoint string, query url.Values, body []byte, contentType string, out any) error {
	key, err := c.apiKey()
	if err != nil {
		return err
	}

	target := c.base + "/" + endpoint
	if len(query) > 0 {
		target += "?" + query.Encode()
	}

	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}

	req, err := http.NewRequestWithContext(ctx, method, target, reader)
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "build the request to TorBox")
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Accept", "application/json")
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	if c.ua != "" {
		req.Header.Set("User-Agent", c.ua)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return ctxErr
		}
		// The URL may carry the key; the error names only the endpoint.
		var urlErr *url.Error
		if errors.As(err, &urlErr) {
			err = urlErr.Err
		}
		return apperr.Wrap(err, apperr.KindUnavailable, "TorBox cannot be reached")
	}
	defer func() { _ = resp.Body.Close() }()

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes+1))
	if err != nil {
		return apperr.Wrap(err, apperr.KindUnavailable, "read TorBox's answer")
	}
	if len(data) > maxResponseBytes {
		return apperr.New(apperr.KindUpstream, "TorBox's answer to %s is too large", endpoint)
	}

	var env envelope
	decodeErr := json.Unmarshal(data, &env)

	switch {
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden ||
		(env.Error != nil && *env.Error == "AUTH_ERROR"):
		return apperr.New(apperr.KindUpstream, "TorBox did not accept the API key: copy it again from the TorBox settings")
	case resp.StatusCode == http.StatusTooManyRequests:
		return apperr.New(apperr.KindUnavailable, "TorBox asks to slow down; the node tries again shortly")
	case resp.StatusCode >= 400 || (decodeErr == nil && !env.Success):
		return apperr.New(apperr.KindUpstream, "TorBox refused %s: %s", endpoint, reason(env, resp.StatusCode))
	case decodeErr != nil:
		return apperr.Wrap(decodeErr, apperr.KindUpstream, "TorBox's answer to %s cannot be read", endpoint)
	}

	if out == nil || len(env.Data) == 0 || string(env.Data) == "null" {
		return nil
	}

	if err := json.Unmarshal(env.Data, out); err != nil {
		return apperr.Wrap(err, apperr.KindUpstream, "TorBox's answer to %s cannot be read", endpoint)
	}

	return nil
}

func reason(env envelope, status int) string {
	switch {
	case env.Detail != "":
		return env.Detail
	case env.Error != nil && *env.Error != "":
		return *env.Error
	default:
		return fmt.Sprintf("HTTP %d", status)
	}
}
