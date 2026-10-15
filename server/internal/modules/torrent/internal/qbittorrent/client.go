// Package qbittorrent talks to the user's qBittorrent through its WebUI API v2.
// The node never runs qBittorrent itself: the user's client keeps its own
// settings — VPN, speed limits, schedule — and the node only adds torrents to it
// and reads how they are doing.
package qbittorrent

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// The WebUI API version that renamed pause and resume to stop and start
// (qBittorrent 5.0).
var stopStartVersion = [3]int{2, 11, 0}

// A response body larger than this is not one qBittorrent sends for the calls
// the node makes.
const maxResponseBytes = 16 << 20

type Options struct {
	// URL is the WebUI address, e.g. http://localhost:8080.
	URL      string
	Username string
	Password string
	Timeout  time.Duration
}

type Client struct {
	base     *url.URL
	username string
	password string
	http     *http.Client

	mu        sync.Mutex
	apiVer    [3]int
	apiVerSet bool
}

func New(opts Options) (*Client, error) {
	base, err := url.Parse(strings.TrimRight(strings.TrimSpace(opts.URL), "/"))
	if err != nil || (base.Scheme != "http" && base.Scheme != "https") || base.Host == "" {
		return nil, apperr.Invalid("url", "%q is not an http(s) address", opts.URL)
	}

	jar, _ := cookiejar.New(nil)

	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = 15 * time.Second
	}

	return &Client{
		base:     base,
		username: opts.Username,
		password: opts.Password,
		http:     &http.Client{Timeout: timeout, Jar: jar},
	}, nil
}

// Torrent is one torrent as the client reports it.
type Torrent struct {
	Hash       string  `json:"hash"`
	Name       string  `json:"name"`
	State      string  `json:"state"`
	Progress   float64 `json:"progress"`
	Size       int64   `json:"size"`
	AmountLeft int64   `json:"amount_left"`
	DLSpeed    int64   `json:"dlspeed"`
	UPSpeed    int64   `json:"upspeed"`
	Seeds      int     `json:"num_seeds"`
	Peers      int     `json:"num_leechs"`
	ETA        int64   `json:"eta"`
	SavePath   string  `json:"save_path"`

	// Remote is set by a debrid client while the service is still getting the
	// torrent itself; qBittorrent never sets it.
	Remote *Remote `json:"-"`
}

// Remote is how far a debrid service is with a torrent before the node can fetch
// its files.
type Remote struct {
	Service  string
	Progress float64
	// Speed is the service's own download speed, bytes per second.
	Speed int64
	// Queued waits for a free slot on the account.
	Queued bool
	// Error is why the service gave up on the torrent.
	Error string
}

// File is one file inside a torrent; Name is relative to the save path and uses
// forward slashes.
type File struct {
	Index    int     `json:"index"`
	Name     string  `json:"name"`
	Size     int64   `json:"size"`
	Progress float64 `json:"progress"`
	Priority int     `json:"priority"`
}

type AddRequest struct {
	Magnet string
	// Torrent is the content of a .torrent file, when there is no magnet.
	Torrent  []byte
	SavePath string
	Category string
	Tags     []string
	// Hold is for a torrent whose files the user picks first: a .torrent file is
	// added stopped; a magnet has no file list yet, so it is stopped once its
	// metadata arrives.
	Hold bool
}

// Version is the qBittorrent version, e.g. "v5.0.2". It doubles as the check that
// the address and the password are right.
func (c *Client) Version(ctx context.Context) (string, error) {
	body, err := c.call(ctx, http.MethodGet, "app/version", nil, "")
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(string(body)), nil
}

func (c *Client) Add(ctx context.Context, req AddRequest) error {
	var buf bytes.Buffer
	form := multipart.NewWriter(&buf)

	fields := map[string]string{
		"savepath": req.SavePath,
		"category": req.Category,
		"tags":     strings.Join(req.Tags, ","),
		// An explicit folder only holds with automatic management off; on, the
		// category's folder would win and the node would look in the wrong place.
		"autoTMM": "false",
	}
	if req.Magnet != "" {
		fields["urls"] = req.Magnet
	}

	if req.Hold {
		if req.Magnet != "" {
			// Clients before 4.5 do not know the stop condition and start the torrent
			// right away; the file choice then only trims what is left to download.
			fields["stopCondition"] = "MetadataReceived"
		} else {
			newer, err := c.atLeast(ctx, stopStartVersion)
			if err != nil {
				return err
			}
			if newer {
				fields["stopped"] = "true"
			} else {
				fields["paused"] = "true"
			}
		}
	}

	for name, value := range fields {
		if value == "" {
			continue
		}
		if err := form.WriteField(name, value); err != nil {
			return apperr.Wrap(err, apperr.KindInternal, "build the request to qBittorrent")
		}
	}

	if len(req.Torrent) > 0 {
		part, err := form.CreateFormFile("torrents", "download.torrent")
		if err != nil {
			return apperr.Wrap(err, apperr.KindInternal, "build the request to qBittorrent")
		}
		if _, err := part.Write(req.Torrent); err != nil {
			return apperr.Wrap(err, apperr.KindInternal, "build the request to qBittorrent")
		}
	}

	if err := form.Close(); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "build the request to qBittorrent")
	}

	if req.Category != "" {
		c.ensureCategory(ctx, req.Category)
	}

	body, err := c.call(ctx, http.MethodPost, "torrents/add", buf.Bytes(), form.FormDataContentType())
	if err != nil {
		return err
	}

	if strings.TrimSpace(string(body)) == "Fails." {
		return apperr.New(apperr.KindUpstream, "qBittorrent did not accept the torrent")
	}

	return nil
}

// ensureCategory creates the category the node files its torrents under. An
// existing one makes qBittorrent answer with an error, which is the expected case.
func (c *Client) ensureCategory(ctx context.Context, name string) {
	_, _ = c.call(ctx, http.MethodPost, "torrents/createCategory", formBody(url.Values{"category": {name}}), formType)
}

// Torrents reports the torrents with these hashes; one the client does not have is
// left out.
func (c *Client) Torrents(ctx context.Context, hashes []string) ([]Torrent, error) {
	if len(hashes) == 0 {
		return nil, nil
	}

	query := url.Values{"hashes": {strings.Join(hashes, "|")}}

	body, err := c.call(ctx, http.MethodGet, "torrents/info?"+query.Encode(), nil, "")
	if err != nil {
		return nil, err
	}

	var torrents []Torrent
	if err := json.Unmarshal(body, &torrents); err != nil {
		return nil, apperr.Wrap(err, apperr.KindUpstream, "read the torrent list from qBittorrent")
	}

	for i := range torrents {
		torrents[i].Hash = strings.ToLower(torrents[i].Hash)
	}

	return torrents, nil
}

func (c *Client) Files(ctx context.Context, hash string) ([]File, error) {
	query := url.Values{"hash": {hash}}

	body, err := c.call(ctx, http.MethodGet, "torrents/files?"+query.Encode(), nil, "")
	if err != nil {
		return nil, err
	}

	var files []File
	if err := json.Unmarshal(body, &files); err != nil {
		return nil, apperr.Wrap(err, apperr.KindUpstream, "read the torrent's files from qBittorrent")
	}

	for i := range files {
		files[i].Name = strings.ReplaceAll(files[i].Name, "\\", "/")
	}

	return files, nil
}

// Priorities of a torrent's files: skipped, or downloaded normally.
const (
	PrioritySkip   = 0
	PriorityNormal = 1
)

// SetFilePriority sets the priority of the files with these indices.
func (c *Client) SetFilePriority(ctx context.Context, hash string, indices []int, priority int) error {
	if len(indices) == 0 {
		return nil
	}

	ids := make([]string, 0, len(indices))
	for _, index := range indices {
		ids = append(ids, strconv.Itoa(index))
	}

	values := url.Values{
		"hash":     {hash},
		"id":       {strings.Join(ids, "|")},
		"priority": {strconv.Itoa(priority)},
	}

	_, err := c.call(ctx, http.MethodPost, "torrents/filePrio", formBody(values), formType)

	return err
}

func (c *Client) Pause(ctx context.Context, hash string) error {
	return c.pauseOrResume(ctx, hash, "pause", "stop")
}

func (c *Client) Resume(ctx context.Context, hash string) error {
	return c.pauseOrResume(ctx, hash, "resume", "start")
}

func (c *Client) pauseOrResume(ctx context.Context, hash, before, after string) error {
	endpoint := before

	newer, err := c.atLeast(ctx, stopStartVersion)
	if err != nil {
		return err
	}
	if newer {
		endpoint = after
	}

	_, err = c.call(ctx, http.MethodPost, "torrents/"+endpoint, formBody(url.Values{"hashes": {hash}}), formType)

	return err
}

func (c *Client) Delete(ctx context.Context, hash string, withFiles bool) error {
	values := url.Values{"hashes": {hash}, "deleteFiles": {strconv.FormatBool(withFiles)}}

	_, err := c.call(ctx, http.MethodPost, "torrents/delete", formBody(values), formType)

	return err
}

func (c *Client) atLeast(ctx context.Context, want [3]int) (bool, error) {
	c.mu.Lock()
	known, have := c.apiVerSet, c.apiVer
	c.mu.Unlock()

	if !known {
		body, err := c.call(ctx, http.MethodGet, "app/webapiVersion", nil, "")
		if err != nil {
			return false, err
		}

		have = parseVersion(strings.TrimSpace(string(body)))

		c.mu.Lock()
		c.apiVer, c.apiVerSet = have, true
		c.mu.Unlock()
	}

	for i := range want {
		if have[i] != want[i] {
			return have[i] > want[i], nil
		}
	}

	return true, nil
}

func parseVersion(raw string) [3]int {
	var version [3]int

	for i, part := range strings.SplitN(strings.TrimPrefix(raw, "v"), ".", 3) {
		version[i], _ = strconv.Atoi(part)
	}

	return version
}

const formType = "application/x-www-form-urlencoded"

func formBody(values url.Values) []byte {
	return []byte(values.Encode())
}

// call makes one API call, signing in first when qBittorrent asks for it. A client
// that lets the local network in without a password never asks. A refused
// password is an upstream error, not a 401: the app reads a 401 as its own
// session to the node having ended.
func (c *Client) call(ctx context.Context, method, endpoint string, body []byte, contentType string) ([]byte, error) {
	for attempt := 0; ; attempt++ {
		status, data, err := c.send(ctx, method, endpoint, body, contentType)
		if err != nil {
			return nil, err
		}

		switch {
		case status == http.StatusForbidden && attempt == 0:
			if err := c.login(ctx); err != nil {
				return nil, err
			}
			continue
		case status == http.StatusForbidden:
			return nil, apperr.New(apperr.KindUpstream, "qBittorrent refused the node: check the username and the password")
		case status == http.StatusUnauthorized:
			// Outside sign-in, qBittorrent answers 401 to a Host header it does not
			// expect — most often a Docker port mapped to another number.
			return nil, apperr.New(apperr.KindUpstream,
				"qBittorrent rejected the address %s: if it runs in Docker, publish its Web UI on the same port it listens on, or turn off Host header validation in its Web UI options", c.base.Host)
		case status >= 400:
			return nil, apperr.New(apperr.KindUpstream, "qBittorrent answered %s with %d: %s", endpoint, status, strings.TrimSpace(string(data)))
		}

		return data, nil
	}
}

func (c *Client) login(ctx context.Context) error {
	values := url.Values{"username": {c.username}, "password": {c.password}}

	status, data, err := c.send(ctx, http.MethodPost, "auth/login", formBody(values), formType)
	if err != nil {
		return err
	}

	// qBittorrent 4 answers 200 with "Ok." or "Fails."; 5 answers 204 or 401.
	switch {
	case status == http.StatusForbidden:
		return apperr.New(apperr.KindUpstream, "qBittorrent has blocked this address after too many failed sign-ins")
	case status >= 400 || strings.TrimSpace(string(data)) == "Fails.":
		return apperr.New(apperr.KindUpstream, "qBittorrent refused the username or the password")
	}

	return nil
}

func (c *Client) send(ctx context.Context, method, endpoint string, body []byte, contentType string) (status int, data []byte, err error) {
	target := c.base.JoinPath("api/v2")
	path, rawQuery, _ := strings.Cut(endpoint, "?")
	target = target.JoinPath(path)
	target.RawQuery = rawQuery

	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}

	req, err := http.NewRequestWithContext(ctx, method, target.String(), reader)
	if err != nil {
		return 0, nil, apperr.Wrap(err, apperr.KindInternal, "build the request to qBittorrent")
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		if errors.Is(ctx.Err(), context.Canceled) {
			return 0, nil, ctx.Err()
		}
		return 0, nil, apperr.Wrap(err, apperr.KindUnavailable, "qBittorrent is not reachable at %s", c.base.Redacted())
	}
	defer func() { _ = resp.Body.Close() }()

	data, err = io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		return 0, nil, apperr.Wrap(err, apperr.KindUnavailable, "read the answer from qBittorrent")
	}

	return resp.StatusCode, data, nil
}

// String names the client in logs without its password.
func (c *Client) String() string {
	return fmt.Sprintf("qBittorrent at %s", c.base.Redacted())
}
