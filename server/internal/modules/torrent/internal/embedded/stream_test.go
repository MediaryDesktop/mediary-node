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
