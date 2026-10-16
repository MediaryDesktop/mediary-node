package embedded

import (
	"bytes"
	"context"
	"crypto/rand"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/anacrolix/torrent"
	"github.com/anacrolix/torrent/bencode"
	"github.com/anacrolix/torrent/metainfo"
	"github.com/anacrolix/torrent/storage"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/qbittorrent"
)

// seed makes a torrent of a two-episode folder and a client that seeds it, with
// no DHT and no trackers: the only way to the data is the peer it is handed.
func seed(t *testing.T) (seeder *torrent.Torrent, torrentFile []byte, episodes map[string][]byte) {
	t.Helper()

	seeder, torrentFile, episodes, _ = seedOn(t)

	return seeder, torrentFile, episodes
}

// seedOn is seed with the port the seeding client listens on, for a client to
// dial it as it would a seeder found on the network.
func seedOn(t *testing.T) (seeder *torrent.Torrent, torrentFile []byte, episodes map[string][]byte, port int) {
	t.Helper()

	dir := t.TempDir()
	root := filepath.Join(dir, "Frieren E2E")
	if err := os.MkdirAll(root, 0o755); err != nil {
		t.Fatal(err)
	}

	episodes = map[string][]byte{
		"Frieren - 01.mkv": make([]byte, 300_000),
		"Frieren - 02.mkv": make([]byte, 200_000),
	}
	for name, data := range episodes {
		_, _ = rand.Read(data)
		if err := os.WriteFile(filepath.Join(root, name), data, 0o644); err != nil {
			t.Fatal(err)
		}
	}

	info := metainfo.Info{PieceLength: 16 << 10}
	if err := info.BuildFromFilePath(root); err != nil {
		t.Fatal(err)
	}

	infoBytes, err := bencode.Marshal(info)
	if err != nil {
		t.Fatal(err)
	}
	mi := metainfo.MetaInfo{InfoBytes: infoBytes}

	var buf bytes.Buffer
	if err = mi.Write(&buf); err != nil {
		t.Fatal(err)
	}

	cfg := torrent.NewDefaultClientConfig()
	cfg.DataDir = t.TempDir()
	cfg.Seed = true
	cfg.NoDHT = true
	cfg.DisableTrackers = true
	cfg.NoDefaultPortForwarding = true
	cfg.ListenPort = 0
	cfg.DisableUTP = true

	cl, err := torrent.NewClient(cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cl.Close()
		<-cl.Closed()
	})

	spec, err := torrent.TorrentSpecFromMetaInfoErr(&mi)
	if err != nil {
		t.Fatal(err)
	}
	store := storage.NewFileOpts(storage.NewFileClientOpts{ClientBaseDir: dir})
	t.Cleanup(func() { _ = store.Close() })
	spec.Storage = store

	seeder, _, err = cl.AddTorrentSpec(spec)
	if err != nil {
		t.Fatal(err)
	}
	<-seeder.GotInfo()
	if err := seeder.VerifyDataContext(context.Background()); err != nil {
		t.Fatal(err)
	}

	return seeder, buf.Bytes(), episodes, cl.LocalPort()
}

func newClient(t *testing.T, stateDir string) *Client {
	t.Helper()

	c := New(Options{StateDir: stateDir, Offline: true, Logger: zerolog.Nop()})
	t.Cleanup(c.Close)

	if _, err := c.Version(context.Background()); err != nil {
		t.Fatal(err)
	}

	return c
}

func waitFor(t *testing.T, what string, done func() bool) {
	t.Helper()

	deadline := time.Now().Add(30 * time.Second)
	for !done() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for %s", what)
		}
		time.Sleep(100 * time.Millisecond)
	}
}

func TestDownloadsWhatItIsAskedForAndKeepsItAcrossARestart(t *testing.T) {
	ctx := context.Background()
	seeder, torrentFile, episodes := seed(t)
	hash := seeder.InfoHash().HexString()

	stateDir := t.TempDir()
	saveDir := filepath.Join(t.TempDir(), "Frieren")
	c := newClient(t, stateDir)

	if err := c.Add(ctx, qbittorrent.AddRequest{Torrent: torrentFile, SavePath: saveDir, Hold: true}); err != nil {
		t.Fatal(err)
	}

	var files []qbittorrent.File
	waitFor(t, "the file list", func() bool {
		var err error
		files, err = c.Files(ctx, hash)
		return err == nil && len(files) == 2
	})

	skip := -1
	for _, f := range files {
		if f.Name == "Frieren E2E/Frieren - 02.mkv" {
			skip = f.Index
		}
	}
	if skip < 0 {
		t.Fatalf("files = %+v, want qBittorrent's layout with the torrent's folder", files)
	}

	if got, _ := c.Torrents(ctx, []string{hash}); len(got) != 1 || got[0].State != "stoppedDL" {
		t.Fatalf("a held torrent is stopped, got %+v", got)
	}

	if err := c.SetFilePriority(ctx, hash, []int{skip}, qbittorrent.PrioritySkip); err != nil {
		t.Fatal(err)
	}
	if err := c.Resume(ctx, hash); err != nil {
		t.Fatal(err)
	}

	seeder.AddClientPeer(c.cl)

	waitFor(t, "the episode", func() bool {
		got, _ := c.Torrents(ctx, []string{hash})
		return len(got) == 1 && got[0].Progress >= 1
	})

	got, err := os.ReadFile(filepath.Join(saveDir, "Frieren E2E", "Frieren - 01.mkv"))
	if err != nil || !bytes.Equal(got, episodes["Frieren - 01.mkv"]) {
		t.Fatalf("episode 1 on disk: %d bytes, %v", len(got), err)
	}
	if _, err := os.Stat(filepath.Join(saveDir, "Frieren E2E", "Frieren - 02.mkv")); err == nil {
		t.Fatal("a skipped file was downloaded whole")
	}

	status, _ := c.Torrents(ctx, []string{hash})
	if status[0].Size != int64(len(episodes["Frieren - 01.mkv"])) || (status[0].State != "stalledUP" && status[0].State != "uploading") {
		t.Fatalf("status = %+v, want the chosen file's size and a finished state", status[0])
	}

	// A restarted node finds its torrents where it left them.
	c.Close()
	again := newClient(t, stateDir)

	waitFor(t, "the torrent after a restart", func() bool {
		got, _ := again.Torrents(ctx, []string{hash})
		return len(got) == 1 && got[0].Progress >= 1
	})

	if err := again.Delete(ctx, hash, true); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(saveDir, "Frieren E2E")); err == nil {
		t.Fatal("delete with files left the torrent's folder")
	}
	if got, _ := again.Torrents(ctx, []string{hash}); len(got) != 0 {
		t.Fatalf("a deleted torrent is still listed: %+v", got)
	}
}
