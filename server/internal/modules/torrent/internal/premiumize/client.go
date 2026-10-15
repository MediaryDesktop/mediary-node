// Package premiumize talks to Premiumize.me through its API with the user's own
// key, as a debrid.Provider.
package premiumize

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/debrid"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/metainfo"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

const DefaultBaseURL = "https://www.premiumize.me/api"

const maxResponseBytes = 16 << 20

// The most magnets one cache check asks about.
const cacheBatch = 100

// How deep a transfer's folders are followed; a torrent is never this nested.
const maxFolderDepth = 8

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

type transfer struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Status   string  `json:"status"`
	Progress float64 `json:"progress"`
	Message  string  `json:"message"`
	FolderID string  `json:"folder_id"`
	FileID   string  `json:"file_id"`
	Src      string  `json:"src"`
}

type item struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
	Size int64  `json:"size"`
	Link string `json:"link"`
}

func (c *Client) Account(ctx context.Context) (string, error) {
	var info struct {
		PremiumUntil int64 `json:"premium_until"`
	}
	if err := c.call(ctx, http.MethodGet, "account/info", nil, &info); err != nil {
		return "", err
	}

	if info.PremiumUntil <= 0 {
		return "", apperr.New(apperr.KindPrecondition, "this Premiumize account has no premium: Premiumize downloads torrents only for premium accounts")
	}

	return "Premiumize · Premium until " + time.Unix(info.PremiumUntil, 0).UTC().Format("2006-01-02"), nil
}

// Add creates a transfer. A .torrent file is sent as the magnet of its hash:
// Premiumize takes a source address, and finds the peers itself.
func (c *Client) Add(ctx context.Context, magnet string, torrentFile []byte, name string) (string, error) {
	src := magnet
	if src == "" {
		info, err := metainfo.FromTorrent(torrentFile)
		if err != nil {
			return "", err
		}
		src = "magnet:?xt=urn:btih:" + info.InfoHash
		if dn := firstNonEmpty(info.Name, name); dn != "" {
			src += "&dn=" + url.QueryEscape(dn)
		}
	}

	var created struct {
		ID string `json:"id"`
	}
	if err := c.call(ctx, http.MethodPost, "transfer/create", url.Values{"src": {src}}, &created); err != nil {
		return "", err
	}
	if created.ID == "" {
		return "", apperr.New(apperr.KindUpstream, "Premiumize gave no ID for the transfer")
	}

	return created.ID, nil
}

// Remotes lists the transfers. Premiumize does not say a transfer's hash, so it
// is read from the magnet the transfer came from when that is there; otherwise
// the adapter knows the transfer by the ID Add returned.
func (c *Client) Remotes(ctx context.Context) ([]debrid.Remote, error) {
	var data struct {
		Transfers []transfer `json:"transfers"`
	}
	if err := c.call(ctx, http.MethodGet, "transfer/list", nil, &data); err != nil {
		return nil, err
	}

	remotes := make([]debrid.Remote, 0, len(data.Transfers))
	for i := range data.Transfers {
		remotes = append(remotes, remoteOf(&data.Transfers[i]))
	}

	return remotes, nil
}

func remoteOf(t *transfer) debrid.Remote {
	remote := debrid.Remote{
		ID:       t.ID,
		Name:     t.Name,
		Progress: t.Progress,
		Ready:    t.Status == "finished" || t.Status == "seeding",
		Queued:   t.Status == "queued",
		Partial:  true,
	}
	if remote.Ready {
		remote.Progress = 1
	}
	if strings.HasPrefix(t.Src, "magnet:") {
		if info, err := metainfo.FromMagnet(t.Src); err == nil {
			remote.Hash = info.InfoHash
		}
	}
	if t.Status == "error" || t.Status == "deleted" || t.Status == "banned" {
		remote.Failed = "Premiumize: " + firstNonEmpty(t.Message, t.Status)
	}

	return remote
}

// Detail reads a finished transfer's files from the folder or file it left.
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

// Start has nothing to do: Premiumize downloads every transfer it is given.
func (c *Client) Start(context.Context, debrid.Remote) error {
	return nil
}

func (c *Client) Cached(ctx context.Context, hashes []string) (map[string]bool, error) {
	cached := make(map[string]bool, len(hashes))

	for start := 0; start < len(hashes); start += cacheBatch {
		batch := hashes[start:min(start+cacheBatch, len(hashes))]

		form := url.Values{}
		for _, hash := range batch {
			form.Add("items[]", "magnet:?xt=urn:btih:"+hash)
		}

		var data struct {
			Response []bool `json:"response"`
		}
		if err := c.call(ctx, http.MethodPost, "cache/check", form, &data); err != nil {
			return nil, err
		}

		for i, hash := range batch {
			if i < len(data.Response) && data.Response[i] {
				cached[hash] = true
			}
		}
	}

	return cached, nil
}

// Link is the file's own address: Premiumize gives direct links.
func (c *Client) Link(ctx context.Context, remote debrid.Remote, fileID int) (string, error) {
	files, err := c.files(ctx, remote.ID)
	if err != nil {
		return "", err
	}
	if fileID < 0 || fileID >= len(files) || files[fileID].link == "" {
		return "", apperr.New(apperr.KindUpstream, "Premiumize has no link for file %d", fileID)
	}

	return files[fileID].link, nil
}

// Delete removes the transfer. Its files stay in the user's Premiumize cloud,
// which is theirs to tidy.
func (c *Client) Delete(ctx context.Context, remote debrid.Remote) error {
	return c.call(ctx, http.MethodPost, "transfer/delete", url.Values{"id": {remote.ID}}, nil)
}

type flatFile struct {
	path string
	size int64
	link string
}

// files is a finished transfer's files, sorted by path so a file's place is a
// stable ID, under the transfer's name as their folder.
func (c *Client) files(ctx context.Context, transferID string) ([]flatFile, error) {
	var data struct {
		Transfers []transfer `json:"transfers"`
	}
	if err := c.call(ctx, http.MethodGet, "transfer/list", nil, &data); err != nil {
		return nil, err
	}

	var t *transfer
	for i := range data.Transfers {
		if data.Transfers[i].ID == transferID {
			t = &data.Transfers[i]
			break
		}
	}
	if t == nil {
		return nil, apperr.New(apperr.KindNotFound, "the transfer is no longer in Premiumize")
	}

	var out []flatFile

	switch {
	case t.FolderID != "":
		if err := c.walk(ctx, t.FolderID, cleanName(t.Name), 0, &out); err != nil {
			return nil, err
		}
	case t.FileID != "":
		var file item
		if err := c.call(ctx, http.MethodGet, "item/details", url.Values{"id": {t.FileID}}, &file); err != nil {
			return nil, err
		}
		out = append(out, flatFile{path: cleanName(file.Name), size: file.Size, link: file.Link})
	}

	sort.Slice(out, func(i, j int) bool { return out[i].path < out[j].path })

	return out, nil
}

func (c *Client) walk(ctx context.Context, folderID, prefix string, depth int, out *[]flatFile) error {
	if depth >= maxFolderDepth {
		return nil
	}

	var data struct {
		Content []item `json:"content"`
	}
	if err := c.call(ctx, http.MethodGet, "folder/list", url.Values{"id": {folderID}}, &data); err != nil {
		return err
	}

	for _, entry := range data.Content {
		p := cleanName(entry.Name)
		if prefix != "" {
			p = prefix + "/" + p
		}

		switch entry.Type {
		case "folder":
			if err := c.walk(ctx, entry.ID, p, depth+1, out); err != nil {
				return err
			}
		case "file":
			*out = append(*out, flatFile{path: p, size: entry.Size, link: entry.Link})
		}
	}

	return nil
}

// cleanName keeps a name from Premiumize one path element: a slash in it would
// otherwise make a folder the torrent never had.
func cleanName(name string) string {
	return strings.NewReplacer("/", "_", `\`, "_").Replace(strings.TrimSpace(name))
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}

	return ""
}

// call sends params as the query for GET and as a urlencoded body otherwise.
// Premiumize answers 200 with a status field, so the status is what counts.
func (c *Client) call(ctx context.Context, method, endpoint string, params url.Values, out any) error {
	if c.key == nil {
		return apperr.New(apperr.KindPrecondition, "add a Premiumize API key in the torrent settings first")
	}
	key, err := c.key()
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "read the Premiumize API key")
	}
	if key == "" {
		return apperr.New(apperr.KindPrecondition, "add a Premiumize API key in the torrent settings first")
	}

	target := c.base + "/" + endpoint
	var reader io.Reader = http.NoBody
	if method == http.MethodGet {
		if len(params) > 0 {
			target += "?" + params.Encode()
		}
	} else {
		reader = strings.NewReader(params.Encode())
	}

	req, err := http.NewRequestWithContext(ctx, method, target, reader)
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "build the request to Premiumize")
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Accept", "application/json")
	if method != http.MethodGet {
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
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
		return apperr.Wrap(err, apperr.KindUnavailable, "Premiumize cannot be reached")
	}
	defer func() { _ = resp.Body.Close() }()

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes+1))
	if err != nil {
		return apperr.Wrap(err, apperr.KindUnavailable, "read Premiumize's answer")
	}
	if len(data) > maxResponseBytes {
		return apperr.New(apperr.KindUpstream, "Premiumize's answer to %s is too large", endpoint)
	}

	var status struct {
		Status  string `json:"status"`
		Message string `json:"message"`
		Code    string `json:"code"`
	}
	if err := json.Unmarshal(data, &status); err != nil {
		if resp.StatusCode >= 400 {
			return apperr.New(apperr.KindUpstream, "Premiumize answered %s with HTTP %d", endpoint, resp.StatusCode)
		}
		return apperr.Wrap(err, apperr.KindUpstream, "Premiumize's answer to %s cannot be read", endpoint)
	}

	if status.Status != "success" {
		if status.Code == "authentication_failed" || resp.StatusCode == http.StatusUnauthorized {
			return apperr.New(apperr.KindUpstream, "Premiumize did not accept the API key: copy it again from premiumize.me/account")
		}
		return apperr.New(apperr.KindUpstream, "Premiumize refused %s: %s", endpoint, firstNonEmpty(status.Message, status.Code, "HTTP "+strconv.Itoa(resp.StatusCode)))
	}

	if out == nil {
		return nil
	}

	if err := json.Unmarshal(data, out); err != nil {
		return apperr.Wrap(err, apperr.KindUpstream, "Premiumize's answer to %s cannot be read", endpoint)
	}

	return nil
}
