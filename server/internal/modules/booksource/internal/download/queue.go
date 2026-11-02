package download

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

// MaxBookBytes is the largest file the queue keeps. A book is a few megabytes; a
// scanned PDF can reach a hundred.
const MaxBookBytes = 200 << 20

// One progress event per interval, not one per chunk read.
const progressInterval = 300 * time.Millisecond

// A free name is looked for among this many copies before the download gives up.
const maxCopies = 99

// ContentBooks is the library folder content a book is saved into.
const ContentBooks = "books"

// Source is where books are downloaded from.
type Source interface {
	Open(ctx context.Context, ref, location string) (io.ReadCloser, error)
}

// Library is the library module, through a port: where its folders are, what
// they hold, how the node's own folder joins it, and how a new file joins it.
type Library interface {
	RootPath(ctx context.Context, rootID int64) (path string, found bool, err error)
	RootContent(ctx context.Context, rootID int64) (content string, found bool, err error)
	EnsureRootOf(ctx context.Context, path, content string) (rootID int64, relDir string, err error)
	ImportFile(ctx context.Context, rootID int64, relPath, mediaRef string, episode *int) (int64, error)
}

type Queue struct {
	store   *store.Store
	source  Source
	library Library
	hub     *events.Hub
	logger  zerolog.Logger
	now     func() time.Time
	// defaultDir is where books go while the user has chosen no folder; empty
	// when the node has none.
	defaultDir string
	// maxBytes is MaxBookBytes; tests lower it.
	maxBytes int64

	wake chan struct{}

	mu      sync.Mutex
	current int64
	cancel  context.CancelFunc

	// When each download last reported progress.
	lastProgress sync.Map
}

func New(st *store.Store, source Source, library Library, defaultDir string, hub *events.Hub, logger zerolog.Logger) *Queue {
	return &Queue{
		store:      st,
		source:     source,
		library:    library,
		hub:        hub,
		logger:     logger,
		now:        time.Now,
		defaultDir: defaultDir,
		maxBytes:   MaxBookBytes,
		wake:       make(chan struct{}, 1),
	}
}

// Start resumes what a stopped node left in the queue and works through it until
// ctx ends. One book at a time: nothing here is urgent, and the sources are
// libraries, not CDNs.
func (q *Queue) Start(ctx context.Context) {
	interrupted, err := q.store.RequeueRunning(ctx, q.now())
	if err != nil {
		q.logger.Error().Err(err).Msg("could not resume the book queue")
	}

	for i := range interrupted {
		q.removePartial(ctx, &interrupted[i])
	}

	go q.loop(ctx)
}

func (q *Queue) loop(ctx context.Context) {
	for {
		item, err := q.store.NextQueued(ctx)
		if err != nil {
			q.logger.Error().Err(err).Msg("could not read the book queue")
		}

		if item == nil {
			select {
			case <-ctx.Done():
				return
			case <-q.wake:
				continue
			case <-time.After(time.Minute):
				continue
			}
		}

		q.process(ctx, item)

		if ctx.Err() != nil {
			return
		}
	}
}

func (q *Queue) signal() {
	select {
	case q.wake <- struct{}{}:
	default:
	}
}

func (q *Queue) process(ctx context.Context, item *store.Download) {
	itemCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	q.mu.Lock()
	q.current, q.cancel = item.ID, cancel
	q.mu.Unlock()

	defer func() {
		q.mu.Lock()
		q.current, q.cancel = 0, nil
		q.mu.Unlock()
	}()

	q.setState(ctx, item, store.DownloadRunning, "")

	err := q.run(itemCtx, item)

	switch {
	case err == nil:
		q.setState(ctx, item, store.DownloadDone, "")
	case ctx.Err() != nil:
		// The node is stopping; Start puts the book back in the queue next time.
	case itemCtx.Err() != nil:
		q.setState(ctx, item, store.DownloadCancelled, "")
	default:
		q.logger.Warn().Err(err).Str("edition", item.EditionRef).Msg("book download failed")
		q.setState(ctx, item, store.DownloadFailed, reasonOf(err))
	}
}

// reasonOf is what the user reads about a failed download: a source's own
// message without its kind and causes, or the queue's error as it is. Only an
// error the source returned as it is counts: one the queue wrapped says more
// than its cause.
func reasonOf(err error) string {
	if appErr, ok := err.(*apperr.Error); ok { //nolint:errorlint // see above
		return appErr.Message
	}

	return err.Error()
}

func (q *Queue) run(ctx context.Context, item *store.Download) error {
	rootPath, found, err := q.library.RootPath(ctx, item.RootID)
	if err != nil {
		return err
	}
	if !found {
		return errors.New("the folder for books is no longer in the library")
	}

	relPath, err := q.target(rootPath, item)
	if err != nil {
		return err
	}
	target := filepath.Join(rootPath, filepath.FromSlash(relPath))

	if targetErr := q.store.SetTarget(ctx, item.ID, relPath, item.BytesTotal, q.now()); targetErr != nil {
		return targetErr
	}
	item.RelPath = relPath

	// A file at the name this download chose is the one it wrote before the node
	// stopped; it only needs to be in the library.
	if _, statErr := os.Stat(target); statErr != nil {
		if writeErr := q.write(ctx, item, target); writeErr != nil {
			return writeErr
		}
	}

	fileID, err := q.library.ImportFile(ctx, item.RootID, relPath, item.MediaRef, nil)
	if err != nil {
		return fmt.Errorf("the book was saved but not added to the library: %w", err)
	}

	if fileErr := q.store.SetFile(ctx, item.ID, fileID, q.now()); fileErr != nil {
		return fileErr
	}
	item.FileID = fileID

	return nil
}

// target is the path the book is saved at. A download that already chose one
// keeps it; otherwise it is the first name not taken by a file the user has,
// so nothing of theirs is ever overwritten.
func (q *Queue) target(rootPath string, item *store.Download) (string, error) {
	if item.RelPath != "" {
		return item.RelPath, nil
	}

	author, _, _ := strings.Cut(item.Authors, ", ")

	for copyNumber := 1; copyNumber <= maxCopies; copyNumber++ {
		name := FileName(author, item.Title, item.Ext, copyNumber)
		path := filepath.Join(rootPath, name)

		if _, err := os.Stat(path); err == nil {
			continue
		}
		if _, err := os.Stat(path + ".part"); err == nil {
			continue
		}

		return name, nil
	}

	return "", fmt.Errorf("there are already %d copies of %q in the folder", maxCopies, item.Title)
}

// write saves the book beside its final name and renames it into place, so a
// half-written file never sits in the library looking like a book.
func (q *Queue) write(ctx context.Context, item *store.Download, target string) error {
	if !Extensions[item.Ext] {
		return fmt.Errorf("%s is not a book format the library keeps", item.Ext)
	}

	if err := os.MkdirAll(filepath.Dir(target), 0o750); err != nil {
		return fmt.Errorf("create %s: %w", filepath.Dir(target), err)
	}

	body, err := q.source.Open(ctx, item.EditionRef, item.Location)
	if err != nil {
		return err
	}
	defer func() { _ = body.Close() }()

	reader := bufio.NewReaderSize(body, sniffBytes)

	// A short file shows all it has; a missing one shows nothing and fails below.
	head, peekErr := reader.Peek(sniffBytes)
	if peekErr != nil && !errors.Is(peekErr, io.EOF) && !errors.Is(peekErr, bufio.ErrBufferFull) {
		return fmt.Errorf("read the book: %w", peekErr)
	}
	if signErr := checkSignature(item.Ext, head); signErr != nil {
		return signErr
	}

	partial := target + ".part"
	defer func() { _ = os.Remove(partial) }()

	file, err := os.OpenFile(partial, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o640) //nolint:gosec // a name this queue built inside the folder for books
	if err != nil {
		return fmt.Errorf("create %s: %w", partial, err)
	}

	counter := &progressWriter{report: func(done int64) { q.progress(ctx, item, done, false) }}
	written, copyErr := io.Copy(io.MultiWriter(file, counter), io.LimitReader(reader, q.maxBytes+1))
	closeErr := file.Close()

	switch {
	case copyErr != nil:
		return fmt.Errorf("download the book: %w", copyErr)
	case closeErr != nil:
		return fmt.Errorf("save the book: %w", closeErr)
	case written > q.maxBytes:
		return fmt.Errorf("the book is larger than %d MB", q.maxBytes>>20)
	}

	q.progress(ctx, item, written, true)

	if err := os.Rename(partial, target); err != nil {
		return fmt.Errorf("move the book into place: %w", err)
	}

	return nil
}

type progressWriter struct {
	done   int64
	report func(done int64)
}

func (p *progressWriter) Write(b []byte) (int, error) {
	p.done += int64(len(b))
	p.report(p.done)

	return len(b), nil
}

func (q *Queue) progress(ctx context.Context, item *store.Download, done int64, force bool) {
	now := q.now()
	if last, ok := q.lastProgress.Load(item.ID); ok && !force {
		if at, isTime := last.(time.Time); isTime && now.Sub(at) < progressInterval {
			return
		}
	}

	q.lastProgress.Store(item.ID, now)

	if err := q.store.SetProgress(ctx, item.ID, done, now); err != nil {
		q.logger.Debug().Err(err).Msg("save book download progress")
	}

	item.BytesDone = done
	q.publish(item, store.DownloadRunning)
}

func (q *Queue) setState(ctx context.Context, item *store.Download, state, reason string) {
	// The state is written even when the request that caused it has gone.
	if err := q.store.SetState(context.WithoutCancel(ctx), item.ID, state, reason, q.now()); err != nil {
		q.logger.Error().Err(err).Int64("download", item.ID).Msg("could not save a book download's state")
	}

	if state != store.DownloadRunning {
		q.lastProgress.Delete(item.ID)
	}

	item.Error = reason
	q.publish(item, state)
}

func (q *Queue) publish(item *store.Download, state string) {
	if q.hub == nil {
		return
	}

	q.hub.Publish(events.TopicBookDownload, map[string]any{
		"id":          item.ID,
		"edition_ref": item.EditionRef,
		"media_ref":   item.MediaRef,
		"state":       state,
		"bytes_done":  item.BytesDone,
		"bytes_total": item.BytesTotal,
		"file_id":     item.FileID,
		"error":       item.Error,
	})
}

func (q *Queue) removePartial(ctx context.Context, item *store.Download) {
	if item.RelPath == "" {
		return
	}

	rootPath, found, err := q.library.RootPath(ctx, item.RootID)
	if err != nil || !found {
		return
	}

	_ = os.Remove(filepath.Join(rootPath, filepath.FromSlash(item.RelPath)) + ".part")
}

// NewBook is a book to queue, as the module's search found it.
type NewBook = store.NewDownload

// Enqueue adds a book to the queue, into the folder chosen for books.
func (q *Queue) Enqueue(ctx context.Context, book NewBook) (*store.Download, error) {
	rootID, err := q.downloadRoot(ctx)
	if err != nil {
		return nil, err
	}

	book.RootID = rootID

	item, err := q.store.Enqueue(ctx, book, q.now())
	if err != nil {
		return nil, err
	}

	q.publish(item, item.State)
	q.signal()

	return item, nil
}

// downloadRoot is the library folder a new book goes to: the one the user chose,
// or else the node's own folder for books, made part of the library as a folder
// of books the first time it is needed — also when the chosen one has left the
// library.
func (q *Queue) downloadRoot(ctx context.Context) (int64, error) {
	rootID, err := q.store.DownloadRoot(ctx)
	if err != nil {
		return 0, err
	}

	if rootID != 0 {
		_, found, contentErr := q.library.RootContent(ctx, rootID)
		if contentErr != nil {
			return 0, contentErr
		}
		if found || q.defaultDir == "" {
			return rootID, q.checkRoot(ctx, rootID)
		}
	}

	if q.defaultDir == "" {
		return 0, apperr.New(apperr.KindPrecondition, "choose a library folder for books first")
	}

	rootID, _, err = q.library.EnsureRootOf(ctx, q.defaultDir, ContentBooks)
	if err != nil {
		return 0, err
	}

	// The default folder may sit inside a root the user added for something else.
	return rootID, q.checkRoot(ctx, rootID)
}

// checkRoot refuses a folder that is gone or holds something other than books:
// the library would not keep a book saved into a folder of anime.
func (q *Queue) checkRoot(ctx context.Context, rootID int64) error {
	content, found, err := q.library.RootContent(ctx, rootID)
	if err != nil {
		return err
	}
	if !found {
		return apperr.New(apperr.KindPrecondition, "the folder for books is no longer in the library; choose another")
	}
	if content != ContentBooks {
		return apperr.New(apperr.KindPrecondition, "the folder for books holds %s; choose a folder of books", content)
	}

	return nil
}

// Cancel stops a running download or takes a queued one out of the queue.
func (q *Queue) Cancel(ctx context.Context, id int64) error {
	q.mu.Lock()
	if q.current == id && q.cancel != nil {
		q.cancel()
		q.mu.Unlock()

		return nil
	}
	q.mu.Unlock()

	item, err := q.store.Download(ctx, id)
	if err != nil {
		return err
	}
	if item == nil {
		return apperr.New(apperr.KindNotFound, "download %d does not exist", id)
	}
	if item.State != store.DownloadQueued {
		return apperr.New(apperr.KindConflict, "download %d is %s, not queued", id, item.State)
	}

	q.setState(ctx, item, store.DownloadCancelled, "")

	return nil
}

// Retry puts a failed or cancelled download back in the queue.
func (q *Queue) Retry(ctx context.Context, id int64) error {
	retried, err := q.store.Retry(ctx, id, q.now())
	if err != nil {
		return err
	}
	if !retried {
		return apperr.New(apperr.KindConflict, "download %d is not failed or cancelled", id)
	}

	q.signal()

	if item, err := q.store.Download(ctx, id); err == nil && item != nil {
		q.publish(item, item.State)
	}

	return nil
}

// Forget removes a finished download from the list. The file stays where it is.
func (q *Queue) Forget(ctx context.Context, id int64) error {
	deleted, err := q.store.DeleteFinished(ctx, id)
	if err != nil {
		return err
	}
	if !deleted {
		return apperr.New(apperr.KindConflict, "download %d is still queued or running", id)
	}

	return nil
}

// List is the queue and the recent downloads, newest first.
func (q *Queue) List(ctx context.Context) ([]store.Download, error) {
	return q.store.Downloads(ctx, 200)
}

// Root is the library folder books go to, or 0 while none is chosen.
func (q *Queue) Root(ctx context.Context) (int64, error) {
	return q.store.DownloadRoot(ctx)
}

// DefaultFolder is where books go while no folder is chosen; empty when the node
// has none.
func (q *Queue) DefaultFolder() string {
	return q.defaultDir
}

func (q *Queue) SetRoot(ctx context.Context, rootID int64) error {
	content, found, err := q.library.RootContent(ctx, rootID)
	if err != nil {
		return err
	}
	if !found {
		return apperr.New(apperr.KindNotFound, "library folder %d does not exist", rootID)
	}
	if content != ContentBooks {
		return apperr.Invalid("root_id", "library folder %d holds %s, not books", rootID, content)
	}

	return q.store.SetDownloadRoot(ctx, rootID)
}
