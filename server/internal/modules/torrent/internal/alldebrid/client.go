// Package alldebrid talks to AllDebrid through its API v4.1 with the user's own
// key, as a debrid.Provider.
package alldebrid

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/debrid"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

const DefaultBaseURL = "https://api.alldebrid.com/v4.1"

const maxResponseBytes = 16 << 20

// The agent AllDebrid asks every client to name itself with.
const agent = "mediary"

type Options struct {
	BaseURL string
	// Key returns the user's API key, asked on every call.
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

type magnet struct {
	ID            int64  `json:"id"`
	Filename      string `json:"filename"`
	Size          int64  `json:"size"`
	Hash          string `json:"hash"`
	Status        string `json:"status"`
	StatusCode    int    `json:"statusCode"`
	Downloaded    int64  `json:"downloaded"`
	DownloadSpeed int64  `json:"downloadSpeed"`
}

// node is one entry of a magnet's file tree: a file with a link, or a folder
// with entries.
type node struct {
	Name    string `json:"n"`
	Size    int64  `json:"s"`
	Link    string `json:"l"`
	Entries []node `json:"e"`
}

type itemError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// AllDebrid's status codes: 0 to 3 on the way, 4 ready, the rest given up.
const (
	statusQueued = 0
	statusReady  = 4
)

func (c *Client) Account(ctx context.Context) (string, error) {
	var data struct {
		User struct {
			Username     string `json:"username"`
			IsPremium    bool   `json:"isPremium"`
			PremiumUntil int64  `json:"premiumUntil"`
		} `json:"user"`
	}
	if err := c.call(ctx, http.MethodGet, "user", nil, nil, "", &data); err != nil {
		return "", err
	}

	if !data.User.IsPremium {
		return "", apperr.New(apperr.KindPrecondition, "this AllDebrid account has no premium: AllDebrid downloads torrents only for premium accounts")
	}
	if data.User.PremiumUntil > 0 {
		return "AllDebrid · Premium until " + time.Unix(data.User.PremiumUntil, 0).UTC().Format("2006-01-02"), nil
	}

	return "AllDebrid · Premium", nil
}

func (c *Client) Add(ctx context.Context, magnetLink string, torrentFile []byte, _ string) (string, error) {
	type added struct {
		ID    int64      `json:"id"`
		Error *itemError `json:"error"`
	}

	var items []added

	if magnetLink != "" {
		var data struct {
			Magnets []added `json:"magnets"`
		}
		if err := c.call(ctx, http.MethodPost, "magnet/upload", url.Values{"magnets[]": {magnetLink}}, nil, "", &data); err != nil {
			return "", err
		}
		items = data.Magnets
	} else {
		var buf bytes.Buffer
		form := multipart.NewWriter(&buf)
		part, err := form.CreateFormFile("files[]", "download.torrent")
		if err != nil {
			return "", apperr.Wrap(err, apperr.KindInternal, "build the request to AllDebrid")
		}
		_, _ = part.Write(torrentFile)
		if err := form.Close(); err != nil {
			return "", apperr.Wrap(err, apperr.KindInternal, "build the request to AllDebrid")
		}

		var data struct {
			Files []added `json:"files"`
		}
		if err := c.call(ctx, http.MethodPost, "magnet/upload/file", nil, buf.Bytes(), form.FormDataContentType(), &data); err != nil {
			return "", err
		}
		items = data.Files
	}

	if len(items) == 0 {
		return "", apperr.New(apperr.KindUpstream, "AllDebrid did not take the torrent")
	}
	if items[0].Error != nil {
		return "", apperr.New(apperr.KindUpstream, "AllDebrid refused the torrent: %s", items[0].Error.Message)
	}

	return strconv.FormatInt(items[0].ID, 10), nil
}

// Remotes lists the account's magnets. The listing has no files: Detail asks
// for them.
func (c *Client) Remotes(ctx context.Context) ([]debrid.Remote, error) {
	var data struct {
		Magnets []magnet `json:"magnets"`
	}
	if err := c.call(ctx, http.MethodPost, "magnet/status", url.Values{}, nil, "", &data); err != nil {
		return nil, err
	}

	remotes := make([]debrid.Remote, 0, len(data.Magnets))
	for _, m := range data.Magnets {
		remote := debrid.Remote{
			ID:      strconv.FormatInt(m.ID, 10),
			Hash:    strings.ToLower(m.Hash),
			Name:    m.Filename,
			Speed:   m.DownloadSpeed,
			Ready:   m.StatusCode == statusReady,
			Queued:  m.StatusCode == statusQueued,
			Partial: true,
		}
		if m.Size > 0 {
			remote.Progress = float64(m.Downloaded) / float64(m.Size)
		}
		if m.StatusCode > statusReady {
			remote.Failed = "AllDebrid: " + m.Status
		}

		remotes = append(remotes, remote)
	}

	return remotes, nil
}

// Detail reads a ready magnet's file tree; until it is ready AllDebrid has none.
func (c *Client) Detail(ctx context.Context, remote debrid.Remote) (debrid.Remote, error) {
	if !remote.Ready {
		return remote, nil
	}

	files, err := c.files(ctx, remote.ID)
	if err != nil {
		return remote, err
	}

	remote.Files = make([]debrid.RemoteFile, 0, len(files))
	for i, f := range files {
		remote.Files = append(remote.Files, debrid.RemoteFile{ID: i, Path: f.path, Size: f.size})
	}

	return remote, nil
}

// Start has nothing to do: AllDebrid downloads every magnet it is given.
func (c *Client) Start(context.Context, debrid.Remote) error {
	return nil
}

func (c *Client) Cached(context.Context, []string) (map[string]bool, error) {
	return nil, debrid.ErrNoCacheCheck
}

func (c *Client) Link(ctx context.Context, remote debrid.Remote, fileID int) (string, error) {
	files, err := c.files(ctx, remote.ID)
	if err != nil {
		return "", err
	}
	if fileID < 0 || fileID >= len(files) {
		return "", apperr.New(apperr.KindUpstream, "AllDebrid has no file %d in the torrent", fileID)
	}

	var data struct {
		Link string `json:"link"`
	}
	if err := c.call(ctx, http.MethodPost, "link/unlock", url.Values{"link": {files[fileID].link}}, nil, "", &data); err != nil {
		return "", err
	}
	if data.Link == "" {
		return "", apperr.New(apperr.KindUpstream, "AllDebrid gave no link for the file")
	}

	return data.Link, nil
}

func (c *Client) Delete(ctx context.Context, remote debrid.Remote) error {
	return c.call(ctx, http.MethodPost, "magnet/delete", url.Values{"id": {remote.ID}}, nil, "", nil)
}

type flatFile struct {
	path string
	size int64
	link string
}

// files is a magnet's file tree flattened, sorted by path, so a file's place in
// it is a stable ID.
func (c *Client) files(ctx context.Context, id string) ([]flatFile, error) {
	var data struct {
		Magnets []struct {
			Files []node     `json:"files"`
			Error *itemError `json:"error"`
		} `json:"magnets"`
	}
	if err := c.call(ctx, http.MethodPost, "magnet/files", url.Values{"id[]": {id}}, nil, "", &data); err != nil {
		return nil, err
	}
	if len(data.Magnets) == 0 {
		return nil, apperr.New(apperr.KindUpstream, "AllDebrid has no files for the torrent")
	}
	if data.Magnets[0].Error != nil {
		return nil, apperr.New(apperr.KindUpstream, "AllDebrid: %s", data.Magnets[0].Error.Message)
	}

	var out []flatFile
	flatten(data.Magnets[0].Files, "", &out)
	sort.Slice(out, func(i, j int) bool { return out[i].path < out[j].path })

	return out, nil
}

func flatten(nodes []node, prefix string, out *[]flatFile) {
	for _, n := range nodes {
		p := n.Name
		if prefix != "" {
			p = prefix + "/" + n.Name
		}

		if n.Link != "" {
			*out = append(*out, flatFile{path: p, size: n.Size, link: n.Link})
		}
		if len(n.Entries) > 0 {
			flatten(n.Entries, p, out)
		}
	}
}

// call sends form as a urlencoded body for POST, or body as is with its type.
// AllDebrid answers 200 with a status field, so the status is what counts.
func (c *Client) call(ctx context.Context, method, endpoint string, form url.Values, body []byte, contentType string, out any) error {
	if c.key == nil {
		return apperr.New(apperr.KindPrecondition, "add an AllDebrid API key in the torrent settings first")
	}
	key, err := c.key()
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "read the AllDebrid API key")
	}
	if key == "" {
		return apperr.New(apperr.KindPrecondition, "add an AllDebrid API key in the torrent settings first")
	}

	query := url.Values{"agent": {agent}}
	var reader io.Reader = http.NoBody

	switch {
	case method == http.MethodGet:
		for k, v := range form {
			query[k] = v
		}
	case form != nil:
		reader = strings.NewReader(form.Encode())
		contentType = "application/x-www-form-urlencoded"
	case body != nil:
		reader = bytes.NewReader(body)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.base+"/"+endpoint+"?"+query.Encode(), reader)
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "build the request to AllDebrid")
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
		return apperr.Wrap(err, apperr.KindUnavailable, "AllDebrid cannot be reached")
	}
	defer func() { _ = resp.Body.Close() }()

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes+1))
	if err != nil {
		return apperr.Wrap(err, apperr.KindUnavailable, "read AllDebrid's answer")
	}
	if len(data) > maxResponseBytes {
		return apperr.New(apperr.KindUpstream, "AllDebrid's answer to %s is too large", endpoint)
	}

	var env struct {
		Status string          `json:"status"`
		Data   json.RawMessage `json:"data"`
		Error  *itemError      `json:"error"`
	}
	if err := json.Unmarshal(data, &env); err != nil {
		if resp.StatusCode >= 400 {
			return apperr.New(apperr.KindUpstream, "AllDebrid answered %s with HTTP %d", endpoint, resp.StatusCode)
		}
		return apperr.Wrap(err, apperr.KindUpstream, "AllDebrid's answer to %s cannot be read", endpoint)
	}

	if env.Status != "success" {
		if env.Error != nil && strings.HasPrefix(env.Error.Code, "AUTH_") {
			return apperr.New(apperr.KindUpstream, "AllDebrid did not accept the API key: copy it again from alldebrid.com/apikeys")
		}
		message := "unknown error"
		if env.Error != nil && env.Error.Message != "" {
			message = env.Error.Message
		}
		return apperr.New(apperr.KindUpstream, "AllDebrid refused %s: %s", endpoint, message)
	}

	if out == nil || len(env.Data) == 0 || string(env.Data) == "null" {
		return nil
	}

	if err := json.Unmarshal(env.Data, out); err != nil {
		return apperr.Wrap(err, apperr.KindUpstream, "AllDebrid's answer to %s cannot be read", endpoint)
	}

	return nil
}
