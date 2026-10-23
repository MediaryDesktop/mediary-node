package gutenberg

import (
	"context"
	"database/sql"
	"errors"
	"io"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/source"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
	pg "github.com/mediaryorg/mediary-node/server/internal/platform/sources/gutenberg"
)

const (
	ID   = "gutenberg"
	Name = "Project Gutenberg"

	epubType = "application/epub+zip"

	// The catalogue changes once a week.
	checkEvery = 7 * 24 * time.Hour
	// A failed first download is tried again sooner than a failed weekly check,
	// which leaves a working catalogue in place.
	retryEmpty    = time.Hour
	retryExisting = 6 * time.Hour
	tick          = time.Hour
	syncTimeout   = 15 * time.Minute

	searchLimit = 20
)

// Client is Project Gutenberg's site, as platform/sources/gutenberg reaches it.
type Client interface {
	Catalog(ctx context.Context, lastModified string) (*pg.Catalog, error)
	Book(ctx context.Context, id int) (io.ReadCloser, error)
}

type Options struct {
	DB     *sql.DB
	Client Client
	Events *events.Hub
	Logger zerolog.Logger
	Now    func() time.Time
}

// Gutenberg is the source and the keeper of its catalogue. It is off until the
// user turns it on; only then is the catalogue downloaded, and turning it off
// removes it again.
type Gutenberg struct {
	client Client
	store  *store
	hub    *events.Hub
	logger zerolog.Logger
	now    func() time.Time

	wake chan struct{}

	// writing keeps a catalogue being saved and one being removed apart.
	writing sync.Mutex

	mu      sync.Mutex
	syncing bool
	// pending is a check asked for and not yet started; forced, it ignores the
	// week between checks.
	pending    bool
	forced     bool
	cancelSync context.CancelFunc
}

func New(opts Options) *Gutenberg {
	if opts.Now == nil {
		opts.Now = time.Now
	}

	return &Gutenberg{
		client: opts.Client,
		store:  &store{db: opts.DB},
		hub:    opts.Events,
		logger: opts.Logger,
		now:    opts.Now,
		wake:   make(chan struct{}, 1),
	}
}

func (g *Gutenberg) ID() string   { return ID }
func (g *Gutenberg) Name() string { return Name }

// Enabled says whether the user has the source on. A setting the node cannot
// read counts as off.
func (g *Gutenberg) Enabled(ctx context.Context) bool {
	enabled, err := g.store.enabled(ctx)
	if err != nil {
		g.logger.Warn().Err(err).Msg("read whether project gutenberg is on")
	}

	return enabled
}

// Search looks in the node's copy of the catalogue: nothing is asked of the
// site.
func (g *Gutenberg) Search(ctx context.Context, query source.Query) ([]source.Edition, error) {
	count, err := g.store.count(ctx)
	if err != nil {
		return nil, err
	}
	if count == 0 {
		return nil, g.noCatalog(ctx)
	}

	match := matchOf(query)
	if match == "" {
		return []source.Edition{}, nil
	}

	books, err := g.store.search(ctx, match, searchLimit)
	if err != nil {
		return nil, err
	}

	editions := make([]source.Edition, 0, len(books))
	for i := range books {
		editions = append(editions, edition(&books[i]))
	}

	return editions, nil
}

func (g *Gutenberg) noCatalog(ctx context.Context) error {
	settings, err := g.Settings(ctx)
	switch {
	case err != nil:
		return err
	case settings.Syncing:
		return apperr.New(apperr.KindUnavailable, "the catalogue of Project Gutenberg is still downloading")
	case settings.Error != "":
		return apperr.New(apperr.KindUnavailable, "the catalogue of Project Gutenberg could not be downloaded: %s", settings.Error)
	default:
		return apperr.New(apperr.KindUnavailable, "the catalogue of Project Gutenberg is not downloaded yet")
	}
}

func edition(book *Book) source.Edition {
	number := strconv.FormatInt(book.ID, 10)
	language, _, _ := strings.Cut(book.Language, ";")

	return source.Edition{
		Ref:      source.Ref(ID, number),
		Title:    book.Title,
		Authors:  book.Authors,
		Language: strings.TrimSpace(language),
		Formats: []source.Format{{
			Type:     epubType,
			Ext:      ".epub",
			Location: "cache/epub/" + number + "/pg" + number + "-images-3.epub",
		}},
		Source: Name,
	}
}

// Open fetches the book's EPUB. The address is built from the book's number on
// Gutenberg's own site; the location is not trusted to say where.
func (g *Gutenberg) Open(ctx context.Context, ref, _ string) (io.ReadCloser, error) {
	kind, number, _ := strings.Cut(ref, ":")

	id, err := strconv.Atoi(number)
	if kind != ID || err != nil || id <= 0 {
		return nil, apperr.Invalid("ref", "%q is not a Project Gutenberg book", ref)
	}

	return g.client.Book(ctx, id)
}

// Settings is the source as the user sees it in the settings.
type Settings struct {
	Enabled bool
	Syncing bool
	Books   int64
	// UpdatedAt is when the node took the catalogue it has; CheckedAt, when it
	// last asked whether there is a newer one.
	UpdatedAt time.Time
	CheckedAt time.Time
	Error     string
}

func (g *Gutenberg) Settings(ctx context.Context) (*Settings, error) {
	enabled, err := g.store.enabled(ctx)
	if err != nil {
		return nil, err
	}

	// Read before the catalogue: a sync that ends in between is seen as still
	// going, never as done with the old catalogue.
	g.mu.Lock()
	syncing := g.syncing || g.pending
	g.mu.Unlock()

	g.writing.Lock()
	state, err := g.store.syncState(ctx)
	if err != nil {
		g.writing.Unlock()
		return nil, err
	}

	count, err := g.store.count(ctx)
	g.writing.Unlock()
	if err != nil {
		return nil, err
	}

	return &Settings{
		Enabled:   enabled,
		Syncing:   enabled && syncing,
		Books:     count,
		UpdatedAt: state.UpdatedAt,
		CheckedAt: state.CheckedAt,
		Error:     state.Error,
	}, nil
}

// SetEnabled turns the source on, which downloads the catalogue, or off, which
// stops a download under way and removes the catalogue.
func (g *Gutenberg) SetEnabled(ctx context.Context, enabled bool) (*Settings, error) {
	if err := g.store.setEnabled(ctx, enabled); err != nil {
		return nil, err
	}

	if enabled {
		g.ask(false)
	} else if err := g.remove(ctx); err != nil {
		return nil, err
	}

	settings, err := g.Settings(ctx)
	if err != nil {
		return nil, err
	}

	g.publish(settings)

	return settings, nil
}

// Refresh asks the site now whether the catalogue changed, without waiting out
// the week.
func (g *Gutenberg) Refresh(ctx context.Context) (*Settings, error) {
	enabled, err := g.store.enabled(ctx)
	if err != nil {
		return nil, err
	}
	if !enabled {
		return nil, apperr.New(apperr.KindPrecondition, "turn Project Gutenberg on first")
	}

	g.ask(true)

	return g.Settings(ctx)
}

func (g *Gutenberg) ask(force bool) {
	g.mu.Lock()
	g.pending = true
	g.forced = g.forced || force
	g.mu.Unlock()

	select {
	case g.wake <- struct{}{}:
	default:
	}
}

func (g *Gutenberg) remove(ctx context.Context) error {
	g.mu.Lock()
	g.pending, g.forced = false, false
	if g.cancelSync != nil {
		g.cancelSync()
	}
	g.mu.Unlock()

	g.writing.Lock()
	defer g.writing.Unlock()

	if err := g.store.clear(ctx); err != nil {
		return err
	}

	return g.store.setSyncState(ctx, syncState{})
}

// Start keeps the catalogue up to date while the source is on, until ctx ends:
// at start, once a week after, and when the user asks.
func (g *Gutenberg) Start(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(tick)
		defer ticker.Stop()

		for {
			g.syncIfDue(ctx)

			select {
			case <-ctx.Done():
				return
			case <-g.wake:
			case <-ticker.C:
			}
		}
	}()
}

func (g *Gutenberg) syncIfDue(ctx context.Context) {
	g.mu.Lock()
	forced := g.forced
	g.forced = false
	g.mu.Unlock()

	// A request stays pending until the sync it asked for is under way, so the
	// settings never say "not syncing" in between.
	start := false
	defer func() {
		if !start {
			g.mu.Lock()
			g.pending = false
			g.mu.Unlock()
		}
	}()

	if !g.Enabled(ctx) {
		return
	}

	state, err := g.store.syncState(ctx)
	if err != nil {
		g.logger.Warn().Err(err).Msg("read the state of the project gutenberg catalogue")
		return
	}

	count, err := g.store.count(ctx)
	if err != nil {
		g.logger.Warn().Err(err).Msg("count the project gutenberg catalogue")
		return
	}

	if start = forced || due(state, count, g.now()); start {
		g.sync(ctx, state, count)
	}
}

func due(state syncState, count int64, now time.Time) bool {
	if state.Error != "" {
		retry := retryExisting
		if count == 0 {
			retry = retryEmpty
		}

		return now.Sub(state.AttemptedAt) >= retry
	}

	return count == 0 || now.Sub(state.CheckedAt) >= checkEvery
}

func (g *Gutenberg) sync(parent context.Context, state syncState, count int64) {
	ctx, cancel := context.WithTimeout(parent, syncTimeout)
	defer cancel()

	g.mu.Lock()
	g.syncing, g.pending, g.cancelSync = true, false, cancel
	g.mu.Unlock()

	defer func() {
		g.mu.Lock()
		g.syncing, g.cancelSync = false, nil
		g.mu.Unlock()

		g.publishCurrent(parent)
	}()

	g.publishCurrent(ctx)

	state.AttemptedAt = g.now()

	fetched, err := g.fetch(ctx, state, count)

	// The new catalogue and the state that describes it are saved together, so
	// the settings never show one without the other. The state is saved even when
	// a stopping node cut the check short, so the next start sees the attempt —
	// but not once the user turned the source off, which already reset it.
	saveCtx := context.WithoutCancel(ctx)

	g.writing.Lock()
	defer g.writing.Unlock()

	if !g.Enabled(saveCtx) {
		return
	}

	if err == nil && fetched != nil {
		err = g.replace(ctx, &state, fetched)
	}

	if err != nil {
		state.Error = messageOf(err)
		g.logger.Warn().Err(err).Msg("project gutenberg catalogue not updated")
	} else {
		state.Error = ""
		state.CheckedAt = g.now()
	}

	if saveErr := g.store.setSyncState(saveCtx, state); saveErr != nil {
		g.logger.Error().Err(saveErr).Msg("save the state of the project gutenberg catalogue")
	}
}

// fetched is a new catalogue, read and not yet saved.
type fetched struct {
	books        []Book
	lastModified string
}

// fetch downloads and reads the catalogue; it is nil when it has not changed.
func (g *Gutenberg) fetch(ctx context.Context, state syncState, count int64) (*fetched, error) {
	// Without a catalogue there is nothing to compare with: the whole file comes.
	lastModified := state.LastModified
	if count == 0 {
		lastModified = ""
	}

	catalog, err := g.client.Catalog(ctx, lastModified)
	if errors.Is(err, pg.ErrNotModified) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	defer func() { _ = catalog.Body.Close() }()

	books, err := ParseCatalog(catalog.Body)
	if err != nil {
		return nil, err
	}

	return &fetched{books: books, lastModified: catalog.LastModified}, nil
}

func (g *Gutenberg) replace(ctx context.Context, state *syncState, catalog *fetched) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	if err := g.store.replace(ctx, catalog.books); err != nil {
		return err
	}

	state.LastModified = catalog.lastModified
	state.UpdatedAt = g.now()

	g.logger.Info().Int("books", len(catalog.books)).Msg("project gutenberg catalogue updated")

	return nil
}

func (g *Gutenberg) publishCurrent(ctx context.Context) {
	settings, err := g.Settings(context.WithoutCancel(ctx))
	if err != nil {
		return
	}

	g.publish(settings)
}

func (g *Gutenberg) publish(settings *Settings) {
	if g.hub == nil {
		return
	}

	g.hub.Publish(events.TopicBookCatalog, map[string]any{
		"source":  ID,
		"enabled": settings.Enabled,
		"syncing": settings.Syncing,
		"books":   settings.Books,
		"error":   settings.Error,
	})
}

// messageOf is what a failure says to the user: an apperr's own message
// without its kind, or the error as it is.
func messageOf(err error) string {
	var appErr *apperr.Error
	if errors.As(err, &appErr) {
		return appErr.Message
	}

	return err.Error()
}
