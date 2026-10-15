package debrid

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/qbittorrent"
)

const hash = "0123456789abcdef0123456789abcdef01234567"

const magnet = "magnet:?xt=urn:btih:" + hash + "&dn=Show"

// fakeProvider is a debrid account held in memory; its files are served by a
// test server that honours Range.
type fakeProvider struct {
	mu      sync.Mutex
	remotes map[string]*Remote
	added   int
	deleted []string
	content map[int][]byte
	server  *httptest.Server
	// ranges records the Range header of every file request.
	ranges []string

	// Modes of services other than TorBox: a listing without hashes
	// (Premiumize), without files (Real-Debrid, AllDebrid), and torrents that
	// wait for Start (Real-Debrid).
	hideHash, partial, waiting bool
	starts, details            int
}

func newFake(t *testing.T) *fakeProvider {
	t.Helper()

	f := &fakeProvider{remotes: map[string]*Remote{}, content: map[int][]byte{}}
	f.server = httptest.NewServer(http.HandlerFunc(f.serveFile))
	t.Cleanup(f.server.Close)

	return f
}

func (f *fakeProvider) serveFile(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(strings.TrimPrefix(r.URL.Path, "/file/"))

	f.mu.Lock()
	data := f.content[id]
	f.ranges = append(f.ranges, r.Header.Get("Range"))
	f.mu.Unlock()

	w.Header().Set("Content-Length", strconv.Itoa(len(data)))
	http.ServeContent(w, r, "file", time.Time{}, strings.NewReader(string(data)))
}

func (f *fakeProvider) Account(context.Context) (string, error) { return "Fake · Free plan", nil }

func (f *fakeProvider) Add(_ context.Context, _ string, _ []byte, name string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.added++
	f.remotes[hash] = &Remote{ID: "1", Hash: strings.ToUpper(hash), Name: name, Waiting: f.waiting}

	return "1", nil
}

func (f *fakeProvider) Detail(_ context.Context, remote Remote) (Remote, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.details++
	for _, r := range f.remotes {
		if r.ID == remote.ID {
			full := *r
			full.Partial = false
			return full, nil
		}
	}

	return remote, nil
}

func (f *fakeProvider) Start(_ context.Context, remote Remote) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.starts++
	for _, r := range f.remotes {
		if r.ID == remote.ID {
			r.Waiting = false
		}
	}

	return nil
}

func (f *fakeProvider) Remotes(context.Context) ([]Remote, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	var out []Remote
	for _, r := range f.remotes {
		listed := *r
		if f.hideHash {
			listed.Hash = ""
		}
		if f.partial {
			listed.Files, listed.Partial = nil, true
		}
		out = append(out, listed)
	}

	return out, nil
}

func (f *fakeProvider) Cached(_ context.Context, hashes []string) (map[string]bool, error) {
	out := map[string]bool{}
	for _, h := range hashes {
		out[h] = h == hash
	}

	return out, nil
}

func (f *fakeProvider) Link(_ context.Context, _ Remote, fileID int) (string, error) {
	return f.server.URL + "/file/" + strconv.Itoa(fileID), nil
}

func (f *fakeProvider) Delete(_ context.Context, remote Remote) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.deleted = append(f.deleted, remote.ID)
	delete(f.remotes, strings.ToLower(remote.Hash))

	return nil
}

// finish makes the service hold the torrent's files.
func (f *fakeProvider) finish(files map[int]string, content map[int][]byte) {
	f.mu.Lock()
	defer f.mu.Unlock()

	r := f.remotes[hash]
	r.Ready, r.Progress, r.Files = true, 1, nil
	for id := 0; id < len(files); id++ {
		r.Files = append(r.Files, RemoteFile{ID: id, Path: files[id], Size: int64(len(content[id]))})
		f.content[id] = content[id]
	}
}

func newClient(t *testing.T, provider Provider) *Client {
	t.Helper()

	client := New(Options{Name: "Fake", Provider: provider, StateDir: t.TempDir(), Logger: zerolog.Nop()})
	t.Cleanup(client.Close)

	return client
}

func torrentOf(t *testing.T, client *Client) qbittorrent.Torrent {
	t.Helper()

	client.mu.Lock()
	client.listedAt = time.Time{}
	client.mu.Unlock()

	torrents, err := client.Torrents(context.Background(), []string{hash})
	if err != nil {
		t.Fatal(err)
	}
	if len(torrents) != 1 {
		t.Fatalf("torrents = %+v", torrents)
	}

	return torrents[0]
}

func waitFor(t *testing.T, what string, done func() bool) {
	t.Helper()

	deadline := time.Now().Add(10 * time.Second)
	for !done() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for %s", what)
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func TestTorrentIsQueuedUntilTheServiceHasItThenFetched(t *testing.T) {
	fake := newFake(t)
	client := newClient(t, fake)
	save := t.TempDir()
	ctx := context.Background()

	if err := client.Add(ctx, qbittorrent.AddRequest{Magnet: magnet, SavePath: save}); err != nil {
		t.Fatal(err)
	}

	if got := torrentOf(t, client); got.State != "metaDL" || got.Progress != 0 {
		t.Fatalf("before the service has it: %+v", got)
	}

	video := []byte(strings.Repeat("v", 300<<10))
	fake.finish(map[int]string{0: "Show/Show - 01.mkv", 1: "Show/Extras/notes.txt"}, map[int][]byte{0: video, 1: []byte("hi")})

	waitFor(t, "the files to be fetched", func() bool {
		return torrentOf(t, client).Progress == 1
	})

	got, err := os.ReadFile(filepath.Join(save, "Show", "Show - 01.mkv"))
	if err != nil || len(got) != len(video) {
		t.Fatalf("video on disk: %d bytes, %v", len(got), err)
	}
	if _, statErr := os.Stat(filepath.Join(save, "Show", "Show - 01.mkv.part")); !os.IsNotExist(statErr) {
		t.Errorf("the part file is left behind: %v", statErr)
	}

	status := torrentOf(t, client)
	if status.State != "stalledUP" || status.Size != int64(len(video)+2) {
		t.Errorf("finished torrent: %+v", status)
	}

	files, err := client.Files(ctx, hash)
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 2 || files[0].Progress != 1 || files[0].Name != "Show/Show - 01.mkv" {
		t.Errorf("files = %+v", files)
	}

	if err := client.Delete(ctx, hash, true); err != nil {
		t.Fatal(err)
	}
	if len(fake.deleted) != 1 {
		t.Errorf("the service was not asked to delete: %v", fake.deleted)
	}
	if _, err := os.Stat(filepath.Join(save, "Show")); !os.IsNotExist(err) {
		t.Errorf("the emptied folder is left behind: %v", err)
	}
	if _, err := os.Stat(save); err != nil {
		t.Errorf("the save folder itself was removed: %v", err)
	}
}

func TestAlreadyOnTheAccountIsNotAddedAgain(t *testing.T) {
	fake := newFake(t)
	fake.remotes[hash] = &Remote{ID: "1", Hash: hash, Name: "Show"}
	client := newClient(t, fake)

	if err := client.Add(context.Background(), qbittorrent.AddRequest{Magnet: magnet, SavePath: t.TempDir()}); err != nil {
		t.Fatal(err)
	}
	if fake.added != 0 {
		t.Errorf("added %d times, want 0", fake.added)
	}
}

func TestHeldTorrentFetchesOnlyChosenFilesAfterResume(t *testing.T) {
	fake := newFake(t)
	client := newClient(t, fake)
	save := t.TempDir()
	ctx := context.Background()

	if err := client.Add(ctx, qbittorrent.AddRequest{Magnet: magnet, SavePath: save, Hold: true}); err != nil {
		t.Fatal(err)
	}
	fake.finish(map[int]string{0: "Show/01.mkv", 1: "Show/02.mkv"}, map[int][]byte{0: []byte("one"), 1: []byte("two")})

	if got := torrentOf(t, client); got.State != "stoppedDL" {
		t.Fatalf("held torrent: %+v", got)
	}

	if err := client.SetFilePriority(ctx, hash, []int{0}, qbittorrent.PrioritySkip); err != nil {
		t.Fatal(err)
	}
	if err := client.Resume(ctx, hash); err != nil {
		t.Fatal(err)
	}

	waitFor(t, "the chosen file", func() bool { return torrentOf(t, client).Progress == 1 })

	if _, err := os.Stat(filepath.Join(save, "Show", "01.mkv")); !os.IsNotExist(err) {
		t.Errorf("a skipped file was fetched: %v", err)
	}
	if _, err := os.Stat(filepath.Join(save, "Show", "02.mkv")); err != nil {
		t.Errorf("the chosen file is missing: %v", err)
	}
}

func TestFetchResumesFromThePartFile(t *testing.T) {
	fake := newFake(t)
	client := newClient(t, fake)
	save := t.TempDir()

	content := []byte("0123456789abcdefghij")
	if err := os.MkdirAll(filepath.Join(save, "Show"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(save, "Show", "01.mkv.part"), content[:8], 0o644); err != nil {
		t.Fatal(err)
	}

	if err := client.Add(context.Background(), qbittorrent.AddRequest{Magnet: magnet, SavePath: save}); err != nil {
		t.Fatal(err)
	}
	fake.finish(map[int]string{0: "Show/01.mkv"}, map[int][]byte{0: content})

	waitFor(t, "the file", func() bool { return torrentOf(t, client).Progress == 1 })

	got, _ := os.ReadFile(filepath.Join(save, "Show", "01.mkv"))
	if !bytes.Equal(got, content) {
		t.Errorf("file = %q", got)
	}

	fake.mu.Lock()
	defer fake.mu.Unlock()
	if len(fake.ranges) == 0 || fake.ranges[0] != "bytes=8-" {
		t.Errorf("ranges = %q, want the first request to resume at 8", fake.ranges)
	}
}

func TestUnsafePathsAreNeverWritten(t *testing.T) {
	for _, p := range []string{"../evil.mkv", "Show/../../evil.mkv", "/abs.mkv", `C:\evil.mkv`, "Show//x.mkv", "a/./b.mkv"} {
		if safePath(p) {
			t.Errorf("safePath(%q) = true", p)
		}
	}
	for _, p := range []string{"Show/01.mkv", "01.mkv", "Show/Extras/notes.txt", "..hidden/a.mkv"} {
		if !safePath(p) {
			t.Errorf("safePath(%q) = false", p)
		}
	}

	fake := newFake(t)
	client := newClient(t, fake)
	parent := t.TempDir()
	save := filepath.Join(parent, "lib")

	if err := client.Add(context.Background(), qbittorrent.AddRequest{Magnet: magnet, SavePath: save}); err != nil {
		t.Fatal(err)
	}
	fake.finish(map[int]string{0: "../evil.mkv", 1: "Show/01.mkv"}, map[int][]byte{0: []byte("evil"), 1: []byte("ok")})

	waitFor(t, "the safe file", func() bool { return torrentOf(t, client).Progress == 1 })

	if _, err := os.Stat(filepath.Join(parent, "evil.mkv")); !os.IsNotExist(err) {
		t.Fatalf("a file was written outside the save folder: %v", err)
	}

	files, _ := client.Files(context.Background(), hash)
	if len(files) != 1 {
		t.Errorf("files = %+v, want the unsafe one left out", files)
	}
}

func TestListIsRememberedAcrossRestarts(t *testing.T) {
	fake := newFake(t)
	dir := t.TempDir()
	save := t.TempDir()

	first := New(Options{Name: "Fake", Provider: fake, StateDir: dir, Logger: zerolog.Nop()})
	if err := first.Add(context.Background(), qbittorrent.AddRequest{Magnet: magnet, SavePath: save, Hold: true}); err != nil {
		t.Fatal(err)
	}
	first.Close()

	second := newClient(t, fake)
	second.opts.StateDir = dir
	fake.finish(map[int]string{0: "Show/01.mkv"}, map[int][]byte{0: []byte("x")})

	got := torrentOf(t, second)
	if got.State != "stoppedDL" || got.SavePath != save {
		t.Errorf("after restart: %+v", got)
	}
}

func TestMissingTorrentIsReportedOnlyWithinTheGrace(t *testing.T) {
	fake := newFake(t)
	client := newClient(t, fake)

	if err := client.Add(context.Background(), qbittorrent.AddRequest{Magnet: magnet, SavePath: t.TempDir()}); err != nil {
		t.Fatal(err)
	}

	fake.mu.Lock()
	delete(fake.remotes, hash)
	fake.mu.Unlock()

	if got := torrentOf(t, client); got.State != "metaDL" {
		t.Errorf("just added: %+v", got)
	}

	client.mu.Lock()
	client.entries[hash].AddedAt = time.Now().Add(-addGrace - time.Minute)
	client.listedAt = time.Time{}
	client.mu.Unlock()

	torrents, err := client.Torrents(context.Background(), []string{hash})
	if err != nil {
		t.Fatal(err)
	}
	if len(torrents) != 0 {
		t.Errorf("long gone torrent still listed: %+v", torrents)
	}
}

func TestQueuedTorrentStaysQueued(t *testing.T) {
	fake := newFake(t)
	client := newClient(t, fake)

	if err := client.Add(context.Background(), qbittorrent.AddRequest{Magnet: magnet, SavePath: t.TempDir()}); err != nil {
		t.Fatal(err)
	}

	fake.mu.Lock()
	fake.remotes[hash].Queued = true
	fake.mu.Unlock()

	if got := torrentOf(t, client); got.State != "queuedDL" || got.Remote == nil || !got.Remote.Queued || got.Remote.Service != "Fake" {
		t.Errorf("queued: %+v", got)
	}
}

func TestServiceProgressIsReportedApartFromTheNodes(t *testing.T) {
	fake := newFake(t)
	client := newClient(t, fake)

	if err := client.Add(context.Background(), qbittorrent.AddRequest{Magnet: magnet, SavePath: t.TempDir()}); err != nil {
		t.Fatal(err)
	}

	fake.mu.Lock()
	fake.remotes[hash].Progress = 0.4
	fake.remotes[hash].Speed = 5 << 20
	fake.mu.Unlock()

	got := torrentOf(t, client)
	if got.Progress != 0 || got.Remote == nil || got.Remote.Progress != 0.4 || got.Remote.Speed != 5<<20 || got.Remote.Queued {
		t.Fatalf("while the service downloads: %+v remote %+v", got, got.Remote)
	}

	fake.finish(map[int]string{0: "Show/01.mkv"}, map[int][]byte{0: []byte("x")})

	if got := torrentOf(t, client); got.Remote != nil {
		t.Errorf("remote still reported once the service has the files: %+v", got.Remote)
	}
}

func TestServiceWithoutHashesOrFilesInItsListing(t *testing.T) {
	fake := newFake(t)
	fake.hideHash, fake.partial = true, true
	client := newClient(t, fake)
	save := t.TempDir()

	if err := client.Add(context.Background(), qbittorrent.AddRequest{Magnet: magnet, SavePath: save}); err != nil {
		t.Fatal(err)
	}
	fake.finish(map[int]string{0: "Show/01.mkv"}, map[int][]byte{0: []byte("data")})

	waitFor(t, "the file", func() bool { return torrentOf(t, client).Progress == 1 })

	if _, err := os.Stat(filepath.Join(save, "Show", "01.mkv")); err != nil {
		t.Fatalf("file missing: %v", err)
	}

	// Once ready, the files are asked for once, not on every poll.
	fake.mu.Lock()
	before := fake.details
	fake.mu.Unlock()
	for range 3 {
		torrentOf(t, client)
	}
	fake.mu.Lock()
	after := fake.details
	fake.mu.Unlock()
	if after != before {
		t.Errorf("details asked %d more times for a ready torrent", after-before)
	}

	if err := client.Delete(context.Background(), hash, false); err != nil {
		t.Fatal(err)
	}
	if len(fake.deleted) != 1 || fake.deleted[0] != "1" {
		t.Errorf("deleted = %v, want the transfer found by its ID", fake.deleted)
	}
}

func TestWaitingTorrentIsStartedOnce(t *testing.T) {
	fake := newFake(t)
	fake.waiting = true
	client := newClient(t, fake)

	if err := client.Add(context.Background(), qbittorrent.AddRequest{Magnet: magnet, SavePath: t.TempDir()}); err != nil {
		t.Fatal(err)
	}

	torrentOf(t, client)

	// Still waiting as far as the service says: not started again so soon.
	fake.mu.Lock()
	fake.remotes[hash].Waiting = true
	fake.mu.Unlock()
	torrentOf(t, client)

	fake.mu.Lock()
	defer fake.mu.Unlock()
	if fake.starts != 1 {
		t.Errorf("started %d times, want once", fake.starts)
	}
}

func TestServiceGivingUpIsAnError(t *testing.T) {
	fake := newFake(t)
	client := newClient(t, fake)

	if err := client.Add(context.Background(), qbittorrent.AddRequest{Magnet: magnet, SavePath: t.TempDir()}); err != nil {
		t.Fatal(err)
	}

	fake.mu.Lock()
	fake.remotes[hash].Failed = "Fake: no seeds"
	fake.mu.Unlock()

	got := torrentOf(t, client)
	if got.State != "error" || got.Remote == nil || got.Remote.Error != "Fake: no seeds" {
		t.Errorf("failed: %+v remote %+v", got, got.Remote)
	}
}

func TestNoCacheCheckMeansNoAnswer(t *testing.T) {
	client := newClient(t, noCache{newFake(t)})

	cached, err := client.Cached(context.Background(), []string{hash})
	if err != nil || cached != nil {
		t.Errorf("cached = %v, %v; want nothing and no error", cached, err)
	}
}

type noCache struct{ *fakeProvider }

func (noCache) Cached(context.Context, []string) (map[string]bool, error) {
	return nil, ErrNoCacheCheck
}

func ExampleRemote() {
	fmt.Println(safePath("Show/01.mkv"), safePath("../x"))
	// Output: true false
}
