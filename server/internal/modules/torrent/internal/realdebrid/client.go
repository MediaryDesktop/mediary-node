// Package realdebrid talks to Real-Debrid through its REST API 1.0 with the
// user's own token, as a debrid.Provider.
package realdebrid

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/debrid"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

const DefaultBaseURL = "https://api.real-debrid.com/rest/1.0"

const maxResponseBytes = 16 << 20

type Options struct {
	BaseURL string
	// Key returns the user's API token, asked on every call.
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

var _ debrid.Provider = (*Client)(nil)

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

type user struct {
	Username   string `json:"username"`
	Type       string `json:"type"`
	Expiration string `json:"expiration"`
}

type torrent struct {
	ID       string  `json:"id"`
	Filename string  `json:"filename"`
	Hash     string  `json:"hash"`
	Progress float64 `json:"progress"`
	Status   string  `json:"status"`
	Speed    int64   `json:"speed"`
}

type torrentInfo struct {
	torrent
	Files []infoFile `json:"files"`
	Links []string   `json:"links"`
}

type infoFile struct {
	ID int `json:"id"`
	// Path starts with a slash: "/Show/Show - 01.mkv".
	Path     string `json:"path"`
	Bytes    int64  `json:"bytes"`
	Selected int    `json:"selected"`
}

// Statuses after which Real-Debrid will not get the torrent.
var failedStatuses = []string{"magnet_error", "error", "virus", "dead"}

func (c *Client) Account(ctx context.Context) (string, error) {
	var u user
	if err := c.call(ctx, http.MethodGet, "user", nil, nil, "", &u); err != nil {
		return "", err
	}

	if u.Type != "premium" {
		return "", apperr.New(apperr.KindPrecondition, "this Real-Debrid account has no premium: Real-Debrid downloads torrents only for premium accounts")
	}

	if until, err := time.Parse(time.RFC3339, u.Expiration); err == nil {
		return "Real-Debrid · Premium until " + until.Format("2006-01-02"), nil
	}

	return "Real-Debrid · Premium", nil
}

func (c *Client) Add(ctx context.Context, magnet string, torrentFile []byte, _ string) (string, error) {
	var added struct {
		ID string `json:"id"`
	}

	var err error
	if magnet != "" {
		err = c.call(ctx, http.MethodPost, "torrents/addMagnet", url.Values{"magnet": {magnet}}, nil, "", &added)
	} else {
		err = c.call(ctx, http.MethodPut, "torrents/addTorrent", nil, torrentFile, "application/x-bittorrent", &added)
	}
	if err != nil {
		return "", err
	}
	if added.ID == "" {
		return "", apperr.New(apperr.KindUpstream, "Real-Debrid gave no ID for the torrent")
	}

	return added.ID, nil
}

// Remotes lists the account's torrents. The listing has no files: Detail asks
// for them.
func (c *Client) Remotes(ctx context.Context) ([]debrid.Remote, error) {
	var torrents []torrent
	if err := c.call(ctx, http.MethodGet, "torrents", url.Values{"limit": {"500"}}, nil, "", &torrents); err != nil {
		return nil, err
	}

	remotes := make([]debrid.Remote, 0, len(torrents))
	for i := range torrents {
		remote := remoteOf(torrents[i])
		remote.Partial = true
		remotes = append(remotes, remote)
	}

	return remotes, nil
}

func remoteOf(t torrent) debrid.Remote {
	remote := debrid.Remote{
		ID:       t.ID,
		Hash:     strings.ToLower(t.Hash),
		Name:     t.Filename,
		Progress: t.Progress / 100,
		Speed:    t.Speed,
		Ready:    t.Status == "downloaded",
		Waiting:  t.Status == "waiting_files_selection",
		Queued:   t.Status == "queued",
	}
	if slices.Contains(failedStatuses, t.Status) {
		remote.Failed = "Real-Debrid: " + strings.ReplaceAll(t.Status, "_", " ")
	}

	return remote
}

func (c *Client) Detail(ctx context.Context, remote debrid.Remote) (debrid.Remote, error) {
	info, err := c.info(ctx, remote.ID)
	if err != nil {
		return remote, err
	}

	full := remoteOf(info.torrent)
	for _, f := range info.Files {
		full.Files = append(full.Files, debrid.RemoteFile{ID: f.ID, Path: strings.TrimPrefix(f.Path, "/"), Size: f.Bytes})
	}

	return full, nil
}

// Start selects every file: Real-Debrid downloads a cached torrent again when
// only some of its files are selected. The node fetches only the chosen ones.
func (c *Client) Start(ctx context.Context, remote debrid.Remote) error {
	return c.call(ctx, http.MethodPost, "torrents/selectFiles/"+url.PathEscape(remote.ID), url.Values{"files": {"all"}}, nil, "", nil)
}

func (c *Client) Cached(context.Context, []string) (map[string]bool, error) {
	return nil, debrid.ErrNoCacheCheck
}

// Link unrestricts the file's hoster link. Real-Debrid gives one link per
// selected file, in the order of the files.
func (c *Client) Link(ctx context.Context, remote debrid.Remote, fileID int) (string, error) {
	info, err := c.info(ctx, remote.ID)
	if err != nil {
		return "", err
	}

	position, selected := -1, 0
	for _, f := range info.Files {
		if f.Selected != 1 {
			continue
		}
		if f.ID == fileID {
			position = selected
			break
		}
		selected++
	}

	if position < 0 || position >= len(info.Links) {
		return "", apperr.New(apperr.KindUpstream, "Real-Debrid has no link for file %d", fileID)
	}

	var unrestricted struct {
		Download string `json:"download"`
	}
	if err := c.call(ctx, http.MethodPost, "unrestrict/link", url.Values{"link": {info.Links[position]}}, nil, "", &unrestricted); err != nil {
		return "", err
	}
	if unrestricted.Download == "" {
		return "", apperr.New(apperr.KindUpstream, "Real-Debrid gave no link for the file")
	}

	return unrestricted.Download, nil
}

func (c *Client) Delete(ctx context.Context, remote debrid.Remote) error {
	return c.call(ctx, http.MethodDelete, "torrents/delete/"+url.PathEscape(remote.ID), nil, nil, "", nil)
}

func (c *Client) info(ctx context.Context, id string) (*torrentInfo, error) {
	var info torrentInfo
	if err := c.call(ctx, http.MethodGet, "torrents/info/"+url.PathEscape(id), nil, nil, "", &info); err != nil {
		return nil, err
	}

	slices.SortFunc(info.Files, func(a, b infoFile) int { return a.ID - b.ID })

	return &info, nil
}

// call sends form as a urlencoded body for POST, or body as is with its type.
func (c *Client) call(ctx context.Context, method, endpoint string, form url.Values, body []byte, contentType string, out any) error {
	if c.key == nil {
		return apperr.New(apperr.KindPrecondition, "add a Real-Debrid API token in the torrent settings first")
	}
	key, err := c.key()
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "read the Real-Debrid API token")
	}
	if key == "" {
		return apperr.New(apperr.KindPrecondition, "add a Real-Debrid API token in the torrent settings first")
	}

	target := c.base + "/" + endpoint
	var reader io.Reader = http.NoBody

	switch {
	case method == http.MethodGet && len(form) > 0:
		target += "?" + form.Encode()
	case form != nil:
		reader = strings.NewReader(form.Encode())
		contentType = "application/x-www-form-urlencoded"
	case body != nil:
		reader = bytes.NewReader(body)
	}

	req, err := http.NewRequestWithContext(ctx, method, target, reader)
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "build the request to Real-Debrid")
	}
	req.Header.Set("Authorization", "Bearer "+key)
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
		var urlErr *url.Error
		if errors.As(err, &urlErr) {
			err = urlErr.Err
		}
		return apperr.Wrap(err, apperr.KindUnavailable, "Real-Debrid cannot be reached")
	}
	defer func() { _ = resp.Body.Close() }()

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes+1))
	if err != nil {
		return apperr.Wrap(err, apperr.KindUnavailable, "read Real-Debrid's answer")
	}
	if len(data) > maxResponseBytes {
		return apperr.New(apperr.KindUpstream, "Real-Debrid's answer to %s is too large", endpoint)
	}

	if resp.StatusCode >= 400 {
		var problem struct {
			Error string `json:"error"`
		}
		_ = json.Unmarshal(data, &problem)

		switch resp.StatusCode {
		case http.StatusUnauthorized:
			return apperr.New(apperr.KindUpstream, "Real-Debrid did not accept the API token: copy it again from real-debrid.com/apitoken")
		case http.StatusTooManyRequests:
			return apperr.New(apperr.KindUnavailable, "Real-Debrid asks to slow down; the node tries again shortly")
		}

		reason := problem.Error
		if reason == "" {
			reason = fmt.Sprintf("HTTP %d", resp.StatusCode)
		}
		return apperr.New(apperr.KindUpstream, "Real-Debrid refused %s: %s", endpoint, strings.ReplaceAll(reason, "_", " "))
	}

	if out == nil || len(bytes.TrimSpace(data)) == 0 {
		return nil
	}

	if err := json.Unmarshal(data, out); err != nil {
		return apperr.Wrap(err, apperr.KindUpstream, "Real-Debrid's answer to %s cannot be read", endpoint)
	}

	return nil
}
