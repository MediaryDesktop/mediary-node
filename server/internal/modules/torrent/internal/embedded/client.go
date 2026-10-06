// Package embedded is the node's own BitTorrent client, for a user without
// qBittorrent. It answers the same calls as the qBittorrent adapter, so the rest
// of the module — following, importing, choosing files, the rules — does not know
// which of the two it talks to.
package embedded

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/anacrolix/torrent"
	"github.com/anacrolix/torrent/metainfo"
	"github.com/anacrolix/torrent/storage"
	"github.com/rs/zerolog"

	// Before the library's storage reads its file IO choice; see the package.
	_ "github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/embedded/classicio"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/qbittorrent"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// Version names the client in the settings.
const Version = "Mediary built-in (anacrolix/torrent v1.61.0)"

// qBittorrent's "infinite" ETA, which the module reads as unknown.
const unknownETA = 8640000

type Options struct {
	// StateDir keeps the client's own list of torrents and their .torrent files,
	// so a restarted node resumes them.
	StateDir string
	// ListenPort is the port peers connect to; 0 keeps the library's default.
	ListenPort int
	// EnableUPnP opens the port on the router. Off unless the user asks.
	EnableUPnP bool
	// Offline keeps the client off DHT and trackers: it only talks to the peers
	// it is handed. For tests.
	Offline bool
	Logger  zerolog.Logger
}

// entry is what the client remembers about one torrent across restarts.
type entry struct {
	Magnet   string `json:"magnet,omitempty"`
	SavePath string `json:"save_path"`
	Stopped  bool   `json:"stopped"`
	// Skipped are the indices of the files not to download.
	Skipped []int     `json:"skipped,omitempty"`
	AddedAt time.Time `json:"added_at"`
}

// sample is a torrent's byte counters at one moment, for the speeds.
type sample struct {
	read, written int64
	at            time.Time
}

type Client struct {
	opts Options

	mu       sync.Mutex
	cl       *torrent.Client
	started  bool
	startErr error
	entries  map[string]*entry
	samples  map[string]sample
	speeds   map[string][2]int64
	// Each torrent's file storage; it holds the files open until closed.
	stores map[string]storage.ClientImplCloser
}

func New(opts Options) *Client {
	return &Client{
		opts:    opts,
		entries: map[string]*entry{},
		samples: map[string]sample{},
		speeds:  map[string][2]int64{},
		stores:  map[string]storage.ClientImplCloser{},
	}
}

// start brings the client up on first use and adds back what it held before.
// A node whose user never picked the built-in client never opens a port.
func (c *Client) start() (*torrent.Client, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.started {
		return c.cl, c.startErr
	}
	c.started = true

	if err := os.MkdirAll(c.opts.StateDir, 0o700); err != nil {
		c.startErr = apperr.Wrap(err, apperr.KindInternal, "create the torrent client's folder")
		return nil, c.startErr
	}

	cfg := torrent.NewDefaultClientConfig()
	cfg.DataDir = filepath.Join(c.opts.StateDir, "data")
	cfg.Seed = true
	cfg.NoDefaultPortForwarding = !c.opts.EnableUPnP
	cfg.Slogger = slog.New(slog.NewTextHandler(discard{}, nil))
	if c.opts.ListenPort > 0 {
		cfg.ListenPort = c.opts.ListenPort
	}
	if c.opts.Offline {
		// Any free port: the peers are handed over, never found.
		cfg.ListenPort = 0
		cfg.DisableUTP = true
		cfg.NoDHT = true
		cfg.DisableTrackers = true
		cfg.DisablePEX = true
	}

	cl, err := torrent.NewClient(cfg)
	if err != nil {
		c.startErr = apperr.Wrap(err, apperr.KindUnavailable, "the built-in torrent client could not start")
		return nil, c.startErr
	}
	c.cl = cl

	if err := c.load(); err != nil {
		c.opts.Logger.Warn().Err(err).Msg("could not read the torrent client's list")
	}

	for hash, saved := range c.entries {
		if err := c.resume(hash, saved); err != nil {
			c.opts.Logger.Warn().Err(err).Str("hash", hash).Msg("could not resume a torrent")
		}
	}

	return cl, nil
}

type discard struct{}

func (discard) Write(p []byte) (int, error) { return len(p), nil }

// resume adds a remembered torrent back, from its saved .torrent when the client
// had the metadata, from its magnet otherwise.
func (c *Client) resume(hash string, saved *entry) error {
	var spec *torrent.TorrentSpec

	if mi, err := metainfo.LoadFromFile(c.metainfoPath(hash)); err == nil {
		if spec, err = torrent.TorrentSpecFromMetaInfoErr(mi); err != nil {
			return err
		}
	} else if saved.Magnet != "" {
		if spec, err = torrent.TorrentSpecFromMagnetUri(saved.Magnet); err != nil {
			return err
		}
	} else {
		return errors.New("neither a .torrent nor a magnet is left for it")
	}

	return c.addSpec(hash, spec, saved)
}

// addSpec hands a torrent to the library with its own folder. Called with mu
// held.
func (c *Client) addSpec(hash string, spec *torrent.TorrentSpec, saved *entry) error {
	store := storage.NewFileOpts(storage.NewFileClientOpts{ClientBaseDir: saved.SavePath})
	spec.Storage = store

	t, _, err := c.cl.AddTorrentSpec(spec)
	if err != nil {
		_ = store.Close()
		return err
	}

	c.stores[hash] = store

	go c.whenInfo(hash, t)

	return nil
}

// whenInfo keeps the metadata once it arrives and sets which files download.
func (c *Client) whenInfo(hash string, t *torrent.Torrent) {
	<-t.GotInfo()

	mi := t.Metainfo()
	var buf bytes.Buffer
	if err := mi.Write(&buf); err == nil {
		if err := os.WriteFile(c.metainfoPath(hash), buf.Bytes(), 0o600); err != nil {
			c.opts.Logger.Warn().Err(err).Str("hash", hash).Msg("could not keep the torrent's metadata")
		}
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if saved, ok := c.entries[hash]; ok {
		apply(t, saved)
	}
}

// apply makes the library download what the entry says: nothing while stopped,
// every file but the skipped ones otherwise. Called with mu held.
func apply(t *torrent.Torrent, saved *entry) {
	if t.Info() == nil {
		return
	}

	skipped := map[int]bool{}
	for _, index := range saved.Skipped {
		skipped[index] = true
	}

	if saved.Stopped {
		t.DisallowDataDownload()
	} else {
		t.AllowDataDownload()
	}

	for i, f := range t.Files() {
		if saved.Stopped || skipped[i] {
			f.SetPriority(torrent.PiecePriorityNone)
		} else {
			f.SetPriority(torrent.PiecePriorityNormal)
		}
	}
}

func (c *Client) Version(context.Context) (string, error) {
	if _, err := c.start(); err != nil {
		return "", err
	}

	return Version, nil
}

func (c *Client) Add(_ context.Context, req qbittorrent.AddRequest) error {
	cl, err := c.start()
	if err != nil {
		return err
	}

	var spec *torrent.TorrentSpec
	var mi *metainfo.MetaInfo

	switch {
	case req.Magnet != "":
		if spec, err = torrent.TorrentSpecFromMagnetUri(req.Magnet); err != nil {
			return apperr.Invalid("magnet", "the magnet link cannot be read: %v", err)
		}
	default:
		if mi, err = metainfo.Load(bytes.NewReader(req.Torrent)); err != nil {
			return apperr.Invalid("torrent", "the .torrent file cannot be read: %v", err)
		}
		if spec, err = torrent.TorrentSpecFromMetaInfoErr(mi); err != nil {
			return apperr.Invalid("torrent", "the .torrent file cannot be read: %v", err)
		}
	}

	hash := spec.InfoHash.HexString()

	c.mu.Lock()
	defer c.mu.Unlock()

	if _, ok := c.entries[hash]; ok {
		return nil
	}

	saved := &entry{Magnet: req.Magnet, SavePath: req.SavePath, Stopped: req.Hold, AddedAt: time.Now().UTC()}

	if mi != nil {
		if err := os.WriteFile(c.metainfoPath(hash), req.Torrent, 0o600); err != nil {
			return apperr.Wrap(err, apperr.KindInternal, "keep the .torrent file")
		}
	}

	if cl == nil {
		return apperr.New(apperr.KindUnavailable, "the built-in torrent client is not running")
	}

	if err := c.addSpec(hash, spec, saved); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "add the torrent")
	}

	c.entries[hash] = saved

	return c.saveLocked()
}

func (c *Client) Torrents(_ context.Context, hashes []string) ([]qbittorrent.Torrent, error) {
	cl, err := c.start()
	if err != nil {
		return nil, err
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()
	var out []qbittorrent.Torrent

	for _, hash := range hashes {
		saved, ok := c.entries[hash]
		if !ok {
			continue
		}

		t, ok := cl.Torrent(metainfo.NewHashFromHex(hash))
		if !ok {
			continue
		}

		out = append(out, c.status(hash, t, saved, now))
	}

	return out, nil
}

// status describes a torrent the way qBittorrent would, state names included,
// so the module reads both clients alike. Called with mu held.
func (c *Client) status(hash string, t *torrent.Torrent, saved *entry, now time.Time) qbittorrent.Torrent {
	status := qbittorrent.Torrent{Hash: hash, Name: t.Name(), SavePath: saved.SavePath, ETA: unknownETA}

	stats := t.Stats()
	status.Seeds = stats.ConnectedSeeders
	if peers := stats.ActivePeers - stats.ConnectedSeeders; peers > 0 {
		status.Peers = peers
	}

	read := stats.BytesReadUsefulData.Int64()
	written := stats.BytesWrittenData.Int64()

	if previous, ok := c.samples[hash]; ok {
		if elapsed := now.Sub(previous.at).Seconds(); elapsed >= 0.5 {
			c.speeds[hash] = [2]int64{
				int64(float64(read-previous.read) / elapsed),
				int64(float64(written-previous.written) / elapsed),
			}
			c.samples[hash] = sample{read: read, written: written, at: now}
		}
	} else {
		c.samples[hash] = sample{read: read, written: written, at: now}
	}

	speeds := c.speeds[hash]
	status.DLSpeed, status.UPSpeed = max(speeds[0], 0), max(speeds[1], 0)

	if t.Info() == nil {
		status.State = "metaDL"
		return status
	}

	skipped := map[int]bool{}
	for _, index := range saved.Skipped {
		skipped[index] = true
	}

	var wanted, done int64
	for i, f := range t.Files() {
		if skipped[i] {
			continue
		}
		wanted += f.Length()
		done += f.BytesCompleted()
	}

	status.Size = wanted
	status.AmountLeft = wanted - done
	if wanted > 0 {
		status.Progress = float64(done) / float64(wanted)
	}

	complete := wanted > 0 && done >= wanted

	switch {
	case saved.Stopped && complete:
		status.State = "stoppedUP"
	case saved.Stopped:
		status.State = "stoppedDL"
	case complete && status.UPSpeed > 0:
		status.State = "uploading"
	case complete:
		status.State = "stalledUP"
	case status.DLSpeed > 0:
		status.State = "downloading"
	default:
		status.State = "stalledDL"
	}

	if !complete && status.DLSpeed > 0 {
		status.ETA = status.AmountLeft / status.DLSpeed
	}

	return status
}

func (c *Client) Files(_ context.Context, hash string) ([]qbittorrent.File, error) {
	cl, err := c.start()
	if err != nil {
		return nil, err
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	saved, ok := c.entries[hash]
	if !ok {
		return nil, apperr.New(apperr.KindNotFound, "the torrent is not in the built-in client")
	}

	t, ok := cl.Torrent(metainfo.NewHashFromHex(hash))
	if !ok || t.Info() == nil {
		return nil, nil
	}

	skipped := map[int]bool{}
	for _, index := range saved.Skipped {
		skipped[index] = true
	}

	files := make([]qbittorrent.File, 0, len(t.Files()))
	for i, f := range t.Files() {
		file := qbittorrent.File{Index: i, Name: f.Path(), Size: f.Length(), Priority: qbittorrent.PriorityNormal}
		if f.Length() > 0 {
			file.Progress = float64(f.BytesCompleted()) / float64(f.Length())
		}
		if skipped[i] {
			file.Priority = qbittorrent.PrioritySkip
		}
		files = append(files, file)
	}

	return files, nil
}

func (c *Client) SetFilePriority(_ context.Context, hash string, indices []int, priority int) error {
	return c.change(hash, func(saved *entry) {
		skipped := map[int]bool{}
		for _, index := range saved.Skipped {
			skipped[index] = true
		}
		for _, index := range indices {
			skipped[index] = priority == qbittorrent.PrioritySkip
		}

		saved.Skipped = saved.Skipped[:0]
		for index, skip := range skipped {
			if skip {
				saved.Skipped = append(saved.Skipped, index)
			}
		}
	})
}

func (c *Client) Pause(_ context.Context, hash string) error {
	return c.change(hash, func(saved *entry) { saved.Stopped = true })
}

func (c *Client) Resume(_ context.Context, hash string) error {
	return c.change(hash, func(saved *entry) { saved.Stopped = false })
}

// change edits a torrent's entry, applies it and keeps it.
func (c *Client) change(hash string, edit func(*entry)) error {
	cl, err := c.start()
	if err != nil {
		return err
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	saved, ok := c.entries[hash]
	if !ok {
		return apperr.New(apperr.KindNotFound, "the torrent is not in the built-in client")
	}

	edit(saved)

	if t, ok := cl.Torrent(metainfo.NewHashFromHex(hash)); ok {
		apply(t, saved)
	}

	return c.saveLocked()
}

func (c *Client) Delete(_ context.Context, hash string, withFiles bool) error {
	cl, err := c.start()
	if err != nil {
		return err
	}

	c.mu.Lock()

	saved, ok := c.entries[hash]
	if !ok {
		c.mu.Unlock()
		return nil
	}

	var name string
	var closed <-chan struct{}
	if t, ok := cl.Torrent(metainfo.NewHashFromHex(hash)); ok {
		if t.Info() != nil {
			name = t.Info().BestName()
		}
		t.Drop()
		closed = t.Closed()
	}

	store := c.stores[hash]
	delete(c.stores, hash)

	delete(c.entries, hash)
	delete(c.samples, hash)
	delete(c.speeds, hash)
	_ = os.Remove(c.metainfoPath(hash))

	err = c.saveLocked()
	c.mu.Unlock()

	if closed != nil {
		<-closed
	}
	if store != nil {
		_ = store.Close()
	}

	if withFiles && name != "" {
		if removeErr := removeDownloaded(saved.SavePath, name); removeErr != nil {
			return apperr.Wrap(removeErr, apperr.KindInternal, "delete the downloaded files")
		}
	}

	return err
}

// removeDownloaded deletes a torrent's folder or file, part files included, and
// only when it sits right inside the folder the torrent was saved to. Windows
// keeps a dropped torrent's files locked for a moment, so it tries again briefly.
func removeDownloaded(savePath, name string) error {
	target := filepath.Join(savePath, name)
	if filepath.Dir(target) != filepath.Clean(savePath) || strings.ContainsAny(name, `/\`) {
		return nil
	}

	var err error
	for attempt := 0; attempt < 20; attempt++ {
		err = os.RemoveAll(target)
		if err == nil {
			err = os.RemoveAll(target + ".part")
		}
		if err == nil {
			return nil
		}
		time.Sleep(150 * time.Millisecond)
	}

	return err
}

// Close stops the client; torrents resume on the next start.
func (c *Client) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.cl != nil {
		c.cl.Close()
		<-c.cl.Closed()
	}

	for hash, store := range c.stores {
		_ = store.Close()
		delete(c.stores, hash)
	}
}

func (c *Client) statePath() string {
	return filepath.Join(c.opts.StateDir, "state.json")
}

func (c *Client) metainfoPath(hash string) string {
	return filepath.Join(c.opts.StateDir, hash+".torrent")
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
		return apperr.Wrap(err, apperr.KindInternal, "encode the torrent client's list")
	}

	tmp := c.statePath() + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "save the torrent client's list")
	}

	if err := os.Rename(tmp, c.statePath()); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "save the torrent client's list")
	}

	return nil
}
