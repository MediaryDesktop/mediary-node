// Package sandbox runs a plugin's code in goja with nothing but what the node
// hands it: fetch to the plugin's own hosts, an HTML parser, a console and the
// plugin's settings. goja itself gives a script no files, no network and no
// processes, so a plugin is exactly as dangerous as these few bindings let it be.
package sandbox

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/netip"
	"time"

	"github.com/dop251/goja"
	"github.com/rs/zerolog"
)

// Limits bound one call. goja cannot cap memory; these cap what feeds it.
type Limits struct {
	// Call is the whole search, every request in it included.
	Call time.Duration
	// Request is one fetch, from sending to the last byte.
	Request time.Duration

	MaxRequests    int
	MaxBody        int64
	MaxRequestBody int
	MaxResults     int
	MaxLogLines    int
}

func DefaultLimits() Limits {
	return Limits{
		// Under the 25 s a search waits for its sources, as a Torznab source's
		// 20 s is: a plugin that runs out of time says so itself.
		Call:           20 * time.Second,
		Request:        15 * time.Second,
		MaxRequests:    10,
		MaxBody:        5 << 20,
		MaxRequestBody: 1 << 20,
		MaxResults:     500,
		MaxLogLines:    50,
	}
}

// Plugin is what the sandbox needs of an installed plugin: code already
// checked against its manifest's sum, and the hosts the manifest lists.
type Plugin struct {
	ID      string
	Code    string
	Network []string
	Config  map[string]string
}

// SearchRequest is what a torrent provider is asked.
type SearchRequest struct {
	Query     string
	Titles    []string
	Year      int
	Episode   int
	Season    int
	AniListID int
	TMDBID    int
}

// Release is one result, checked: a title and one way to get it.
type Release struct {
	Title       string
	Magnet      string
	Link        string
	InfoHash    string
	Size        int64
	Seeders     int
	Peers       int
	Grabs       int
	PublishedAt *time.Time
	PageURL     string
}

type Options struct {
	Logger zerolog.Logger
	Limits Limits
	// UserAgent is sent with every request; a plugin cannot change it.
	UserAgent string

	// Tests point hosts at a local server and allow its address; nothing else
	// sets these.
	resolve   func(ctx context.Context, host string) ([]netip.Addr, error)
	allowAddr func(netip.Addr) bool
}

type Runner struct {
	logger    zerolog.Logger
	limits    Limits
	userAgent string
	transport http.RoundTripper
}

func New(opts Options) *Runner {
	if opts.Limits == (Limits{}) {
		opts.Limits = DefaultLimits()
	}
	if opts.UserAgent == "" {
		opts.UserAgent = "Mediary"
	}
	if opts.resolve == nil {
		opts.resolve = resolveSystem
	}
	if opts.allowAddr == nil {
		opts.allowAddr = publicAddr
	}

	d := &dialer{resolve: opts.resolve, allow: opts.allowAddr}

	return &Runner{
		logger:    opts.Logger,
		limits:    opts.Limits,
		userAgent: opts.UserAgent,
		transport: newTransport(d, opts.Limits),
	}
}

var (
	// ErrTimeout is a search that ran past Limits.Call.
	ErrTimeout = errors.New("the plugin took too long")
	// ErrNoProvider is code that defines no Provider class with the method asked.
	ErrNoProvider = errors.New("the plugin defines no Provider with this method")
)

// Error is a plugin failing in its own code: what it threw, or what it
// returned instead of releases.
type Error struct {
	Plugin  string
	Message string
}

func (e *Error) Error() string {
	return fmt.Sprintf("plugin %s: %s", e.Plugin, e.Message)
}

// Search runs a torrent provider's search.
func (r *Runner) Search(ctx context.Context, plugin Plugin, request SearchRequest) ([]Release, error) {
	var releases []Release

	err := r.call(ctx, plugin, "search",
		func(s *session) goja.Value { return s.requestValue(request) },
		func(s *session, result goja.Value) (readErr error) {
			releases, readErr = s.releases(result)
			return readErr
		})

	return releases, err
}

// call runs one method of the plugin's Provider in a fresh runtime — nothing a
// plugin builds up survives to its next call — and reads what it returned.
func (r *Runner) call(ctx context.Context, plugin Plugin, method string, arg func(*session) goja.Value, read func(*session, goja.Value) error) (err error) {
	ctx, cancel := context.WithTimeout(ctx, r.limits.Call)
	defer cancel()

	program, err := goja.Compile(plugin.ID+".js", plugin.Code, false)
	if err != nil {
		return &Error{Plugin: plugin.ID, Message: "the code does not compile: " + err.Error()}
	}

	vm := goja.New()

	// The deadline stops the script wherever it is, a request in flight or a
	// loop that never ends.
	stop := context.AfterFunc(ctx, func() { vm.Interrupt(ErrTimeout) })
	defer stop()

	// goja panics on some misuse from Go; a plugin must not take the node down
	// with it.
	defer func() {
		if recovered := recover(); recovered != nil {
			err = &Error{Plugin: plugin.ID, Message: fmt.Sprintf("the runtime failed: %v", recovered)}
		}
	}()

	s := &session{
		ctx:    ctx,
		vm:     vm,
		plugin: plugin,
		hosts:  hosts(plugin.Network),
		limits: r.limits,
		client: clientFor(r.transport, hosts(plugin.Network)),
		agent:  r.userAgent,
		logger: r.logger.With().Str("plugin", plugin.ID).Logger(),
	}

	if bindErr := s.bind(); bindErr != nil {
		return bindErr
	}

	if _, err = vm.RunProgram(program); err != nil {
		return s.failure(ctx, err)
	}

	value, err := s.callMethod(method, arg(s))
	if err != nil {
		return s.failure(ctx, err)
	}

	result, err := s.settle(value)
	if err != nil {
		return s.failure(ctx, err)
	}

	return read(s, result)
}

// session is one call's runtime and what its bindings share.
type session struct {
	ctx    context.Context //nolint:containedctx // one call's deadline, which every binding of that call obeys
	vm     *goja.Runtime
	plugin Plugin
	hosts  hosts
	limits Limits
	client *http.Client
	agent  string
	logger zerolog.Logger

	// Captured before the plugin's code runs, which could replace the globals.
	errorCtor goja.Value
	jsonParse goja.Callable

	requests int
	logLines int
}

func (s *session) callMethod(method string, arg goja.Value) (goja.Value, error) {
	// A class declaration is not a property of the global object; it is
	// reached by name from the global scope.
	ctor, err := s.vm.RunString(`typeof Provider === 'function' ? Provider : undefined`)
	if err != nil {
		return nil, err
	}
	if goja.IsUndefined(ctor) {
		return nil, fmt.Errorf("%w: %s", ErrNoProvider, method)
	}

	instance, err := s.vm.New(ctor)
	if err != nil {
		return nil, err
	}

	fn, ok := goja.AssertFunction(instance.Get(method))
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrNoProvider, method)
	}

	return fn(instance, arg)
}

func (s *session) requestValue(request SearchRequest) goja.Value {
	obj := s.vm.NewObject()
	_ = obj.Set("query", request.Query)

	titles := make([]any, 0, len(request.Titles))
	for _, title := range request.Titles {
		titles = append(titles, title)
	}
	_ = obj.Set("titles", s.vm.NewArray(titles...))

	for key, value := range map[string]int{
		"year":      request.Year,
		"episode":   request.Episode,
		"season":    request.Season,
		"anilistId": request.AniListID,
		"tmdbId":    request.TMDBID,
	} {
		if value > 0 {
			_ = obj.Set(key, value)
		}
	}

	return obj
}

// settle takes the promise search returned. Every fetch has done its work
// before it returns, so by now the promise is settled — unless the plugin
// waits on something that never comes.
func (s *session) settle(value goja.Value) (goja.Value, error) {
	promise, ok := value.Export().(*goja.Promise)
	if !ok {
		return value, nil
	}

	switch promise.State() {
	case goja.PromiseStateFulfilled:
		return promise.Result(), nil
	case goja.PromiseStateRejected:
		return nil, &thrown{value: promise.Result()}
	default:
		return nil, &Error{Plugin: s.plugin.ID, Message: "the call waits on something that never finishes"}
	}
}

// thrown carries a JavaScript value a plugin threw or rejected with.
type thrown struct {
	value goja.Value
}

func (t *thrown) Error() string { return t.value.String() }

// failure says what went wrong in words the user can act on, keeping Go's
// details out of it.
func (s *session) failure(ctx context.Context, err error) error {
	var interrupted *goja.InterruptedError
	if errors.As(err, &interrupted) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return fmt.Errorf("plugin %s: %w (over %s)", s.plugin.ID, ErrTimeout, s.limits.Call)
	}
	if errors.Is(err, ErrNoProvider) {
		return fmt.Errorf("plugin %s: %w", s.plugin.ID, err)
	}

	var pluginErr *Error
	if errors.As(err, &pluginErr) {
		return pluginErr
	}

	message := err.Error()

	var exception *goja.Exception
	var t *thrown
	switch {
	case errors.As(err, &exception):
		message = messageOf(exception.Value())
	case errors.As(err, &t):
		message = messageOf(t.value)
	}

	return &Error{Plugin: s.plugin.ID, Message: message}
}

// messageOf is an Error's message, or the value as text.
func messageOf(value goja.Value) string {
	if value == nil || goja.IsUndefined(value) || goja.IsNull(value) {
		return "it failed without saying why"
	}

	if obj, ok := value.(*goja.Object); ok {
		if message := obj.Get("message"); message != nil && !goja.IsUndefined(message) {
			return clip(message.String(), maxMessage)
		}
	}

	return clip(value.String(), maxMessage)
}

const maxMessage = 500

func clip(text string, limit int) string {
	if len(text) <= limit {
		return text
	}

	return text[:limit] + "…"
}
