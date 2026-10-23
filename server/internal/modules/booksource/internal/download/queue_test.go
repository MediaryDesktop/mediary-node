package download

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/db"
)

var epub = []byte("PK\x03\x04mimetypeapplication/epub+zip and the rest of the book")

type fakeSource struct {
	mu     sync.Mutex
	files  map[string][]byte
	opened []string
	// fail, when set, is what Open answers.
	fail error
	// wait holds Open until it is closed, or the download is cancelled.
	wait chan struct{}
}

func (f *fakeSource) Open(ctx context.Context, ref, location string) (io.ReadCloser, error) {
	if f.wait != nil {
		select {
		case <-f.wait:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

	f.mu.Lock()
	defer f.mu.Unlock()

	f.opened = append(f.opened, ref+" "+location)

	if f.fail != nil {
		return nil, f.fail
	}

	data, ok := f.files[ref]
	if !ok {
		return nil, errors.New("the source has no such file")
	}

	return io.NopCloser(bytes.NewReader(data)), nil
}

type imported struct {
	relPath  string
	mediaRef string
	episode  *int
}

type fakeLibrary struct {
	root    string
	content string

	mu       sync.Mutex
	imported []imported
}

func (f *fakeLibrary) RootPath(_ context.Context, rootID int64) (path string, found bool, err error) {
	return f.root, rootID == 1, nil
}

func (f *fakeLibrary) RootContent(_ context.Context, rootID int64) (content string, found bool, err error) {
	return f.content, rootID == 1, nil
}

func (f *fakeLibrary) ImportFile(_ context.Context, _ int64, relPath, mediaRef string, episode *int) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.imported = append(f.imported, imported{relPath: relPath, mediaRef: mediaRef, episode: episode})

	return 42, nil
}

type harness struct {
	queue   *Queue
	store   *store.Store
	source  *fakeSource
	library *fakeLibrary
}

func newHarness(t *testing.T) *harness {
	t.Helper()

	ctx := context.Background()
	dir := t.TempDir()

	database, err := db.Open(ctx, filepath.Join(dir, "node.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = database.Close() })

	if err := db.Migrate(ctx, database, zerolog.Nop()); err != nil {
		t.Fatal(err)
	}

	st := store.New(database)
	if err := st.SetDownloadRoot(ctx, 1); err != nil {
		t.Fatal(err)
	}

	library := &fakeLibrary{root: filepath.Join(dir, "books"), content: ContentBooks}
	if err := os.MkdirAll(library.root, 0o750); err != nil {
		t.Fatal(err)
	}

	source := &fakeSource{files: map[string][]byte{"gutenberg:84": epub}}

	return &harness{
		queue:   New(st, source, library, nil, zerolog.Nop()),
		store:   st,
		source:  source,
		library: library,
	}
}

func (h *harness) start(t *testing.T) {
	t.Helper()

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	h.queue.Start(ctx)
}

func frankenstein() NewBook {
	return NewBook{
		EditionRef: "gutenberg:84",
		Format:     "application/epub+zip",
		Ext:        ".epub",
		Location:   "cache/epub/84/pg84-images-3.epub",
		MediaRef:   "openlibrary:OL450063W",
		Title:      "Frankenstein; Or, The Modern Prometheus",
		Authors:    "Mary Wollstonecraft Shelley, Percy Bysshe Shelley",
		SourceName: "Project Gutenberg",
		Size:       int64(len(epub)),
	}
}

func (h *harness) enqueue(t *testing.T, book NewBook) *store.Download {
	t.Helper()

	item, err := h.queue.Enqueue(context.Background(), book)
	if err != nil {
		t.Fatal(err)
	}

	return item
}

// wait returns the download once it reaches one of the states.
func (h *harness) wait(t *testing.T, id int64, states ...string) *store.Download {
	t.Helper()

	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		item, err := h.store.Download(context.Background(), id)
		if err != nil {
			t.Fatal(err)
		}
		for _, state := range states {
			if item != nil && item.State == state {
				return item
			}
		}

		time.Sleep(10 * time.Millisecond)
	}

	item, _ := h.store.Download(context.Background(), id)
	t.Fatalf("download %d did not reach %v: %+v", id, states, item)

	return nil
}

// files lists what is in the folder for books.
func (h *harness) files(t *testing.T) []string {
	t.Helper()

	entries, err := os.ReadDir(h.library.root)
	if err != nil {
		t.Fatal(err)
	}

	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		names = append(names, entry.Name())
	}

	return names
}

func TestABookIsSavedAndJoinsTheLibrary(t *testing.T) {
	h := newHarness(t)
	h.start(t)

	item := h.wait(t, h.enqueue(t, frankenstein()).ID, store.DownloadDone, store.DownloadFailed)
	if item.State != store.DownloadDone {
		t.Fatalf("download = %+v", item)
	}

	// The first author names the file; the rest are in the book itself.
	name := "Mary Wollstonecraft Shelley - Frankenstein; Or, The Modern Prometheus.epub"
	data, err := os.ReadFile(filepath.Join(h.library.root, name))
	if err != nil || !bytes.Equal(data, epub) {
		t.Fatalf("saved %q, %v; folder has %v", data, err, h.files(t))
	}
	if files := h.files(t); len(files) != 1 {
		t.Errorf("folder has %v; want the book alone", files)
	}

	if item.RelPath != name || item.FileID != 42 || item.BytesDone != int64(len(epub)) {
		t.Errorf("download = %+v", item)
	}

	// Joined the library as the book the search was for, without an episode.
	if len(h.library.imported) != 1 || h.library.imported[0] != (imported{relPath: name, mediaRef: "openlibrary:OL450063W"}) {
		t.Errorf("imported = %+v", h.library.imported)
	}

	// The file came from where the search said, not from anywhere a client named.
	if len(h.source.opened) != 1 || h.source.opened[0] != "gutenberg:84 cache/epub/84/pg84-images-3.epub" {
		t.Errorf("opened = %v", h.source.opened)
	}
}

func TestAFileOfTheUsersIsNeverOverwritten(t *testing.T) {
	h := newHarness(t)

	book := frankenstein()
	book.Title = "Frankenstein"
	mine := filepath.Join(h.library.root, "Mary Wollstonecraft Shelley - Frankenstein.epub")
	if err := os.WriteFile(mine, []byte("my own copy"), 0o600); err != nil {
		t.Fatal(err)
	}

	h.start(t)
	item := h.wait(t, h.enqueue(t, book).ID, store.DownloadDone, store.DownloadFailed)

	if item.State != store.DownloadDone || item.RelPath != "Mary Wollstonecraft Shelley - Frankenstein (2).epub" {
		t.Fatalf("download = %+v", item)
	}
	if data, _ := os.ReadFile(mine); string(data) != "my own copy" {
		t.Errorf("the user's file now holds %q", data)
	}
}

func TestWhatIsNotABookIsNotKept(t *testing.T) {
	h := newHarness(t)
	h.source.files["gutenberg:84"] = []byte("<!DOCTYPE html><html><body>Please log in</body></html>")
	h.start(t)

	item := h.wait(t, h.enqueue(t, frankenstein()).ID, store.DownloadDone, store.DownloadFailed)

	if item.State != store.DownloadFailed || !strings.Contains(item.Error, "not the book format") {
		t.Fatalf("download = %+v", item)
	}
	if files := h.files(t); len(files) != 0 {
		t.Errorf("folder has %v", files)
	}
	if len(h.library.imported) != 0 {
		t.Errorf("imported %+v", h.library.imported)
	}
}

// The user reads what the source says went wrong, not its addresses and causes.
func TestAFailedSourceIsReportedInItsOwnWords(t *testing.T) {
	h := newHarness(t)
	h.source.fail = apperr.Wrap(errors.New(`Get "http://127.0.0.1:43799/x.epub": dial tcp: refused`),
		apperr.KindUpstream, "Home Calibre: the server could not be reached")
	h.start(t)

	item := h.wait(t, h.enqueue(t, frankenstein()).ID, store.DownloadDone, store.DownloadFailed)

	if item.State != store.DownloadFailed || item.Error != "Home Calibre: the server could not be reached" {
		t.Fatalf("download = %+v", item)
	}
}

func TestABookOverTheLimitIsNotKept(t *testing.T) {
	h := newHarness(t)
	h.queue.maxBytes = 16
	h.start(t)

	item := h.wait(t, h.enqueue(t, frankenstein()).ID, store.DownloadDone, store.DownloadFailed)

	if item.State != store.DownloadFailed || !strings.Contains(item.Error, "larger than") {
		t.Fatalf("download = %+v", item)
	}
	if files := h.files(t); len(files) != 0 {
		t.Errorf("folder has %v", files)
	}
}

func TestQueueingNeedsAFolderOfBooks(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	h.library.content = "anime"
	if _, err := h.queue.Enqueue(ctx, frankenstein()); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Errorf("into a folder of anime: %v", err)
	}
	if err := h.queue.SetRoot(ctx, 1); apperr.KindOf(err) != apperr.KindInvalid {
		t.Errorf("choosing a folder of anime: %v", err)
	}
	if err := h.queue.SetRoot(ctx, 2); apperr.KindOf(err) != apperr.KindNotFound {
		t.Errorf("choosing a folder that is not there: %v", err)
	}

	if err := h.store.SetDownloadRoot(ctx, 0); err != nil {
		t.Fatal(err)
	}
	h.library.content = ContentBooks
	if _, err := h.queue.Enqueue(ctx, frankenstein()); apperr.KindOf(err) != apperr.KindPrecondition ||
		!strings.Contains(err.Error(), "choose a library folder for books") {
		t.Errorf("without a folder: %v", err)
	}

	if err := h.queue.SetRoot(ctx, 1); err != nil {
		t.Fatal(err)
	}
	if _, err := h.queue.Enqueue(ctx, frankenstein()); err != nil {
		t.Errorf("with a folder of books: %v", err)
	}
}

func TestACancelledDownloadLeavesNothingAndCanBeRetried(t *testing.T) {
	h := newHarness(t)
	h.source.wait = make(chan struct{})
	h.start(t)

	item := h.enqueue(t, frankenstein())
	h.wait(t, item.ID, store.DownloadRunning)

	if err := h.queue.Cancel(context.Background(), item.ID); err != nil {
		t.Fatal(err)
	}
	h.wait(t, item.ID, store.DownloadCancelled)

	if files := h.files(t); len(files) != 0 {
		t.Errorf("folder has %v", files)
	}

	close(h.source.wait)
	if err := h.queue.Retry(context.Background(), item.ID); err != nil {
		t.Fatal(err)
	}
	if done := h.wait(t, item.ID, store.DownloadDone, store.DownloadFailed); done.State != store.DownloadDone {
		t.Fatalf("after a retry: %+v", done)
	}

	// Saved once: the name it chose before is the name it keeps.
	if files := h.files(t); len(files) != 1 {
		t.Errorf("folder has %v", files)
	}
}

// A node stopped mid-download takes the book back up on its next start, and
// leaves no half-written file behind.
func TestAnInterruptedDownloadResumes(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	item := h.enqueue(t, frankenstein())
	name := "Mary Wollstonecraft Shelley - Frankenstein; Or, The Modern Prometheus.epub"
	if err := h.store.SetTarget(ctx, item.ID, name, 0, time.Now()); err != nil {
		t.Fatal(err)
	}
	if err := h.store.SetState(ctx, item.ID, store.DownloadRunning, "", time.Now()); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(h.library.root, name+".part"), []byte("PK\x03"), 0o600); err != nil {
		t.Fatal(err)
	}

	h.start(t)

	done := h.wait(t, item.ID, store.DownloadDone, store.DownloadFailed)
	if done.State != store.DownloadDone || done.RelPath != name {
		t.Fatalf("download = %+v", done)
	}
	if files := h.files(t); len(files) != 1 || files[0] != name {
		t.Errorf("folder has %v", files)
	}
}
