package download

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/manga/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

// The largest archive a source may hand over whole, the same as the client's.
const maxArchiveBytes = 1 << 30

// One progress event per interval; a chapter of small pages would otherwise send
// one for every page.
const progressInterval = 300 * time.Millisecond

// Chapter is what a source says about a chapter before it is downloaded.
type Chapter struct {
	MediaRef   string
	Series     string
	Title      string
	Number     string
	SourceName string
	Pages      int
	// Archive is true when the source can hand the chapter over as one CBZ.
	Archive bool
}

// Source is where chapters are downloaded from.
type Source interface {
	Describe(ctx context.Context, ref string) (*Chapter, error)
	Page(ctx context.Context, ref string, index int) (data []byte, contentType string, err error)
	Archive(ctx context.Context, ref string) (io.ReadCloser, error)
}

// ContentManga is the library folder content the node's own folder for chapters
// is added as.
const ContentManga = "manga"

// Library is the library module, through a port: where its folders are, how the
// node's own folder joins it, and how a new file joins it.
type Library interface {
	RootPath(ctx context.Context, rootID int64) (path string, found bool, err error)
	EnsureRootOf(ctx context.Context, path, content string) (rootID int64, relDir string, err error)
	ImportFile(ctx context.Context, rootID int64, relPath, mediaRef string, chapter *int) (int64, error)
}

type Queue struct {
	store   *store.Store
	source  Source
	library Library
	hub     *events.Hub
	logger  zerolog.Logger
	now     func() time.Time
	// defaultDir is where chapters go while the user has chosen no folder; empty
	// when the node has none.
	defaultDir string

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
		wake:       make(chan struct{}, 1),
	}
}

// Start resumes what a stopped node left in the queue and works through it until
// ctx ends. One chapter at a time: a download is not urgent, and the user's
// server is not a CDN.
func (q *Queue) Start(ctx context.Context) {
	interrupted, err := q.store.RequeueRunning(ctx, q.now())
	if err != nil {
		q.logger.Error().Err(err).Msg("could not resume the download queue")
	}

	for i := range interrupted {
		q.removePartial(ctx, interrupted[i])
	}

	go q.loop(ctx)
}

func (q *Queue) loop(ctx context.Context) {
	for {
		item, err := q.store.NextQueued(ctx)
		if err != nil {
			q.logger.Error().Err(err).Msg("could not read the download queue")
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

		q.process(ctx, *item)

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

func (q *Queue) process(ctx context.Context, item store.Download) {
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
		// The node is stopping; Start puts the chapter back in the queue next time.
	case itemCtx.Err() != nil:
		q.setState(ctx, item, store.DownloadCancelled, "")
	default:
		q.logger.Warn().Err(err).Str("chapter", item.ChapterRef).Msg("download failed")
		q.setState(ctx, item, store.DownloadFailed, err.Error())
	}
}

func (q *Queue) run(ctx context.Context, item store.Download) error {
	rootPath, found, err := q.library.RootPath(ctx, item.RootID)
	if err != nil {
		return err
	}
	if !found {
		return errors.New("the download folder is no longer in the library")
	}

	chapter, err := q.source.Describe(ctx, item.ChapterRef)
	if err != nil {
		return err
	}

	relPath := RelPath(item.Series, item.Number, item.Title)
	target := filepath.Join(rootPath, filepath.FromSlash(relPath))

	if err := q.store.SetTarget(ctx, item.ID, relPath, chapter.Pages, q.now()); err != nil {
		return err
	}
	item.RelPath, item.PagesTotal = relPath, chapter.Pages

	// A chapter already on disk under its name is the one asked for; it only needs
	// to be in the library.
	if _, statErr := os.Stat(target); statErr != nil {
		if err := q.write(ctx, item, chapter, target); err != nil {
			return err
		}
	}

	q.progress(ctx, item, chapter.Pages, true)

	if _, err := q.library.ImportFile(ctx, item.RootID, relPath, item.MediaRef, wholeChapter(item.Number)); err != nil {
		return fmt.Errorf("the chapter was saved but not added to the library: %w", err)
	}

	return nil
}

// write saves the chapter beside its final name and renames it into place, so a
// half-written file never sits in the library looking like a chapter.
func (q *Queue) write(ctx context.Context, item store.Download, chapter *Chapter, target string) error {
	if err := os.MkdirAll(filepath.Dir(target), 0o750); err != nil {
		return fmt.Errorf("create %s: %w", filepath.Dir(target), err)
	}

	partial := target + ".part"
	defer func() { _ = os.Remove(partial) }()

	if chapter.Archive {
		body, err := q.source.Archive(ctx, item.ChapterRef)
		if err != nil {
			return err
		}

		copyErr := copyArchive(partial, body, maxArchiveBytes)
		_ = body.Close()
		if copyErr != nil {
			return copyErr
		}
	} else {
		info := comicInfo{
			Series:    item.Series,
			Number:    item.Number,
			Title:     item.Title,
			PageCount: chapter.Pages,
			Notes:     "Saved by Mediary from " + item.SourceName,
		}

		fetch := func(ctx context.Context, index int) ([]byte, string, error) {
			return q.source.Page(ctx, item.ChapterRef, index)
		}

		err := writePages(ctx, partial, info, chapter.Pages, fetch, func(done int) {
			q.progress(ctx, item, done, false)
		})
		if err != nil {
			return err
		}
	}

	if err := os.Rename(partial, target); err != nil {
		return fmt.Errorf("move the chapter into place: %w", err)
	}

	return nil
}

func (q *Queue) progress(ctx context.Context, item store.Download, done int, force bool) {
	now := q.now()
	if last, ok := q.lastProgress.Load(item.ID); ok && !force {
		if at, isTime := last.(time.Time); isTime && now.Sub(at) < progressInterval {
			return
		}
	}

	q.lastProgress.Store(item.ID, now)

	if err := q.store.SetProgress(ctx, item.ID, done, now); err != nil {
		q.logger.Debug().Err(err).Msg("save download progress")
	}

	item.PagesDone = done
	q.publish(item, store.DownloadRunning)
}

func (q *Queue) setState(ctx context.Context, item store.Download, state, reason string) {
	// The state is written even when the request that caused it has gone.
	if err := q.store.SetState(context.WithoutCancel(ctx), item.ID, state, reason, q.now()); err != nil {
		q.logger.Error().Err(err).Int64("download", item.ID).Msg("could not save a download's state")
	}

	if state != store.DownloadRunning {
		q.lastProgress.Delete(item.ID)
	}

	item.Error = reason
	q.publish(item, state)
}

func (q *Queue) publish(item store.Download, state string) {
	if q.hub == nil {
		return
	}

	q.hub.Publish(events.TopicMangaDownload, map[string]any{
		"id":          item.ID,
		"chapter_ref": item.ChapterRef,
		"media_ref":   item.MediaRef,
		"state":       state,
		"pages_done":  item.PagesDone,
		"pages_total": item.PagesTotal,
		"error":       item.Error,
	})
}

func (q *Queue) removePartial(ctx context.Context, item store.Download) {
	if item.RelPath == "" {
		return
	}

	rootPath, found, err := q.library.RootPath(ctx, item.RootID)
	if err != nil || !found {
		return
	}

	_ = os.Remove(filepath.Join(rootPath, filepath.FromSlash(item.RelPath)) + ".part")
}

// Enqueue adds chapters to the queue, into the folder chosen for downloads.
func (q *Queue) Enqueue(ctx context.Context, refs []string) ([]store.Download, error) {
	rootID, err := q.downloadRoot(ctx)
	if err != nil {
		return nil, err
	}

	queued := make([]store.Download, 0, len(refs))

	for _, ref := range refs {
		chapter, err := q.source.Describe(ctx, ref)
		if err != nil {
			return nil, err
		}
		if chapter.MediaRef == "" {
			return nil, apperr.New(apperr.KindPrecondition, "link the series to a title before downloading from it")
		}

		item, err := q.store.Enqueue(ctx, store.NewDownload{
			ChapterRef: ref,
			MediaRef:   chapter.MediaRef,
			Series:     chapter.Series,
			Title:      chapter.Title,
			Number:     chapter.Number,
			SourceName: chapter.SourceName,
			RootID:     rootID,
		}, q.now())
		if err != nil {
			return nil, err
		}

		queued = append(queued, *item)
		q.publish(*item, item.State)
	}

	q.signal()

	return queued, nil
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

	q.setState(ctx, *item, store.DownloadCancelled, "")

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
		q.publish(*item, item.State)
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

// wholeChapter is the number a downloaded file is matched to. The library counts
// whole chapters; an extra such as 12.5 joins the title without a number.
func wholeChapter(number string) *int {
	value, err := strconv.ParseFloat(strings.TrimSpace(number), 64)
	if err != nil || value <= 0 || value != math.Trunc(value) || value > math.MaxInt32 {
		return nil
	}

	whole := int(value)

	return &whole
}

// List is the queue and the recent downloads, newest first.
func (q *Queue) List(ctx context.Context) ([]store.Download, error) {
	return q.store.Downloads(ctx, 200)
}

// downloadRoot is the library folder new chapters go to: the one the user chose,
// or else the node's own folder for manga, made part of the library the first
// time it is needed — also when the chosen one has left the library. A default
// folder inside another root saves into that root.
func (q *Queue) downloadRoot(ctx context.Context) (int64, error) {
	rootID, err := q.store.DownloadRoot(ctx)
	if err != nil {
		return 0, err
	}

	if rootID != 0 {
		_, found, pathErr := q.library.RootPath(ctx, rootID)
		if pathErr != nil {
			return 0, pathErr
		}
		if found {
			return rootID, nil
		}
		if q.defaultDir == "" {
			return 0, apperr.New(apperr.KindPrecondition, "the download folder is no longer in the library; choose another")
		}
	}

	if q.defaultDir == "" {
		return 0, apperr.New(apperr.KindPrecondition, "choose a library folder for downloads first")
	}

	rootID, _, err = q.library.EnsureRootOf(ctx, q.defaultDir, ContentManga)

	return rootID, err
}

// Root is the library folder downloads go to, or 0 while none is chosen.
func (q *Queue) Root(ctx context.Context) (int64, error) {
	return q.store.DownloadRoot(ctx)
}

// DefaultFolder is where chapters go while no folder is chosen; empty when the
// node has none.
func (q *Queue) DefaultFolder() string {
	return q.defaultDir
}

func (q *Queue) SetRoot(ctx context.Context, rootID int64) error {
	_, found, err := q.library.RootPath(ctx, rootID)
	if err != nil {
		return err
	}
	if !found {
		return apperr.New(apperr.KindNotFound, "library folder %d does not exist", rootID)
	}

	return q.store.SetDownloadRoot(ctx, rootID)
}
