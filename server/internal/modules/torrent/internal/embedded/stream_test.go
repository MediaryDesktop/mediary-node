package embedded

import (
	"bytes"
	"context"
	"io"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/anacrolix/torrent"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/qbittorrent"
)

func TestStreamPlaysOneFileWithoutTheLibrary(t *testing.T) {
	_, torrentFile, episodes, seederPort := seedOn(t)
	stateDir := t.TempDir()
	c := newClient(t, stateDir)
	ctx := context.Background()

	hash, err := c.Stream(ctx, "", torrentFile)
	if err != nil {
		t.Fatal(err)
	}

	file := -1
	waitFor(t, "the metadata", func() bool {
		remote, stateErr := c.StreamState(ctx, hash)
		if stateErr != nil {
			t.Fatal(stateErr)
		}
		for _, f := range remote.Files {
			if strings.HasSuffix(f.Path, "Frieren - 02.mkv") {
				file = f.ID
			}
		}
		return remote.Ready && file >= 0
	})

	// The client dials the seeder, as it would one DHT or a tracker named.
	if _, _, err = c.Buffer(ctx, hash, file); err != nil {
		t.Fatal(err)
	}
	c.stream.t.AddPeers([]torrent.PeerInfo{{
		Addr:    &net.TCPAddr{IP: net.IPv4(127, 0, 0, 1), Port: seederPort},
		Trusted: true,
	}})

	waitFor(t, "the buffer", func() bool {
		ready, _, bufErr := c.Buffer(ctx, hash, file)
		if bufErr != nil {
			t.Fatal(bufErr)
		}
		return ready
	})

	reader, err := c.OpenStream(ctx, hash, file)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = reader.Close() }()

	// Seeking to the end and back, as a player reading an mkv's index does.
	if _, err = reader.Seek(-1000, io.SeekEnd); err != nil {
		t.Fatal(err)
	}
	if _, err = reader.Seek(0, io.SeekStart); err != nil {
		t.Fatal(err)
	}

	got, err := io.ReadAll(reader)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, episodes["Frieren - 02.mkv"]) {
		t.Fatalf("read %d bytes, not the episode's %d", len(got), len(episodes["Frieren - 02.mkv"]))
	}

	if torrents, _ := c.Torrents(ctx, []string{hash}); len(torrents) != 0 {
		t.Error("a stream shows in the downloads")
	}

	// The other episode was never fetched.
	other := filepath.Join(stateDir, "streams", hash, "Frieren E2E", "Frieren - 01.mkv")
	if data, readErr := os.ReadFile(other); readErr == nil && len(bytes.Trim(data, "\x00")) > 0 {
		t.Error("the episode not played was downloaded too")
	}
}

// Downloading what is playing: the download gets the library's folder, not the
// stream's, the stream plays on from it, and the next stream leaves it alone.
func TestADownloadOfTheTorrentPlayingTakesItOver(t *testing.T) {
	seeder, torrentFile, episodes := seed(t)
	stateDir := t.TempDir()
	saveDir := filepath.Join(t.TempDir(), "Frieren")
	c := newClient(t, stateDir)
	ctx := context.Background()

	hash, err := c.Stream(ctx, "", torrentFile)
	if err != nil {
		t.Fatal(err)
	}

	file := -1
	waitFor(t, "the metadata", func() bool {
		remote, _ := c.StreamState(ctx, hash)
		for _, f := range remote.Files {
			if strings.HasSuffix(f.Path, "Frieren - 02.mkv") {
				file = f.ID
			}
		}
		return remote.Ready && file >= 0
	})
	if _, _, err = c.Buffer(ctx, hash, file); err != nil {
		t.Fatal(err)
	}

	if err = c.Add(ctx, qbittorrent.AddRequest{Torrent: torrentFile, SavePath: saveDir}); err != nil {
		t.Fatal(err)
	}
	seeder.AddClientPeer(c.cl)

	waitFor(t, "the download", func() bool {
		got, _ := c.Torrents(ctx, []string{hash})
		return len(got) == 1 && got[0].Progress >= 1
	})

	for name, want := range episodes {
		got, readErr := os.ReadFile(filepath.Join(saveDir, "Frieren E2E", name))
		if readErr != nil || !bytes.Equal(got, want) {
			t.Fatalf("%s in the library: %v, %d bytes of %d", name, readErr, len(got), len(want))
		}
	}

	reader, err := c.OpenStream(ctx, hash, file)
	if err != nil {
		t.Fatalf("the stream stopped when its torrent was downloaded: %v", err)
	}
	got, err := io.ReadAll(reader)
	_ = reader.Close()
	if err != nil || !bytes.Equal(got, episodes["Frieren - 02.mkv"]) {
		t.Fatalf("the stream read %d bytes (%v), want the episode", len(got), err)
	}

	if _, err = c.Stream(ctx, "magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567", nil); err != nil {
		t.Fatal(err)
	}
	if torrents, _ := c.Torrents(ctx, []string{hash}); len(torrents) != 1 {
		t.Fatal("the next stream took the download with it")
	}
	if _, err = os.Stat(filepath.Join(saveDir, "Frieren E2E", "Frieren - 02.mkv")); err != nil {
		t.Fatalf("the next stream deleted the download's files: %v", err)
	}
}

func TestANewStreamDropsTheOldOne(t *testing.T) {
	_, torrentFile, _ := seed(t)
	c := newClient(t, t.TempDir())
	ctx := context.Background()

	hash, err := c.Stream(ctx, "", torrentFile)
	if err != nil {
		t.Fatal(err)
	}

	if _, err = c.Stream(ctx, "magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567", nil); err != nil {
		t.Fatal(err)
	}

	if _, err = c.StreamState(ctx, hash); err == nil {
		t.Fatal("the first stream is still played after another started")
	}
}
