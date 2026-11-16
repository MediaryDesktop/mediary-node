// Package service is where the user is in what they watch and read: each
// episode's position and whether it was watched through, each chapter's page,
// each book's place. The number on the user's list is the tracker's; this is
// everything under it.
package service

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/progress/internal/store"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/events"
)

type (
	WatchKey   = store.WatchKey
	ChapterKey = store.ChapterKey
	Book       = store.Book
)

const (
	// Before this point, starting over costs nothing worth keeping.
	resumeMinimum = 30.0

	// Past this share of the file there is only the end left to see: the next
	// play starts over rather than in the credits.
	resumeMaxFraction = 0.9

	// How many begun episodes "continue watching" offers at most.
	maxContinue = 50
)

type Service struct {
	store  *store.Store
	hub    *events.Hub
	logger zerolog.Logger
	now    func() time.Time

	// One writer at a time: every save reads the row, decides, and writes it
	// back, and two reports at once must not both count the same pass.
	mu sync.Mutex
}

func New(st *store.Store, hub *events.Hub, logger zerolog.Logger, now func() time.Time) *Service {
	if now == nil {
		now = time.Now
	}

	return &Service{store: st, hub: hub, logger: logger, now: now}
}

// EpisodeState is one episode as the title page shows it.
type EpisodeState struct {
	Episode       int        `json:"episode" doc:"Episode number across seasons, as the user's list counts it."`
	Position      float64    `json:"position" doc:"Where the user stopped, in seconds."`
	Duration      float64    `json:"duration" doc:"Length of the episode, in seconds; zero when no player reported it."`
	Watched       bool       `json:"watched" doc:"True once it was watched through, or marked so by hand."`
	WatchCount    int        `json:"watch_count" doc:"How many times it was watched through."`
	LastWatchedAt *time.Time `json:"last_watched_at,omitempty" doc:"When it was last watched through."`
	UpdatedAt     time.Time  `json:"updated_at" doc:"When this state last changed."`
}

// ChapterState is one chapter as the title page shows it.
type ChapterState struct {
	Chapter   string     `json:"chapter" doc:"Chapter number as the source writes it: \"12\", \"12.5\"."`
	Page      int        `json:"page" doc:"Last page the reader showed, from 0."`
	Pages     int        `json:"pages" doc:"Pages in the chapter; zero when it was only marked by hand."`
	Read      bool       `json:"read" doc:"True once it was read to the end, or marked so by hand."`
	ReadAt    *time.Time `json:"read_at,omitempty" doc:"When it was read to the end."`
	UpdatedAt time.Time  `json:"updated_at" doc:"When this state last changed."`
}

type TitleProgress struct {
	MediaRef string         `json:"media_ref" doc:"The title these states belong to."`
	Episodes []EpisodeState `json:"episodes" doc:"Every episode the user played or marked, in order."`
	Chapters []ChapterState `json:"chapters" doc:"Every chapter the user opened or marked."`
}

// ContinueItem is an episode begun and not finished.
type ContinueItem struct {
	MediaRef  string    `json:"media_ref" doc:"The title."`
	Episode   int       `json:"episode" doc:"Episode number across seasons."`
	Position  float64   `json:"position" doc:"Where the user stopped, in seconds."`
	Duration  float64   `json:"duration" doc:"Length of the episode, in seconds."`
	UpdatedAt time.Time `json:"updated_at" doc:"When the user last played it."`
}

func validWatchKey(key WatchKey) error {
	byFile := key.ContentKey != ""
	byEpisode := key.MediaRef != ""

	if byFile == byEpisode {
		return apperr.Invalid("key", "an episode is named by its title or by its file, not both or neither")
	}
	if byEpisode && key.Episode < 1 {
		return apperr.Invalid("episode", "an episode number starts at 1")
	}

	return nil
}

func validChapterKey(key ChapterKey) error {
	bySource := key.SourceRef != ""
	byNumber := key.MediaRef != "" || key.Chapter != ""

	if bySource == byNumber {
		return apperr.Invalid("key", "a chapter is named by its title and number or by its source, not both or neither")
	}
	if byNumber && (key.MediaRef == "" || strings.TrimSpace(key.Chapter) == "") {
		return apperr.Invalid("chapter", "a chapter of a title needs its number")
	}

	return nil
}

// SaveWatch records where a player is. reached says whether this report is at
// or past the point the player counts as watched — the player owns that rule.
// The first report of a pass that reached it counts the pass; a report from
// before it starts a new pass, so a rewatch counts again while a pause near the
// end does not.
func (s *Service) SaveWatch(ctx context.Context, key WatchKey, position, duration float64, reached bool) error {
	if err := validWatchKey(key); err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	state, err := s.store.Watch(ctx, key)
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "read watch state")
	}

	now := s.now().UTC()
	if state == nil {
		state = &store.Watch{Key: key}
	}

	state.Position = max(position, 0)
	if duration > 0 {
		state.Duration = duration
	}

	newlyWatched := false

	switch {
	case reached && !state.PassCounted:
		state.WatchCount++
		state.PassCounted = true
		state.LastWatchedAt = &now
		newlyWatched = !state.Watched
		state.Watched = true

	case !reached:
		state.PassCounted = false
	}

	state.UpdatedAt = now

	if err := s.store.SaveWatch(ctx, state); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "save watch state")
	}

	if newlyWatched {
		s.publish(key.MediaRef, "watched")
	}

	return nil
}

// ResumeAt is where the next play of an episode starts: where the user stopped,
// unless that was too near either end to be worth returning to, or the pass
// was already watched through.
func (s *Service) ResumeAt(ctx context.Context, key WatchKey) (float64, error) {
	if err := validWatchKey(key); err != nil {
		return 0, err
	}

	state, err := s.store.Watch(ctx, key)
	if err != nil {
		return 0, apperr.Wrap(err, apperr.KindInternal, "read watch state")
	}

	return resumeAt(state), nil
}

func resumeAt(state *store.Watch) float64 {
	if state == nil || state.PassCounted || state.Position < resumeMinimum {
		return 0
	}

	if state.Duration > 0 && state.Position >= resumeMaxFraction*state.Duration {
		return 0
	}

	return state.Position
}

// SetEpisodeWatched is the user's own mark. Marking an episode watched counts
// it once if it never was; unmarking forgets it, position included. Neither
// touches the number on the user's list: that is the user's to change.
func (s *Service) SetEpisodeWatched(ctx context.Context, mediaRef string, episode int, watched bool) (*EpisodeState, error) {
	key := WatchKey{MediaRef: mediaRef, Episode: episode}
	if err := validWatchKey(key); err != nil {
		return nil, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	state, err := s.store.Watch(ctx, key)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read watch state")
	}

	now := s.now().UTC()
	if state == nil {
		state = &store.Watch{Key: key}
	}

	if watched {
		if !state.Watched {
			state.WatchCount = max(state.WatchCount, 1)
			state.LastWatchedAt = &now
		}

		state.Watched = true
		state.PassCounted = true
	} else {
		state.Watched = false
		state.PassCounted = false
		state.WatchCount = 0
		state.LastWatchedAt = nil
		state.Position = 0
	}

	state.UpdatedAt = now

	if err := s.store.SaveWatch(ctx, state); err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "save watch state")
	}

	s.publish(mediaRef, "marked")

	shown := episodeState(state)

	return &shown, nil
}

// SaveChapter records the page a reader shows. read says whether the reader
// counts the chapter as read at this page — the reader owns that rule — and,
// once read, a chapter stays read when the user pages back through it.
func (s *Service) SaveChapter(ctx context.Context, key ChapterKey, page, pages int, read bool) error {
	if err := validChapterKey(key); err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	state, err := s.store.Chapter(ctx, key)
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "read chapter state")
	}

	now := s.now().UTC()
	if state == nil {
		state = &store.Chapter{Key: key}
	}

	state.Page = max(page, 0)
	if pages > 0 {
		state.Pages = pages
	}

	newlyRead := read && !state.Read
	if newlyRead {
		state.Read = true
		state.ReadAt = &now
	}

	state.UpdatedAt = now

	if err := s.store.SaveChapter(ctx, state); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "save chapter state")
	}

	if newlyRead {
		s.publish(key.MediaRef, "read")
	}

	return nil
}

// ResumePage is the page a chapter opens at: where the user stopped, or the
// first page for a chapter never opened or already read to its end.
func (s *Service) ResumePage(ctx context.Context, key ChapterKey) (int, error) {
	if err := validChapterKey(key); err != nil {
		return 0, err
	}

	state, err := s.store.Chapter(ctx, key)
	if err != nil {
		return 0, apperr.Wrap(err, apperr.KindInternal, "read chapter state")
	}

	return resumePage(state), nil
}

func resumePage(state *store.Chapter) int {
	if state == nil || state.Page <= 0 {
		return 0
	}

	if state.Pages > 0 && state.Page >= state.Pages-1 {
		return 0
	}

	return state.Page
}

// SetChapterRead is the user's own mark, like SetEpisodeWatched.
func (s *Service) SetChapterRead(ctx context.Context, mediaRef, chapter string, read bool) (*ChapterState, error) {
	key := ChapterKey{MediaRef: mediaRef, Chapter: chapter}
	if err := validChapterKey(key); err != nil {
		return nil, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	state, err := s.store.Chapter(ctx, key)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read chapter state")
	}

	now := s.now().UTC()
	if state == nil {
		state = &store.Chapter{Key: key}
	}

	if read {
		if !state.Read {
			state.ReadAt = &now
		}

		state.Read = true
	} else {
		state.Read = false
		state.ReadAt = nil
		state.Page = 0
	}

	state.UpdatedAt = now

	if err := s.store.SaveChapter(ctx, state); err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "save chapter state")
	}

	s.publish(mediaRef, "marked")

	shown := chapterState(state)

	return &shown, nil
}

// Book is nil for a book never opened.
func (s *Service) Book(ctx context.Context, contentKey string) (*Book, error) {
	if contentKey == "" {
		return nil, apperr.Invalid("content_key", "a book is named by what its file holds")
	}

	book, err := s.store.Book(ctx, contentKey)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read book state")
	}

	return book, nil
}

// SaveBook keeps where the reader left a book. UpdatedAt is the caller's: a
// position moved from the old table keeps the time it was really saved.
func (s *Service) SaveBook(ctx context.Context, book Book) error {
	if book.ContentKey == "" {
		return apperr.Invalid("content_key", "a book is named by what its file holds")
	}
	if strings.TrimSpace(book.Locator) == "" {
		return apperr.Invalid("locator", "a position needs a locator")
	}

	book.Fraction = min(max(book.Fraction, 0), 1)
	if book.UpdatedAt.IsZero() {
		book.UpdatedAt = s.now().UTC()
	}

	if err := s.store.SaveBook(ctx, &book); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "save book state")
	}

	return nil
}

// Title is every episode and chapter of a title the user has a state for.
func (s *Service) Title(ctx context.Context, mediaRef string) (*TitleProgress, error) {
	if strings.TrimSpace(mediaRef) == "" {
		return nil, apperr.Invalid("media_ref", "a title is named by its media reference")
	}

	watches, err := s.store.TitleWatches(ctx, mediaRef)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read watch states")
	}

	chapters, err := s.store.TitleChapters(ctx, mediaRef)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read chapter states")
	}

	out := &TitleProgress{
		MediaRef: mediaRef,
		Episodes: make([]EpisodeState, 0, len(watches)),
		Chapters: make([]ChapterState, 0, len(chapters)),
	}

	for i := range watches {
		out.Episodes = append(out.Episodes, episodeState(&watches[i]))
	}

	for i := range chapters {
		out.Chapters = append(out.Chapters, chapterState(&chapters[i]))
	}

	return out, nil
}

// Continue is the episodes begun and not finished, latest first, one per title:
// the one the user played last is the one they are on.
func (s *Service) Continue(ctx context.Context, limit int) ([]ContinueItem, error) {
	if limit <= 0 || limit > maxContinue {
		limit = maxContinue
	}

	// Several episodes of a title can be begun; read enough to still have
	// limit titles once the older ones are dropped.
	watches, err := s.store.Unfinished(ctx, limit*4)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read unfinished episodes")
	}

	items := []ContinueItem{}
	seen := map[string]bool{}

	for i := range watches {
		w := &watches[i]
		if seen[w.Key.MediaRef] || resumeAt(w) == 0 {
			continue
		}

		seen[w.Key.MediaRef] = true
		items = append(items, ContinueItem{
			MediaRef: w.Key.MediaRef, Episode: w.Key.Episode,
			Position: w.Position, Duration: w.Duration, UpdatedAt: w.UpdatedAt,
		})

		if len(items) == limit {
			break
		}
	}

	return items, nil
}

func episodeState(w *store.Watch) EpisodeState {
	return EpisodeState{
		Episode: w.Key.Episode, Position: w.Position, Duration: w.Duration,
		Watched: w.Watched, WatchCount: w.WatchCount, LastWatchedAt: w.LastWatchedAt, UpdatedAt: w.UpdatedAt,
	}
}

func chapterState(c *store.Chapter) ChapterState {
	return ChapterState{
		Chapter: c.Key.Chapter, Page: c.Page, Pages: c.Pages,
		Read: c.Read, ReadAt: c.ReadAt, UpdatedAt: c.UpdatedAt,
	}
}

// publish tells the desktop a title's marks changed, and the backup that there
// is something new to keep. Positions alone are not announced: they change
// every few seconds of playback and travel with the next backup anyway.
func (s *Service) publish(mediaRef, reason string) {
	if s.hub == nil {
		return
	}

	payload := map[string]any{"reason": reason}
	if mediaRef != "" {
		payload["media_ref"] = mediaRef
	}

	s.hub.Publish(events.TopicProgress, payload)
}
