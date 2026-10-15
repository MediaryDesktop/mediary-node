// Package debrid turns a debrid service into a torrent client the module can
// use: the service downloads the torrent on its own servers, and the node fetches
// the chosen files from it over HTTPS into the library folder. It answers the
// same calls as the qBittorrent adapter, so following, importing, choosing files
// and the rules do not know which client they talk to.
package debrid

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/qbittorrent"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// Provider is one debrid service, as much of it as the node needs.
type Provider interface {
	// Account checks the key and names the account for the settings, e.g.
	// "TorBox · Free plan".
	Account(ctx context.Context) (string, error)
	// Add gives the service a torrent and returns the ID it is known by.
	Add(ctx context.Context, magnet string, torrent []byte, name string) (string, error)
	// Remotes lists the account's torrents, the queued ones included.
	Remotes(ctx context.Context) ([]Remote, error)
	// Detail fills in the files of a remote listed as Partial.
	Detail(ctx context.Context, remote Remote) (Remote, error)
	// Start lets a remote listed as Waiting download; every file, since a
	// service like Real-Debrid downloads a cached torrent again for a subset.
	Start(ctx context.Context, remote Remote) error
	// Cached reports which of the hashes, lower-case hex, the service already
	// holds; ErrNoCacheCheck when it cannot tell.
	Cached(ctx context.Context, hashes []string) (map[string]bool, error)
	// Link is a short-lived address to download one file from.
	Link(ctx context.Context, remote Remote, fileID int) (string, error)
	Delete(ctx context.Context, remote Remote) error
}

// ErrNoCacheCheck is a service's answer to Cached when it has no way to say
// what it holds; Real-Debrid and AllDebrid took theirs away.
var ErrNoCacheCheck = errors.New("the service cannot say what it holds")

// Remote is a torrent as the service reports it.
type Remote struct {
	ID string
	// Hash is the v1 info hash in lower-case hex; empty from a service that does
	// not say it, and then the adapter matches the ID it was added under.
	Hash string
	Name string
	// Queued waits for a free slot on the account.
	Queued bool
	// Waiting waits for Start.
	Waiting bool
	// Ready means the service holds the files and links can be asked for.
	Ready    bool
	Progress float64
	// Speed is the service's own download speed, bytes per second.
	Speed int64
	// Failed says why the service gave up on the torrent; "" while it has not.
	Failed string
	// Partial means the listing left the files out; Detail fills them in.
	Partial bool
	Files   []RemoteFile
}

type RemoteFile struct {
	ID int
	// Path is relative to the torrent, folder included, with forward slashes.
	Path string
	Size int64
}

// qBittorrent's "infinite" ETA, which the module reads as unknown.
const unknownETA = 8640000

const (
	// A listing is reused for this long, so one poll asking about torrents and
	// then their files makes one call to the service.
	listTTL = 3 * time.Second
	// A torrent just added may not be listed yet; until then it is not missing.
	addGrace = 2 * time.Minute
	// After a failed fetch the file is tried again after this long.
	retryAfter = 30 * time.Second
	// A torrent still waiting after Start is started again after this long.
	startEvery = 30 * time.Second
	// With nothing to fetch, the service is asked again this often anyway: a
	// torrent it was downloading may have become ready.
	idleWake = 15 * time.Second
)

type Options struct {
	// Name is the service's name in messages, e.g. TorBox.
	Name     string
	Provider Provider
	// StateDir keeps the adapter's list of torrents, so a restarted node resumes
	// their files.
	StateDir string
	// HTTP fetches the files; it has no overall timeout, as a file may take hours.
	HTTP   *http.Client
	Logger zerolog.Logger
}

// entry is what the adapter remembers about one torrent across restarts.
type entry struct {
	SavePath string `json:"save_path"`
	Name     string `json:"name,omitempty"`
	Stopped  bool   `json:"stopped"`
	// Skipped are the IDs of the files not to fetch.
	Skipped []int `json:"skipped,omitempty"`
	// Written are the files the adapter fetched into SavePath, so a removal with
	// files deletes exactly those.
	Written []string `json:"written,omitempty"`
	// RemoteID is the ID the service gave the torrent, for a service whose
	// listing does not say the hash.
	RemoteID string    `json:"remote_id,omitempty"`
	AddedAt  time.Time `json:"added_at"`
}

type sample struct {
	bytes int64
	at    time.Time
}

type Client struct {
	opts Options

	mu       sync.Mutex
	loaded   bool
	entries  map[string]*entry
	remotes  map[string]Remote
	listedAt time.Time
	listErr  error
	// Bytes on disk of the file being fetched, and which one it is.
	active     string
	activeFile int
	activeDone int64
	cancel     context.CancelFunc
	// When a torrent's last fetch failed, so it is not tried again at once.
	failedAt map[string]time.Time
	// When a waiting torrent was last started, and the files of ready torrents
	// from a service whose listing leaves them out.
	startedAt map[string]time.Time
	details   map[string]Remote
	samples   map[string]sample
	speeds    map[string]int64

	wake    chan struct{}
	started bool
	// The fetch loop outlives any one request, so it runs under the client's own
	// context, ended by Close.
	runCtx  context.Context //nolint:containedctx // the loop's lifetime is the client's
	stop    context.CancelFunc
	stopped chan struct{}
}

func New(opts Options) *Client {
	if opts.HTTP == nil {
		opts.HTTP = &http.Client{Transport: &http.Transport{
			Proxy:                 http.ProxyFromEnvironment,
			ResponseHeaderTimeout: 60 * time.Second,
			IdleConnTimeout:       90 * time.Second,
		}}
	}

	runCtx, stop := context.WithCancel(context.Background())

	return &Client{
		opts:      opts,
		entries:   map[string]*entry{},
		remotes:   map[string]Remote{},
		failedAt:  map[string]time.Time{},
		startedAt: map[string]time.Time{},
		details:   map[string]Remote{},
		samples:   map[string]sample{},
		speeds:    map[string]int64{},
		wake:      make(chan struct{}, 1),
		runCtx:    runCtx,
		stop:      stop,
		stopped:   make(chan struct{}),
	}
}

// start loads the remembered torrents and starts fetching, on first use: a node
// whose user never picked the service never touches its folder.
func (c *Client) start() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.loaded {
		if err := os.MkdirAll(c.opts.StateDir, 0o700); err != nil {
			return apperr.Wrap(err, apperr.KindInternal, "create the %s client's folder", c.opts.Name)
		}
		if err := c.load(); err != nil {
			c.opts.Logger.Warn().Err(err).Msg("could not read the debrid client's list")
		}
		c.loaded = true
	}

	if !c.started && c.runCtx.Err() == nil {
		c.started = true
		go c.run(c.runCtx)
	}

	return nil
}

// Close stops fetching; the files resume on the next start.
func (c *Client) Close() {
	c.stop()

	c.mu.Lock()
	started := c.started
	c.mu.Unlock()

	if started {
		<-c.stopped
	}
}

func (c *Client) signal() {
	select {
	case c.wake <- struct{}{}:
	default:
	}
}

func (c *Client) Version(ctx context.Context) (string, error) {
	return c.opts.Provider.Account(ctx)
}

// Service names the debrid service, for marks like "cached in TorBox".
func (c *Client) Service() string {
	return c.opts.Name
}

// Cached reports which of the hashes the service already holds; nil, with no
// error, from a service that cannot tell, so nothing is marked either way.
func (c *Client) Cached(ctx context.Context, hashes []string) (map[string]bool, error) {
	if len(hashes) == 0 {
		return map[string]bool{}, nil
	}

	cached, err := c.opts.Provider.Cached(ctx, hashes)
	if errors.Is(err, ErrNoCacheCheck) {
		return nil, nil
	}

	return cached, err
}

func (c *Client) Add(ctx context.Context, req qbittorrent.AddRequest) error {
	if err := c.start(); err != nil {
		return err
	}

	hash, name, err := identify(req)
	if err != nil {
		return err
	}

	remotes, err := c.listing(ctx, true)
	if err != nil {
		return err
	}

	// The account may hold it already — added on the service's site, or by a
	// node that lost its list. Adding it again would only fail.
	var remoteID string
	if existing, ok := remotes[hash]; ok {
		remoteID = existing.ID
	} else if remoteID, err = c.opts.Provider.Add(ctx, req.Magnet, req.Torrent, name); err != nil {
		return err
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if _, ok := c.entries[hash]; !ok {
		c.entries[hash] = &entry{
			SavePath: req.SavePath,
			Name:     name,
			Stopped:  req.Hold,
			RemoteID: remoteID,
			AddedAt:  time.Now().UTC(),
		}
	}
	c.listedAt = time.Time{}

	if err := c.saveLocked(); err != nil {
		return err
	}

	c.signal()

	return nil
}

func (c *Client) Torrents(ctx context.Context, hashes []string) ([]qbittorrent.Torrent, error) {
	if err := c.start(); err != nil {
		return nil, err
	}

	remotes, err := c.listing(ctx, false)
	if err != nil {
		return nil, err
	}

	c.signal()

	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()
	var out []qbittorrent.Torrent

	for _, hash := range hashes {
		saved, ok := c.entries[hash]
		if !ok {
			continue
		}

		remote, listed := remotes[hash]
		if !listed {
			if now.Sub(saved.AddedAt) < addGrace {
				out = append(out, qbittorrent.Torrent{Hash: hash, Name: saved.Name, State: "metaDL", SavePath: saved.SavePath, ETA: unknownETA})
			}
			continue
		}

		out = append(out, c.status(hash, saved, remote, now))
	}

	return out, nil
}

// status describes a torrent the way qBittorrent would, so the module reads every
// client alike. Its progress is the files on the node's disk: until the service
// has them, the torrent is queued, not downloading. Called with mu held.
func (c *Client) status(hash string, saved *entry, remote Remote, now time.Time) qbittorrent.Torrent {
	status := qbittorrent.Torrent{Hash: hash, Name: remote.Name, SavePath: saved.SavePath, ETA: unknownETA}
	if status.Name == "" {
		status.Name = saved.Name
	}

	if !remote.Ready || remote.Failed != "" {
		status.Remote = &qbittorrent.Remote{
			Service:  c.opts.Name,
			Progress: min(max(remote.Progress, 0), 1),
			Speed:    max(remote.Speed, 0),
			Queued:   remote.Queued,
			Error:    remote.Failed,
		}
	}

	switch {
	case remote.Failed != "":
		status.State = "error"
		return status
	case remote.Queued:
		status.State = "queuedDL"
		return status
	case !remote.Ready && len(remote.Files) == 0:
		status.State = "metaDL"
		return status
	}

	var wanted, done int64
	for _, file := range c.wanted(saved, remote) {
		wanted += file.Size
		done += c.onDisk(hash, saved, file)
	}

	status.Size = wanted
	status.AmountLeft = wanted - done
	if wanted > 0 {
		status.Progress = float64(done) / float64(wanted)
	}

	speed := c.speed(hash, done, now)
	status.DLSpeed = speed

	complete := wanted > 0 && done >= wanted

	switch {
	case saved.Stopped && complete:
		status.State = "stoppedUP"
	case saved.Stopped:
		status.State = "stoppedDL"
	case complete:
		status.State = "stalledUP"
	case !remote.Ready:
		// The service is still downloading it itself.
		status.State = "queuedDL"
	case c.active == hash:
		status.State = "downloading"
	default:
		status.State = "stalledDL"
	}

	if !complete && speed > 0 {
		status.ETA = status.AmountLeft / speed
	}

	return status
}

// speed is bytes per second since the torrent was last asked about. Called with
// mu held.
func (c *Client) speed(hash string, done int64, now time.Time) int64 {
	previous, ok := c.samples[hash]
	if !ok {
		c.samples[hash] = sample{bytes: done, at: now}
		return 0
	}

	if elapsed := now.Sub(previous.at).Seconds(); elapsed >= 0.5 {
		c.speeds[hash] = max(int64(float64(done-previous.bytes)/elapsed), 0)
		c.samples[hash] = sample{bytes: done, at: now}
	}

	return c.speeds[hash]
}

func (c *Client) Files(ctx context.Context, hash string) ([]qbittorrent.File, error) {
	if err := c.start(); err != nil {
		return nil, err
	}

	remotes, err := c.listing(ctx, false)
	if err != nil {
		return nil, err
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	saved, ok := c.entries[hash]
	if !ok {
		return nil, apperr.New(apperr.KindNotFound, "the torrent is not in %s", c.opts.Name)
	}

	remote, ok := remotes[hash]
	if !ok {
		return nil, nil
	}

	skipped := skipSet(saved)
	files := make([]qbittorrent.File, 0, len(remote.Files))

	for _, file := range usable(remote.Files) {
		out := qbittorrent.File{Index: file.ID, Name: file.Path, Size: file.Size, Priority: qbittorrent.PriorityNormal}
		if file.Size > 0 {
			out.Progress = min(float64(c.onDisk(hash, saved, file))/float64(file.Size), 1)
		}
		if skipped[file.ID] {
			out.Priority = qbittorrent.PrioritySkip
		}
		files = append(files, out)
	}

	return files, nil
}

func (c *Client) SetFilePriority(_ context.Context, hash string, indices []int, priority int) error {
	return c.change(hash, func(saved *entry) {
		skipped := skipSet(saved)
		for _, index := range indices {
			skipped[index] = priority == qbittorrent.PrioritySkip
		}

		saved.Skipped = saved.Skipped[:0]
		for index, skip := range skipped {
			if skip {
				saved.Skipped = append(saved.Skipped, index)
			}
		}
		slices.Sort(saved.Skipped)
	})
}

func (c *Client) Pause(_ context.Context, hash string) error {
	return c.change(hash, func(saved *entry) { saved.Stopped = true })
}

func (c *Client) Resume(_ context.Context, hash string) error {
	return c.change(hash, func(saved *entry) { saved.Stopped = false })
}

// change edits a torrent's entry and keeps it. A fetch the edit no longer wants
// — the torrent paused, the file skipped — stops; its part file stays for later.
func (c *Client) change(hash string, edit func(*entry)) error {
	if err := c.start(); err != nil {
		return err
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	saved, ok := c.entries[hash]
	if !ok {
		return apperr.New(apperr.KindNotFound, "the torrent is not in %s", c.opts.Name)
	}

	edit(saved)

	if c.active == hash && c.cancel != nil && (saved.Stopped || skipSet(saved)[c.activeFile]) {
		c.cancel()
	}

	if err := c.saveLocked(); err != nil {
		return err
	}

	c.signal()

	return nil
}

// Delete takes the torrent off the account and off the adapter's list. With
// files, it deletes the files it fetched and the folders they leave empty, and
// nothing else in the library folder.
func (c *Client) Delete(ctx context.Context, hash string, withFiles bool) error {
	if err := c.start(); err != nil {
		return err
	}

	c.mu.Lock()
	saved, ok := c.entries[hash]
	if ok && c.active == hash && c.cancel != nil {
		c.cancel()
	}
	c.mu.Unlock()

	if !ok {
		return nil
	}

	remotes, err := c.listing(ctx, true)
	if err != nil {
		return err
	}
	if remote, listed := remotes[hash]; listed {
		if deleteErr := c.opts.Provider.Delete(ctx, remote); deleteErr != nil {
			return deleteErr
		}
	}

	c.mu.Lock()
	delete(c.entries, hash)
	delete(c.remotes, hash)
	delete(c.samples, hash)
	delete(c.speeds, hash)
	delete(c.failedAt, hash)
	delete(c.startedAt, hash)
	delete(c.details, hash)
	err = c.saveLocked()
	c.mu.Unlock()

	if withFiles {
		if removeErr := removeWritten(saved.SavePath, saved.Written); removeErr != nil {
			return apperr.Wrap(removeErr, apperr.KindInternal, "delete the downloaded files")
		}
	}

	return err
}

// listing is the service's torrents by hash, asked again once the last answer is
// older than listTTL, or always when fresh.
func (c *Client) listing(ctx context.Context, fresh bool) (map[string]Remote, error) {
	c.mu.Lock()
	if !fresh && time.Since(c.listedAt) < listTTL {
		remotes, err := c.remotes, c.listErr
		c.mu.Unlock()
		return remotes, err
	}
	c.mu.Unlock()

	list, err := c.opts.Provider.Remotes(ctx)
	if err != nil {
		c.mu.Lock()
		c.listedAt, c.listErr = time.Now(), err
		c.mu.Unlock()
		return nil, err
	}

	c.mu.Lock()
	hashOfID := make(map[string]string, len(c.entries))
	for hash, saved := range c.entries {
		if saved.RemoteID != "" {
			hashOfID[saved.RemoteID] = hash
		}
	}
	c.mu.Unlock()

	remotes := make(map[string]Remote, len(list))
	for _, remote := range list {
		remote.Hash = strings.ToLower(remote.Hash)
		if remote.Hash == "" {
			remote.Hash = hashOfID[remote.ID]
		}
		if remote.Hash == "" {
			continue
		}
		if existing, ok := remotes[remote.Hash]; ok && !existing.Queued {
			continue
		}
		remotes[remote.Hash] = remote
	}

	c.prepare(ctx, remotes)

	c.mu.Lock()
	defer c.mu.Unlock()

	c.listedAt, c.listErr = time.Now(), nil
	c.remotes = remotes

	return remotes, nil
}

// prepare does what the service needs before the adapter's own torrents can be
// followed: starts the ones waiting for it, and fills in the files a listing left
// out. A ready torrent's files do not change, so they are asked once.
func (c *Client) prepare(ctx context.Context, remotes map[string]Remote) {
	for hash, remote := range remotes {
		c.mu.Lock()
		_, ours := c.entries[hash]
		known, detailed := c.details[hash]
		startedAt := c.startedAt[hash]
		c.mu.Unlock()

		if !ours {
			continue
		}

		if remote.Waiting && time.Since(startedAt) >= startEvery {
			if err := c.opts.Provider.Start(ctx, remote); err != nil {
				c.opts.Logger.Warn().Err(err).Str("hash", hash).Msg("start a torrent on the debrid service")
			}
			c.mu.Lock()
			c.startedAt[hash] = time.Now()
			c.mu.Unlock()
		}

		if !remote.Partial {
			continue
		}

		if detailed && remote.Ready && known.ID == remote.ID {
			remote.Files = known.Files
			remotes[hash] = remote
			continue
		}

		full, err := c.opts.Provider.Detail(ctx, remote)
		if err != nil {
			c.opts.Logger.Debug().Err(err).Str("hash", hash).Msg("read a torrent's files on the debrid service")
			continue
		}
		full.Hash, full.Partial = hash, false
		remotes[hash] = full

		if full.Ready {
			c.mu.Lock()
			c.details[hash] = full
			c.mu.Unlock()
		}
	}
}

// wanted are the torrent's files to fetch: every usable one but the skipped.
// Called with mu held.
func (c *Client) wanted(saved *entry, remote Remote) []RemoteFile {
	skipped := skipSet(saved)

	var out []RemoteFile
	for _, file := range usable(remote.Files) {
		if !skipped[file.ID] {
			out = append(out, file)
		}
	}

	return out
}

// onDisk is how many bytes of a file the node has: all of them once it is in
// place, the part file's size while it is being fetched. Called with mu held.
func (c *Client) onDisk(hash string, saved *entry, file RemoteFile) int64 {
	if c.active == hash && c.activeFile == file.ID {
		return min(c.activeDone, file.Size)
	}

	target := filepath.Join(saved.SavePath, filepath.FromSlash(file.Path))
	if info, err := os.Stat(target); err == nil && info.Size() == file.Size {
		return file.Size
	}
	if info, err := os.Stat(target + ".part"); err == nil {
		return min(info.Size(), file.Size)
	}

	return 0
}

func skipSet(saved *entry) map[int]bool {
	skipped := make(map[int]bool, len(saved.Skipped))
	for _, index := range saved.Skipped {
		skipped[index] = true
	}

	return skipped
}

// usable are the files whose path the node may write: relative, inside the
// torrent's folder. The path comes from the service, and a "../" in it would
// otherwise land outside the library.
func usable(files []RemoteFile) []RemoteFile {
	out := make([]RemoteFile, 0, len(files))
	for _, file := range files {
		if safePath(file.Path) {
			out = append(out, file)
		}
	}
	slices.SortFunc(out, func(a, b RemoteFile) int { return a.ID - b.ID })

	return out
}

func safePath(p string) bool {
	if p == "" || strings.ContainsAny(p, `\:`) || strings.HasPrefix(p, "/") || strings.ContainsRune(p, 0) {
		return false
	}

	for _, part := range strings.Split(p, "/") {
		if part == "" || part == "." || part == ".." {
			return false
		}
	}

	return path.Clean(p) == p
}

// removeWritten deletes the files the adapter fetched, their part files, and the
// folders that are left empty, never climbing above the save folder. Windows
// keeps a file locked for a moment after a cancelled fetch, so it tries again
// briefly.
func removeWritten(savePath string, written []string) error {
	base := filepath.Clean(savePath)
	var firstErr error

	for _, rel := range written {
		if !safePath(rel) {
			continue
		}

		target := filepath.Join(base, filepath.FromSlash(rel))
		for _, name := range []string{target, target + ".part"} {
			if err := removeRetrying(name); err != nil && firstErr == nil {
				firstErr = err
			}
		}

		for dir := filepath.Dir(target); dir != base && strings.HasPrefix(dir, base+string(filepath.Separator)); dir = filepath.Dir(dir) {
			if os.Remove(dir) != nil {
				break
			}
		}
	}

	return firstErr
}

func removeRetrying(name string) error {
	var err error
	for attempt := 0; attempt < 20; attempt++ {
		err = os.Remove(name)
		if err == nil || errors.Is(err, fs.ErrNotExist) {
			return nil
		}
		time.Sleep(150 * time.Millisecond)
	}

	return err
}

func (c *Client) statePath() string {
	return filepath.Join(c.opts.StateDir, "state.json")
}

// load reads the remembered torrents. Called with mu held.
func (c *Client) load() error {
	data, err := os.ReadFile(c.statePath())
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}

	entries := map[string]*entry{}
	if err := json.Unmarshal(data, &entries); err != nil {
		return fmt.Errorf("read %s: %w", c.statePath(), err)
	}

	c.entries = entries

	return nil
}

// saveLocked writes the remembered torrents, replacing the file whole so a crash
// mid-write never leaves half a list. Called with mu held.
func (c *Client) saveLocked() error {
	data, err := json.MarshalIndent(c.entries, "", "  ")
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "encode the %s client's list", c.opts.Name)
	}

	tmp := c.statePath() + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "save the %s client's list", c.opts.Name)
	}

	if err := os.Rename(tmp, c.statePath()); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "save the %s client's list", c.opts.Name)
	}

	return nil
}
