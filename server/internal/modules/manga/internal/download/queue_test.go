package download

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/manga/internal/store"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/db"
)

type fakeSource struct {
	chapter  Chapter
	pageErr  error
	archive  []byte
	pageWait chan struct{}
}

func (f *fakeSource) Describe(context.Context, string) (*Chapter, error) {
	chapter := f.chapter

	return &chapter, nil
}

func (f *fakeSource) Page(ctx context.Context, _ string, index int) (data []byte, contentType string, err error) {
	if f.pageWait != nil {
		select {
		case <-f.pageWait:
		case <-ctx.Done():
			return nil, "", ctx.Err()
		}
	}
	if f.pageErr != nil {
		return nil, "", f.pageErr
	}

	return []byte{0x89, 'P', 'N', 'G', byte(index)}, "image/png", nil
}

func (f *fakeSource) Archive(context.Context, string) (io.ReadCloser, error) {
	return io.NopCloser(bytes.NewReader(f.archive)), nil
}

type imported struct {
	relPath  string
	mediaRef string
	chapter  *int
}

type fakeLibrary struct {
	root string

	mu       sync.Mutex
	imported []imported
	// ensured is every folder EnsureRootOf was asked for, as path and content.
	ensured [][2]string
}

func (f *fakeLibrary) RootPath(_ context.Context, rootID int64) (path string, found bool, err error) {
	return f.root, rootID == 1, nil
}

func (f *fakeLibrary) EnsureRootOf(_ context.Context, path, content string) (rootID int64, relDir string, err error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.ensured = append(f.ensured, [2]string{path, content})

	return 1, "", nil
}

func (f *fakeLibrary) ImportFile(_ context.Context, _ int64, relPath, mediaRef string, chapter *int) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.imported = append(f.imported, imported{relPath: relPath, mediaRef: mediaRef, chapter: chapter})

	return 1, nil
}

type harness struct {
	queue   *Queue
	store   *store.Store
	source  *fakeSource
	library *fakeLibrary
}

func newHarness(t *testing.T, source *fakeSource) *harness {
	t.Helper()

	retryPause = time.Millisecond

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

	library := &fakeLibrary{root: filepath.Join(dir, "library")}

	return &harness{queue: New(st, source, library, "", nil, zerolog.Nop()), store: st, source: source, library: library}
}

func (h *harness) start(t *testing.T) {
	t.Helper()

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	h.queue.Start(ctx)
}

// wait returns the download once it reaches a state that is not queued or running.
func (h *harness) wait(t *testing.T, id int64) store.Download {
	t.Helper()

	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		item, err := h.store.Download(context.Background(), id)
		if err != nil {
			t.Fatal(err)
		}
		if item.State != store.DownloadQueued && item.State != store.DownloadRunning {
			return *item
		}
		time.Sleep(10 * time.Millisecond)
	}

	t.Fatalf("download %d never finished", id)

	return store.Download{}
}

func berserk(number string, pages int) Chapter {
	return Chapter{MediaRef: "anilist:30002", Series: "Berserk", Title: "Berserk Chapter " + number, Number: number, SourceName: "Komga", Pages: pages}
}

func entries(t *testing.T, path string) []string {
	t.Helper()

	reader, err := zip.OpenReader(path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = reader.Close() }()

	var names []string
	for _, file := range reader.File {
		names = append(names, file.Name)
	}
	sort.Strings(names)

	return names
}

func TestAChapterIsSavedPageByPageAndJoinsTheLibrary(t *testing.T) {
	h := newHarness(t, &fakeSource{chapter: berserk("12", 3)})
	h.start(t)

	queued, err := h.queue.Enqueue(context.Background(), []string{"opds:1:a"})
	if err != nil {
		t.Fatal(err)
	}

	item := h.wait(t, queued[0].ID)
	if item.State != store.DownloadDone || item.PagesDone != 3 || item.RelPath != "Berserk/Berserk - Ch. 012.cbz" {
		t.Fatalf("download = %+v", item)
	}

	target := filepath.Join(h.library.root, "Berserk", "Berserk - Ch. 012.cbz")
	if got := strings.Join(entries(t, target), ","); got != "0001.png,0002.png,0003.png,ComicInfo.xml" {
		t.Errorf("archive holds %s", got)
	}
	if _, err := os.Stat(target + ".part"); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("the partial file is still there: %v", err)
	}

	if len(h.library.imported) != 1 || h.library.imported[0].mediaRef != "anilist:30002" ||
		h.library.imported[0].chapter == nil || *h.library.imported[0].chapter != 12 {
		t.Errorf("imported = %+v", h.library.imported)
	}
}

func TestTheServersOwnArchiveIsKeptAsItIs(t *testing.T) {
	var original bytes.Buffer
	writer := zip.NewWriter(&original)
	entry, _ := writer.Create("page.jpg")
	_, _ = entry.Write([]byte("jpeg"))
	_ = writer.Close()

	chapter := berserk("13.5", 1)
	chapter.Archive = true

	h := newHarness(t, &fakeSource{chapter: chapter, archive: original.Bytes()})
	h.start(t)

	queued, err := h.queue.Enqueue(context.Background(), []string{"opds:1:b"})
	if err != nil {
		t.Fatal(err)
	}

	if item := h.wait(t, queued[0].ID); item.State != store.DownloadDone {
		t.Fatalf("download = %+v", item)
	}

	saved, err := os.ReadFile(filepath.Join(h.library.root, "Berserk", "Berserk - Ch. 013.5.cbz"))
	if err != nil || !bytes.Equal(saved, original.Bytes()) {
		t.Errorf("saved archive differs from the server's: %v", err)
	}

	// An extra joins the title without a number the library cannot hold.
	if h.library.imported[0].chapter != nil {
		t.Errorf("13.5 imported as chapter %d", *h.library.imported[0].chapter)
	}
}

func TestAPageThatKeepsFailingFailsTheChapterAndLeavesNoFile(t *testing.T) {
	h := newHarness(t, &fakeSource{chapter: berserk("12", 3), pageErr: errors.New("server said 500")})
	h.start(t)

	queued, err := h.queue.Enqueue(context.Background(), []string{"opds:1:a"})
	if err != nil {
		t.Fatal(err)
	}

	item := h.wait(t, queued[0].ID)
	if item.State != store.DownloadFailed || !strings.Contains(item.Error, "server said 500") {
		t.Fatalf("download = %+v", item)
	}

	files, _ := filepath.Glob(filepath.Join(h.library.root, "Berserk", "*"))
	if len(files) != 0 || len(h.library.imported) != 0 {
		t.Errorf("left behind %v, imported %v", files, h.library.imported)
	}

	// A failed chapter goes back in the queue when asked again.
	h.source.pageErr = nil
	if err := h.queue.Retry(context.Background(), item.ID); err != nil {
		t.Fatal(err)
	}
	if retried := h.wait(t, item.ID); retried.State != store.DownloadDone {
		t.Errorf("retried download = %+v", retried)
	}
}

func TestAnArchiveThatIsNotOneFails(t *testing.T) {
	chapter := berserk("12", 1)
	chapter.Archive = true

	h := newHarness(t, &fakeSource{chapter: chapter, archive: []byte("<html>log in</html>")})
	h.start(t)

	queued, err := h.queue.Enqueue(context.Background(), []string{"opds:1:a"})
	if err != nil {
		t.Fatal(err)
	}

	if item := h.wait(t, queued[0].ID); item.State != store.DownloadFailed {
		t.Errorf("download = %+v", item)
	}
}

func TestAnInterruptedDownloadResumesAndItsPartialFileGoes(t *testing.T) {
	h := newHarness(t, &fakeSource{chapter: berserk("12", 2)})
	ctx := context.Background()

	item, err := h.store.Enqueue(ctx, store.NewDownload{ChapterRef: "opds:1:a", MediaRef: "anilist:30002", Series: "Berserk", Number: "12", RootID: 1}, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if err := h.store.SetState(ctx, item.ID, store.DownloadRunning, "", time.Now()); err != nil {
		t.Fatal(err)
	}
	if err := h.store.SetTarget(ctx, item.ID, "Berserk/Berserk - Ch. 012.cbz", 2, time.Now()); err != nil {
		t.Fatal(err)
	}

	partial := filepath.Join(h.library.root, "Berserk", "Berserk - Ch. 012.cbz.part")
	if err := os.MkdirAll(filepath.Dir(partial), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(partial, []byte("half"), 0o600); err != nil {
		t.Fatal(err)
	}

	h.start(t)

	if done := h.wait(t, item.ID); done.State != store.DownloadDone {
		t.Fatalf("download = %+v", done)
	}
	if _, err := os.Stat(partial); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("the partial file survived: %v", err)
	}
}

func TestCancelStopsARunningDownload(t *testing.T) {
	h := newHarness(t, &fakeSource{chapter: berserk("12", 3), pageWait: make(chan struct{})})
	h.start(t)

	queued, err := h.queue.Enqueue(context.Background(), []string{"opds:1:a"})
	if err != nil {
		t.Fatal(err)
	}

	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		item, _ := h.store.Download(context.Background(), queued[0].ID)
		if item.State == store.DownloadRunning {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}

	if err := h.queue.Cancel(context.Background(), queued[0].ID); err != nil {
		t.Fatal(err)
	}

	if item := h.wait(t, queued[0].ID); item.State != store.DownloadCancelled {
		t.Errorf("download = %+v", item)
	}
}

func TestDownloadsNeedAFolderAndALinkedTitle(t *testing.T) {
	h := newHarness(t, &fakeSource{chapter: berserk("12", 1)})
	ctx := context.Background()

	if err := h.store.SetDownloadRoot(ctx, 7); err != nil {
		t.Fatal(err)
	}
	if _, err := h.queue.Enqueue(ctx, []string{"opds:1:a"}); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Errorf("unknown folder: %v", err)
	}

	if err := h.store.SetDownloadRoot(ctx, 1); err != nil {
		t.Fatal(err)
	}
	h.source.chapter.MediaRef = ""
	if _, err := h.queue.Enqueue(ctx, []string{"opds:1:a"}); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Errorf("unlinked series: %v", err)
	}
}

func TestWithNoFolderChosenChaptersGoToTheDefaultFolder(t *testing.T) {
	h := newHarness(t, &fakeSource{chapter: berserk("12", 1)})
	ctx := context.Background()

	h.queue.defaultDir = filepath.Join(t.TempDir(), "manga")

	// None chosen, then one chosen that has since left the library.
	for _, chosen := range []int64{0, 7} {
		if err := h.store.SetDownloadRoot(ctx, chosen); err != nil {
			t.Fatal(err)
		}

		queued, err := h.queue.Enqueue(ctx, []string{"opds:1:a"})
		if err != nil {
			t.Fatalf("chosen %d: %v", chosen, err)
		}
		if len(queued) != 1 || queued[0].RootID != 1 {
			t.Fatalf("chosen %d: queued = %+v", chosen, queued)
		}
	}

	want := [2]string{h.queue.defaultDir, ContentManga}
	if len(h.library.ensured) != 2 || h.library.ensured[0] != want || h.library.ensured[1] != want {
		t.Fatalf("ensured = %v, want %v twice", h.library.ensured, want)
	}
}

func TestRelPath(t *testing.T) {
	for _, tt := range []struct{ series, number, title, want string }{
		{"Berserk", "12", "", "Berserk/Berserk - Ch. 012.cbz"},
		{"Berserk", "13.5", "", "Berserk/Berserk - Ch. 013.5.cbz"},
		{"Berserk", "1050", "", "Berserk/Berserk - Ch. 1050.cbz"},
		{"Berserk", "", "Prototype", "Berserk/Berserk - Prototype.cbz"},
		{"Re:Zero / Part 2?", "1", "", "Re Zero Part 2/Re Zero Part 2 - Ch. 001.cbz"},
		{"CON", "1", "", "_CON/_CON - Ch. 001.cbz"},
		{"", "", "", "Manga/Manga - Extra.cbz"},
	} {
		if got := RelPath(tt.series, tt.number, tt.title); got != tt.want {
			t.Errorf("RelPath(%q, %q, %q) = %q, want %q", tt.series, tt.number, tt.title, got, tt.want)
		}
	}
}
