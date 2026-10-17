package embedded

import (
	"bytes"
	"context"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/anacrolix/torrent"
	"github.com/anacrolix/torrent/metainfo"
	"github.com/anacrolix/torrent/storage"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/debrid"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// ServiceName names the client where a stream says who is getting it.
const ServiceName = "Built-in client"

const (
	// The start of the file a stream waits for before the player opens: the
	// container's header and the first seconds of the picture.
	streamHead = 8 << 20
	// How far past where the player reads the client fetches first.
	streamReadahead = 32 << 20
)

// localStream is the one torrent the client plays without adding it to the
// library. A new stream replaces it, files and all.
type localStream struct {
	hash string
	t    *torrent.Torrent
	// store and dir are the stream's own; nil and "" when it plays from a
	// torrent already downloading into the library, which it leaves alone.
	store storage.ClientImplCloser
	dir   string
	// The file the player wants, once said; -1 until then.
	file int
	last sample
	// Bytes per second in and out, from the last two samples.
	speed, upload int64
}

func (c *Client) streamsDir() string {
	return filepath.Join(c.opts.StateDir, "streams")
}

// Service names the client in a stream's status.
func (c *Client) Service() string {
	return ServiceName
}

// Stream starts getting a torrent to play. Nothing downloads until the file to
// play is known: Buffer says which.
func (c *Client) Stream(_ context.Context, magnet string, torrentFile []byte) (string, error) {
	cl, err := c.start()
	if err != nil {
		return "", err
	}

	var spec *torrent.TorrentSpec
	if magnet != "" {
		if spec, err = torrent.TorrentSpecFromMagnetUri(magnet); err != nil {
			return "", apperr.Invalid("magnet", "the magnet link cannot be read: %v", err)
		}
	} else {
		mi, loadErr := metainfo.Load(bytes.NewReader(torrentFile))
		if loadErr != nil {
			return "", apperr.Invalid("torrent", "the .torrent file cannot be read: %v", loadErr)
		}
		if spec, err = torrent.TorrentSpecFromMetaInfoErr(mi); err != nil {
			return "", apperr.Invalid("torrent", "the .torrent file cannot be read: %v", err)
		}
	}

	hash := spec.InfoHash.HexString()

	c.mu.Lock()
	defer c.mu.Unlock()

	if c.stream != nil && c.stream.hash == hash {
		return hash, nil
	}
	c.dropStreamLocked()

	stream := &localStream{hash: hash, file: -1, last: sample{at: time.Now()}}

	// A torrent the library is downloading already has the files: play those.
	if _, downloading := c.entries[hash]; downloading {
		t, ok := cl.Torrent(spec.InfoHash)
		if !ok {
			return "", apperr.New(apperr.KindUnavailable, "the torrent is in the downloads but not running")
		}
		stream.t = t
		c.stream = stream
		return hash, nil
	}

	stream.dir = filepath.Join(c.streamsDir(), hash)
	// The storage keeps its record of checked pieces in the folder; without the
	// folder every piece waits on a check that never ends.
	if mkErr := os.MkdirAll(stream.dir, 0o700); mkErr != nil {
		return "", apperr.Wrap(mkErr, apperr.KindInternal, "create the stream's folder")
	}
	stream.store = storage.NewFileOpts(storage.NewFileClientOpts{ClientBaseDir: stream.dir})
	spec.Storage = stream.store

	t, _, err := cl.AddTorrentSpec(spec)
	if err != nil {
		_ = stream.store.Close()
		return "", apperr.Wrap(err, apperr.KindInternal, "add the torrent")
	}
	stream.t = t
	c.stream = stream

	// Nothing but the metadata until the file is chosen.
	go func() {
		<-t.GotInfo()
		c.mu.Lock()
		defer c.mu.Unlock()
		if c.stream == stream && stream.file < 0 {
			for _, f := range t.Files() {
				f.SetPriority(torrent.PiecePriorityNone)
			}
		}
	}()

	return hash, nil
}

// StreamState is how far the client is with a stream: its files once the
// metadata came, which is when it counts as ready for a file to be chosen.
func (c *Client) StreamState(_ context.Context, hash string) (debrid.Remote, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	stream, err := c.streamLocked(hash)
	if err != nil {
		return debrid.Remote{}, err
	}

	remote := debrid.Remote{Hash: hash, Name: stream.t.Name()}
	c.sampleLocked(stream)
	stats := stream.t.Stats()
	remote.Speed, remote.Upload = stream.speed, stream.upload
	remote.Peers, remote.Seeders = stats.ActivePeers, stats.ConnectedSeeders

	if stream.t.Info() == nil {
		return remote, nil
	}

	remote.Ready = true
	for i, f := range stream.t.Files() {
		remote.Files = append(remote.Files, debrid.RemoteFile{ID: i, Path: f.Path(), Size: f.Length()})
	}

	return remote, nil
}

// Buffer downloads the file to play, its start and end first, and reports
// whether enough of it is in for the player: the start, where the container's
// header is, and the last piece, where mkv and mp4 often keep their index.
func (c *Client) Buffer(_ context.Context, hash string, fileID int) (ready bool, progress float64, err error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	stream, err := c.streamLocked(hash)
	if err != nil {
		return false, 0, err
	}

	files := stream.t.Files()
	if fileID < 0 || fileID >= len(files) {
		return false, 0, apperr.New(apperr.KindNotFound, "the torrent has no file %d", fileID)
	}
	file := files[fileID]

	needed := bufferPieces(stream.t, file)

	if stream.file != fileID {
		stream.file = fileID
		for i, f := range files {
			if i != fileID && f.Priority() != torrent.PiecePriorityNone {
				if _, downloading := c.entries[hash]; !downloading {
					f.SetPriority(torrent.PiecePriorityNone)
				}
			}
		}
		file.SetPriority(torrent.PiecePriorityNormal)
		for _, piece := range needed {
			stream.t.Piece(piece).SetPriority(torrent.PiecePriorityNow)
		}
	}

	done := 0
	for _, piece := range needed {
		if stream.t.Piece(piece).State().Complete {
			done++
		}
	}
	if len(needed) == 0 {
		return true, 1, nil
	}

	return done == len(needed), float64(done) / float64(len(needed)), nil
}

// bufferPieces are the pieces of the file's start and its last piece.
func bufferPieces(t *torrent.Torrent, file *torrent.File) []int {
	begin, end := file.BeginPieceIndex(), file.EndPieceIndex()
	if end <= begin {
		return nil
	}

	pieceLength := t.Info().PieceLength
	if pieceLength <= 0 {
		return nil
	}

	head := min(int64(streamHead), file.Length())
	headEnd := min(end, int((file.Offset()+head+pieceLength-1)/pieceLength))
	if headEnd <= begin {
		headEnd = begin + 1
	}

	pieces := make([]int, 0, headEnd-begin+1)
	for i := begin; i < headEnd; i++ {
		pieces = append(pieces, i)
	}
	if end-1 >= headEnd {
		pieces = append(pieces, end-1)
	}

	return pieces
}

// OpenStream reads a stream's file as it downloads. The reader waits for the
// pieces it reaches and raises their priority, so the player can seek; ctx ends
// the waits when the player hangs up.
func (c *Client) OpenStream(ctx context.Context, hash string, fileID int) (io.ReadSeekCloser, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	stream, err := c.streamLocked(hash)
	if err != nil {
		return nil, err
	}

	files := stream.t.Files()
	if fileID < 0 || fileID >= len(files) {
		return nil, apperr.New(apperr.KindNotFound, "the torrent has no file %d", fileID)
	}

	reader := files[fileID].NewReader()
	reader.SetContext(ctx)
	reader.SetResponsive()
	reader.SetReadahead(streamReadahead)

	return reader, nil
}

func (c *Client) streamLocked(hash string) (*localStream, error) {
	if c.stream == nil || c.stream.hash != hash {
		return nil, apperr.New(apperr.KindNotFound, "the built-in client is no longer playing this torrent: start it again")
	}

	return c.stream, nil
}

// sampleLocked updates a stream's speeds from its useful bytes read and the
// bytes it gave to peers.
func (c *Client) sampleLocked(stream *localStream) {
	now := time.Now()
	stats := stream.t.Stats()
	read := stats.BytesReadUsefulData.Int64()
	written := stats.BytesWrittenData.Int64()

	if elapsed := now.Sub(stream.last.at).Seconds(); elapsed >= 0.5 {
		stream.speed = max(int64(float64(read-stream.last.read)/elapsed), 0)
		stream.upload = max(int64(float64(written-stream.last.written)/elapsed), 0)
		stream.last = sample{read: read, written: written, at: now}
	}
}

// dropStreamLocked stops the stream there is and deletes what it downloaded,
// unless it played from a torrent in the downloads.
func (c *Client) dropStreamLocked() {
	stream := c.stream
	if stream == nil {
		return
	}
	c.stream = nil

	if stream.store == nil {
		return
	}

	stream.t.Drop()
	go func() {
		<-stream.t.Closed()
		_ = stream.store.Close()
		removeStreamDir(stream.dir)
	}()
}

// removeStreamDir deletes a stream's folder, trying again briefly while Windows
// still holds the files of a torrent just dropped.
func removeStreamDir(dir string) {
	for attempt := 0; attempt < 20; attempt++ {
		if err := os.RemoveAll(dir); err == nil {
			return
		}
		time.Sleep(150 * time.Millisecond)
	}
}
