package debrid

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/metainfo"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/qbittorrent"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

// job is one file to fetch.
type job struct {
	hash     string
	savePath string
	remote   Remote
	file     RemoteFile
}

// run fetches the wanted files one at a time, oldest torrent first, until ctx
// ends. One at a time is deliberate: a free plan allows one active download, and
// a library fills in episode order rather than all at once.
func (c *Client) run(ctx context.Context) {
	defer close(c.stopped)

	for {
		if next, ok := c.next(ctx); ok {
			c.fetchJob(ctx, next)
			continue
		}

		timer := time.NewTimer(idleWake)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-c.wake:
			timer.Stop()
		case <-timer.C:
		}
	}
}

func (c *Client) next(ctx context.Context) (job, bool) {
	if ctx.Err() != nil {
		return job{}, false
	}

	c.mu.Lock()
	empty := len(c.entries) == 0
	c.mu.Unlock()
	if empty {
		return job{}, false
	}

	remotes, err := c.listing(ctx, false)
	if err != nil {
		return job{}, false
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	hashes := make([]string, 0, len(c.entries))
	for hash := range c.entries {
		hashes = append(hashes, hash)
	}
	slices.SortFunc(hashes, func(a, b string) int { return c.entries[a].AddedAt.Compare(c.entries[b].AddedAt) })

	for _, hash := range hashes {
		saved := c.entries[hash]
		if saved.Stopped || time.Since(c.failedAt[hash]) < retryAfter {
			continue
		}

		remote, ok := remotes[hash]
		if !ok || !remote.Ready || remote.Queued || remote.Failed != "" {
			continue
		}

		for _, file := range c.wanted(saved, remote) {
			if c.onDisk(hash, saved, file) < file.Size || file.Size == 0 && !exists(saved, file) {
				return job{hash: hash, savePath: saved.SavePath, remote: remote, file: file}, true
			}
		}
	}

	return job{}, false
}

func exists(saved *entry, file RemoteFile) bool {
	_, err := os.Stat(filepath.Join(saved.SavePath, filepath.FromSlash(file.Path)))
	return err == nil
}

func (c *Client) fetchJob(ctx context.Context, j job) {
	fetchCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	c.mu.Lock()
	c.active, c.activeFile, c.activeDone, c.cancel = j.hash, j.file.ID, 0, cancel
	if saved, ok := c.entries[j.hash]; ok && !slices.Contains(saved.Written, j.file.Path) {
		saved.Written = append(saved.Written, j.file.Path)
		if err := c.saveLocked(); err != nil {
			c.opts.Logger.Warn().Err(err).Msg("save the debrid client's list")
		}
	}
	c.mu.Unlock()

	err := c.fetch(fetchCtx, j)

	c.mu.Lock()
	c.active, c.cancel = "", nil
	switch {
	case err == nil:
		delete(c.failedAt, j.hash)
	case ctx.Err() != nil, errors.Is(err, context.Canceled):
		// Stopped by the user or the node, not failed.
	default:
		c.failedAt[j.hash] = time.Now()
	}
	c.mu.Unlock()

	if err != nil && ctx.Err() == nil && !errors.Is(err, context.Canceled) {
		c.opts.Logger.Warn().Err(err).Str("hash", j.hash).Str("file", j.file.Path).Msg("fetch a file from the debrid service")
	}
}

// fetch downloads one file into place: into a part file first, picking up where
// a previous attempt stopped, then renamed once whole.
func (c *Client) fetch(ctx context.Context, j job) error {
	target := filepath.Join(j.savePath, filepath.FromSlash(j.file.Path))
	part := target + ".part"

	if err := os.MkdirAll(filepath.Dir(target), 0o750); err != nil {
		return fmt.Errorf("create the folder: %w", err)
	}

	var offset int64
	if info, err := os.Stat(part); err == nil {
		offset = info.Size()
	}
	if offset > j.file.Size {
		offset = 0
	}

	link, err := c.opts.Provider.Link(ctx, j.remote, j.file.ID)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, link, http.NoBody)
	if err != nil {
		return fmt.Errorf("build the request for the file: %w", err)
	}
	if offset > 0 {
		req.Header.Set("Range", "bytes="+strconv.FormatInt(offset, 10)+"-")
	}

	resp, err := c.opts.HTTP.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		// The link may carry the account's key; only the reason is kept.
		var urlErr interface{ Unwrap() error }
		if errors.As(err, &urlErr) {
			err = urlErr.Unwrap()
		}
		return fmt.Errorf("%s cannot be reached for the file: %w", c.opts.Name, err)
	}
	defer func() { _ = resp.Body.Close() }()

	flags := os.O_WRONLY | os.O_CREATE

	switch {
	case resp.StatusCode == http.StatusPartialContent && offset > 0 && strings.HasPrefix(resp.Header.Get("Content-Range"), fmt.Sprintf("bytes %d-", offset)):
		flags |= os.O_APPEND
	case resp.StatusCode == http.StatusRequestedRangeNotSatisfiable && offset == j.file.Size:
		return c.place(part, target)
	case resp.StatusCode == http.StatusOK:
		// The server ignored the range, or there was none: start over.
		flags |= os.O_TRUNC
		offset = 0
	default:
		return fmt.Errorf("%s answered %d for the file", c.opts.Name, resp.StatusCode)
	}

	out, err := os.OpenFile(part, flags, 0o644) //nolint:gosec // a library file players read; the path is checked by safePath
	if err != nil {
		return fmt.Errorf("open the part file: %w", err)
	}

	c.setDone(j, offset)
	written, copyErr := io.Copy(out, &counter{r: resp.Body, done: offset, report: func(done int64) { c.setDone(j, done) }})
	closeErr := out.Close()

	if copyErr != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return fmt.Errorf("download the file: %w", copyErr)
	}
	if closeErr != nil {
		return fmt.Errorf("write the file: %w", closeErr)
	}

	if total := offset + written; j.file.Size > 0 && total != j.file.Size {
		return fmt.Errorf("the file ended after %d of %d bytes", total, j.file.Size)
	}

	return c.place(part, target)
}

// place renames a whole part file to its name. Windows will not rename over an
// existing file, so a leftover one goes first.
func (c *Client) place(part, target string) error {
	if _, err := os.Stat(target); err == nil {
		if err := os.Remove(target); err != nil {
			return fmt.Errorf("replace the file: %w", err)
		}
	}

	if err := os.Rename(part, target); err != nil {
		return fmt.Errorf("put the file in place: %w", err)
	}

	c.signal()

	return nil
}

func (c *Client) setDone(j job, done int64) {
	c.mu.Lock()
	if c.active == j.hash && c.activeFile == j.file.ID {
		c.activeDone = done
	}
	c.mu.Unlock()
}

// counter reports how many bytes of the file are on disk as they arrive, at most
// every quarter megabyte.
type counter struct {
	r        io.Reader
	done     int64
	reported int64
	report   func(int64)
}

func (c *counter) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	c.done += int64(n)
	if c.done-c.reported >= 256<<10 || err != nil {
		c.reported = c.done
		c.report(c.done)
	}

	return n, err
}

// identify reads the info hash and the name a torrent is added under.
func identify(req qbittorrent.AddRequest) (hash, name string, err error) {
	var info *metainfo.Info
	if req.Magnet != "" {
		info, err = metainfo.FromMagnet(req.Magnet)
	} else {
		info, err = metainfo.FromTorrent(req.Torrent)
	}
	if err != nil {
		return "", "", err
	}
	if info.InfoHash == "" {
		return "", "", apperr.Invalid("magnet", "the torrent has no BitTorrent v1 hash")
	}

	return info.InfoHash, info.Name, nil
}
