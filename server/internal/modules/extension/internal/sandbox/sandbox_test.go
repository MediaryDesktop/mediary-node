package sandbox

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/rs/zerolog"
)

// site is a fake tracker. Every host a test names resolves to it, and only
// its loopback address is let through — the one exception to the rule the
// tests below check, made only here.
type site struct {
	server *httptest.Server
	port   string
	hits   atomic.Int32
}

func newSite(t *testing.T, handler http.HandlerFunc) *site {
	t.Helper()

	s := &site{}
	s.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.hits.Add(1)
		handler(w, r)
	}))
	t.Cleanup(s.server.Close)

	u, _ := url.Parse(s.server.URL)
	s.port = u.Port()

	return s
}

// runner whose hosts all resolve to the fake site, which it may reach.
func (s *site) runner(limits Limits) *Runner {
	loopback := netip.MustParseAddr("127.0.0.1")

	return New(Options{
		Logger: zerolog.Nop(),
		Limits: limits,
		resolve: func(context.Context, string) ([]netip.Addr, error) {
			return []netip.Addr{loopback}, nil
		},
		allowAddr: func(addr netip.Addr) bool { return addr == loopback },
	})
}

// strictRunner resolves names as given and allows only public addresses —
// the node's own rule.
func strictRunner(resolve map[string]string) *Runner {
	return New(Options{
		Logger: zerolog.Nop(),
		Limits: DefaultLimits(),
		resolve: func(_ context.Context, host string) ([]netip.Addr, error) {
			addr, ok := resolve[host]
			if !ok {
				return nil, fmt.Errorf("no such host %s", host)
			}
			return []netip.Addr{netip.MustParseAddr(addr)}, nil
		},
	})
}

func plugin(code string, network ...string) Plugin {
	return Plugin{ID: "test", Code: code, Network: network}
}

// fetchOutcome is a plugin that fetches url and returns what happened as the
// title of its only release, so a test reads it back.
func fetchOutcome(target string) string {
	return fmt.Sprintf(`
		class Provider {
			async search() {
				let outcome
				try {
					const res = await fetch(%q)
					outcome = 'ok ' + res.status + ' ' + (await res.text())
				} catch (e) {
					outcome = 'refused: ' + e.message
				}
				return [{ title: outcome, infoHash: '0123456789abcdef0123456789abcdef01234567' }]
			}
		}`, target)
}

func outcome(t *testing.T, r *Runner, p Plugin) string {
	t.Helper()

	releases, err := r.Search(context.Background(), p, SearchRequest{Query: "q"})
	if err != nil {
		t.Fatal(err)
	}
	if len(releases) != 1 {
		t.Fatalf("got %d releases", len(releases))
	}

	return releases[0].Title
}

func TestExampleFindsReleases(t *testing.T) {
	var asked string
	s := newSite(t, func(w http.ResponseWriter, r *http.Request) {
		asked = r.URL.RequestURI()
		fmt.Fprint(w, `<table>
			<tr data-hash="0123456789abcdef0123456789abcdef01234567">
				<td class="name"><a href="/view/1">  [Group] Frieren - 01
					(1080p) </a></td>
				<td class="size">1.5 GiB</td><td class="seeders">42</td>
				<td class="peers">3</td><td class="date" data-ts="1700000000"></td>
			</tr>
			<tr data-hash="fedcba9876543210fedcba9876543210fedcba98">
				<td class="name"><a href="/view/2">[Group] Frieren - 02 (1080p)</a></td>
				<td class="size">700 MiB</td><td class="seeders">x</td>
				<td class="peers">0</td><td class="date" data-ts="1700003600"></td>
			</tr>
		</table>`)
	})

	code, err := os.ReadFile(filepath.Join("..", "manifest", "testdata", "example", "plugin.js"))
	if err != nil {
		t.Fatal(err)
	}

	// The example builds https:// addresses; the fake site speaks http, so
	// its own address is the mirror the user "chose".
	p := Plugin{
		ID:      "example-tracker",
		Code:    strings.Replace(string(code), "`https://${", "`http://${", 1),
		Network: []string{"tracker.example.org", "*.tracker.example.org"},
		Config:  map[string]string{"mirror": "mirror.tracker.example.org:" + s.port},
	}

	releases, err := s.runner(DefaultLimits()).Search(context.Background(), p, SearchRequest{Query: "frieren 01"})
	if err != nil {
		t.Fatal(err)
	}

	if asked != "/search?q=frieren%2001" {
		t.Fatalf("asked the site for %s", asked)
	}
	if len(releases) != 2 {
		t.Fatalf("got %d releases", len(releases))
	}

	first := releases[0]
	if first.Title != "[Group] Frieren - 01 (1080p)" {
		t.Errorf("title %q, want its whitespace folded", first.Title)
	}
	if first.InfoHash != "0123456789abcdef0123456789abcdef01234567" || !strings.HasPrefix(first.Magnet, "magnet:?xt=urn:btih:") {
		t.Errorf("hash %q, magnet %q", first.InfoHash, first.Magnet)
	}
	if first.Size != 1610612736 || first.Seeders != 42 || first.Peers != 3 {
		t.Errorf("size %d, seeders %d, peers %d", first.Size, first.Seeders, first.Peers)
	}
	if first.PublishedAt == nil || !first.PublishedAt.Equal(time.Unix(1700000000, 0)) {
		t.Errorf("published %v", first.PublishedAt)
	}
	if first.PageURL != "http://mirror.tracker.example.org:"+s.port+"/view/1" {
		t.Errorf("page %q", first.PageURL)
	}
	if releases[1].Seeders != 0 {
		t.Errorf("unreadable seeders read as %d", releases[1].Seeders)
	}
}

// Everything a plugin must not reach, each tried by a plugin that catches
// the refusal and reports it.
func TestFetchRefusesWhatIsNotTheContract(t *testing.T) {
	r := strictRunner(map[string]string{
		"tracker.example.org":  "93.184.216.34",
		"rebind.example.org":   "127.0.0.1",
		"lan.example.org":      "192.168.1.10",
		"metadata.example.org": "169.254.169.254",
		"cgnat.example.org":    "100.64.0.1",
		"v6local.example.org":  "::1",
		"mapped.example.org":   "::ffff:127.0.0.1",
		"ula.example.org":      "fd00::1",
		"zero.example.org":     "0.0.0.0",
	})

	listed := []string{
		"tracker.example.org", "rebind.example.org", "lan.example.org", "metadata.example.org",
		"cgnat.example.org", "v6local.example.org", "mapped.example.org", "ula.example.org", "zero.example.org",
	}

	cases := map[string]struct {
		url  string
		says string
	}{
		"a host not listed":          {"https://elsewhere.example.org/", "not one of the hosts"},
		"loopback by address":        {"http://127.0.0.1:43711/v1/tools", "not one of the hosts"},
		"IPv6 loopback by address":   {"http://[::1]/", "not one of the hosts"},
		"localhost":                  {"http://localhost/", "not one of the hosts"},
		"listed, resolves to 127.x":  {"http://rebind.example.org/", "local or private"},
		"listed, resolves to LAN":    {"http://lan.example.org/", "local or private"},
		"listed, cloud metadata":     {"http://metadata.example.org/latest/meta-data/", "local or private"},
		"listed, carrier NAT":        {"http://cgnat.example.org/", "local or private"},
		"listed, IPv6 loopback":      {"http://v6local.example.org/", "local or private"},
		"listed, v4-mapped loopback": {"http://mapped.example.org/", "local or private"},
		"listed, IPv6 private":       {"http://ula.example.org/", "local or private"},
		"listed, unspecified":        {"http://zero.example.org/", "local or private"},
		"a file":                     {"file:///C:/Windows/win.ini", "only http and https"},
		"a user in the address":      {"https://user:pw@tracker.example.org/", "no user names"},
		"not an address":             {"::not a url", "not an address"},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			got := outcome(t, r, plugin(fetchOutcome(tc.url), listed...))
			if !strings.HasPrefix(got, "refused") || !strings.Contains(got, tc.says) {
				t.Fatalf("%s; want it refused because %q", got, tc.says)
			}
		})
	}
}

func TestRedirectsStayOnTheList(t *testing.T) {
	s := newSite(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/away":
			http.Redirect(w, r, "http://elsewhere.example.org/", http.StatusFound)
		case "/local":
			http.Redirect(w, r, "http://127.0.0.1:1/", http.StatusFound)
		case "/scheme":
			http.Redirect(w, r, "file:///etc/passwd", http.StatusFound)
		case "/loop":
			http.Redirect(w, r, "/loop", http.StatusFound)
		case "/stay":
			http.Redirect(w, r, "/landed", http.StatusFound)
		default:
			fmt.Fprint(w, "landed")
		}
	})
	r := s.runner(DefaultLimits())
	base := "http://tracker.example.org:" + s.port

	for path, want := range map[string]string{
		"/away":   "refused: fetch: redirected to elsewhere.example.org is not one of the hosts",
		"/local":  "refused: fetch: redirected to 127.0.0.1 is not one of the hosts",
		"/scheme": "refused",
		"/loop":   "more than 5 redirects",
		"/stay":   "ok 200 landed",
	} {
		t.Run(path, func(t *testing.T) {
			got := outcome(t, r, plugin(fetchOutcome(base+path), "tracker.example.org"))
			if !strings.Contains(got, want) {
				t.Fatalf("%s; want %q", got, want)
			}
		})
	}
}

func TestEndlessLoopIsStopped(t *testing.T) {
	limits := DefaultLimits()
	limits.Call = 200 * time.Millisecond

	start := time.Now()
	_, err := New(Options{Logger: zerolog.Nop(), Limits: limits}).Search(context.Background(), plugin(`
		class Provider {
			async search() { for (;;) {} }
		}`), SearchRequest{})

	if !errors.Is(err, ErrTimeout) {
		t.Fatalf("%v; want a timeout", err)
	}
	if elapsed := time.Since(start); elapsed > 2*time.Second {
		t.Fatalf("stopped after %s", elapsed)
	}
}

// A loop inside a catch must not swallow the stop.
func TestTimeoutCannotBeCaught(t *testing.T) {
	limits := DefaultLimits()
	limits.Call = 200 * time.Millisecond

	_, err := New(Options{Logger: zerolog.Nop(), Limits: limits}).Search(context.Background(), plugin(`
		class Provider {
			async search() {
				for (;;) { try { for (;;) {} } catch (e) {} finally {} }
			}
		}`), SearchRequest{})

	if !errors.Is(err, ErrTimeout) {
		t.Fatalf("%v; want a timeout", err)
	}
}

func TestSearchThatNeverSettles(t *testing.T) {
	_, err := New(Options{Logger: zerolog.Nop()}).Search(context.Background(), plugin(`
		class Provider {
			search() { return new Promise(() => {}) }
		}`), SearchRequest{})

	if err == nil || !strings.Contains(err.Error(), "never finishes") {
		t.Fatalf("%v", err)
	}
}

func TestResponseTooLargeIsRefused(t *testing.T) {
	s := newSite(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write(make([]byte, 2<<20))
	})
	limits := DefaultLimits()
	limits.MaxBody = 1 << 20

	got := outcome(t, s.runner(limits), plugin(fetchOutcome("http://tracker.example.org:"+s.port+"/"), "tracker.example.org"))
	if !strings.Contains(got, "larger than 1 MB") {
		t.Fatalf("%s", got)
	}
}

func TestRequestsPerSearchAreCapped(t *testing.T) {
	s := newSite(t, func(w http.ResponseWriter, _ *http.Request) { fmt.Fprint(w, "x") })
	limits := DefaultLimits()
	limits.MaxRequests = 3

	got := outcome(t, s.runner(limits), plugin(fmt.Sprintf(`
		class Provider {
			async search() {
				let n = 0
				try {
					for (;;) { await fetch('http://tracker.example.org:%s/'); n++ }
				} catch (e) {
					return [{ title: n + ' then ' + e.message, infoHash: '0123456789abcdef0123456789abcdef01234567' }]
				}
			}
		}`, s.port), "tracker.example.org"))

	if !strings.HasPrefix(got, "3 then") || !strings.Contains(got, "at most 3 requests") {
		t.Fatalf("%s", got)
	}
	if hits := s.hits.Load(); hits != 3 {
		t.Fatalf("the site was asked %d times", hits)
	}
}

func TestPluginCannotSpoofHeaders(t *testing.T) {
	var agent, custom string
	s := newSite(t, func(w http.ResponseWriter, r *http.Request) {
		agent, custom = r.UserAgent(), r.Header.Get("X-Api-Key")
		fmt.Fprint(w, "x")
	})
	r := s.runner(DefaultLimits())
	target := "http://tracker.example.org:" + s.port + "/"

	got := outcome(t, r, plugin(fmt.Sprintf(`
		class Provider {
			async search() {
				let refused = ''
				try { await fetch(%[1]q, { headers: { 'User-Agent': 'Chrome' } }) } catch (e) { refused = e.message }
				await fetch(%[1]q, { headers: { 'X-Api-Key': 'k' } })
				return [{ title: refused, infoHash: '0123456789abcdef0123456789abcdef01234567' }]
			}
		}`, target), "tracker.example.org"))

	if !strings.Contains(got, "User-Agent header is set by the node") {
		t.Fatalf("%s", got)
	}
	if agent != "Mediary" || custom != "k" {
		t.Fatalf("the site saw agent %q and key %q", agent, custom)
	}
}

func TestProxyFromTheEnvironmentIsNotUsed(t *testing.T) {
	proxied := false
	proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		proxied = true
		fmt.Fprint(w, "from the proxy")
	}))
	t.Cleanup(proxy.Close)
	t.Setenv("HTTP_PROXY", proxy.URL)
	t.Setenv("HTTPS_PROXY", proxy.URL)

	s := newSite(t, func(w http.ResponseWriter, _ *http.Request) { fmt.Fprint(w, "direct") })

	got := outcome(t, s.runner(DefaultLimits()), plugin(fetchOutcome("http://tracker.example.org:"+s.port+"/"), "tracker.example.org"))
	if proxied || got != "ok 200 direct" {
		t.Fatalf("%s; proxied %v", got, proxied)
	}
}

func TestNothingElseIsReachable(t *testing.T) {
	got := outcome(t, New(Options{Logger: zerolog.Nop()}), plugin(`
		class Provider {
			async search() {
				const found = []
				for (const name of ['require', 'process', 'setTimeout', 'setInterval', 'XMLHttpRequest',
					'WebSocket', 'Deno', 'Bun', 'module', 'exports', 'global', 'globalThis.go', 'importScripts']) {
					try { if (eval('typeof ' + name) !== 'undefined') found.push(name) } catch (e) {}
				}
				// What Function's constructor reaches is the same global, nothing more.
				const g = fetch.constructor('return this')()
				if (typeof g.require !== 'undefined') found.push('require via Function')
				// The bindings expose no Go properties.
				const own = Object.getOwnPropertyNames(fetch).filter(n => !['length', 'name'].includes(n))
				if (own.length) found.push('fetch has ' + own.join(','))
				return [{ title: 'found: ' + found.join(',') + '.', infoHash: '0123456789abcdef0123456789abcdef01234567' }]
			}
		}`))

	if got != "found: ." {
		t.Fatalf("%s", got)
	}
}

func TestConfigIsReadOnly(t *testing.T) {
	p := plugin(`
		'use strict'
		class Provider {
			async search() {
				let refused = false
				try { config.mirror = 'evil.org' } catch (e) { refused = true }
				return [{ title: config.mirror + ' ' + refused, infoHash: '0123456789abcdef0123456789abcdef01234567' }]
			}
		}`)
	p.Config = map[string]string{"mirror": "tracker.example.org"}

	if got := outcome(t, New(Options{Logger: zerolog.Nop()}), p); got != "tracker.example.org true" {
		t.Fatalf("%s", got)
	}
}

func TestResultsAreChecked(t *testing.T) {
	releases, err := New(Options{Logger: zerolog.Nop()}).Search(context.Background(), plugin(`
		class Provider {
			async search() {
				return [
					{ title: 'kept, base32 hash', infoHash: 'AERUKZ4JVPG66AJDIVTYTK6N54ASGRLH' },
					{ title: 'no way to get it' },
					{ title: '', magnet: 'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567' },
					{ title: 'a link off the list', link: 'http://192.168.1.1/admin.torrent' },
					{ title: 'a javascript page', infoHash: '0123456789abcdef0123456789abcdef01234567', pageUrl: 'javascript:alert(1)' },
					{ title: 'not a magnet', magnet: 'http://x/y' },
					{ title: 'negative', infoHash: '0123456789abcdef0123456789abcdef01234567', seeders: -5, size: 'lots' },
					'a string',
					null,
					{ title: 'kept, link on the list', link: 'https://tracker.example.org/1.torrent' },
				]
			}
		}`, "tracker.example.org"), SearchRequest{})
	if err != nil {
		t.Fatal(err)
	}

	titles := make([]string, 0, len(releases))
	for _, r := range releases {
		titles = append(titles, r.Title)
	}

	want := "kept, base32 hash|a javascript page|negative|kept, link on the list"
	if got := strings.Join(titles, "|"); got != want {
		t.Fatalf("kept %s; want %s", got, want)
	}

	if releases[0].InfoHash != "0123456789abcdef0123456789abcdef01234567" {
		t.Errorf("base32 hash read as %q", releases[0].InfoHash)
	}
	if releases[1].PageURL != "" {
		t.Errorf("kept page %q", releases[1].PageURL)
	}
	if releases[2].Seeders != 0 || releases[2].Size != 0 {
		t.Errorf("seeders %d, size %d", releases[2].Seeders, releases[2].Size)
	}
}

func TestTooManyResultsAreCut(t *testing.T) {
	limits := DefaultLimits()
	limits.MaxResults = 10

	releases, err := New(Options{Logger: zerolog.Nop(), Limits: limits}).Search(context.Background(), plugin(`
		class Provider {
			async search() {
				return Array.from({ length: 5000 }, (_, i) => ({ title: 'r' + i, infoHash: '0123456789abcdef0123456789abcdef01234567' }))
			}
		}`), SearchRequest{})
	if err != nil {
		t.Fatal(err)
	}
	if len(releases) != 10 {
		t.Fatalf("kept %d", len(releases))
	}
}

func TestFailuresSayWhy(t *testing.T) {
	r := New(Options{Logger: zerolog.Nop()})

	cases := map[string]struct {
		code string
		says string
	}{
		"throws":             {`class Provider { async search() { throw new Error('the site is down') } }`, "the site is down"},
		"throws a string":    {`class Provider { search() { throw 'plain' } }`, "plain"},
		"no Provider":        {`class Searcher { search() {} }`, "no Provider"},
		"no search":          {`class Provider { find() {} }`, "no Provider"},
		"syntax":             {`class Provider {`, "does not compile"},
		"not an array":       {`class Provider { async search() { return { title: 'x' } } }`, "array of releases"},
		"throws at load":     {`throw new Error('broken at load')`, "broken at load"},
		"bad selector":       {`class Provider { async search() { parseHTML('<p>').find('[[[') } }`, "not a selector"},
		"parseHTML a number": {`class Provider { async search() { parseHTML(42) } }`, "has to be a string"},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			_, err := r.Search(context.Background(), plugin(tc.code), SearchRequest{})
			if err == nil || !strings.Contains(err.Error(), tc.says) {
				t.Fatalf("%v; want it to say %q", err, tc.says)
			}
		})
	}
}

func TestEachStopsOnFalse(t *testing.T) {
	got := outcome(t, New(Options{Logger: zerolog.Nop()}), plugin(`
		class Provider {
			async search() {
				const seen = []
				parseHTML('<ul><li>a</li><li>b</li><li>c</li></ul>').find('li').each((i, li) => {
					seen.push(li.text())
					if (i === 1) return false
				})
				return [{ title: seen.join(''), infoHash: '0123456789abcdef0123456789abcdef01234567' }]
			}
		}`))

	if got != "ab" {
		t.Fatalf("%s", got)
	}
}

func TestStopFromTheCaller(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	time.AfterFunc(100*time.Millisecond, cancel)

	_, err := New(Options{Logger: zerolog.Nop()}).Search(ctx, plugin(`
		class Provider { async search() { for (;;) {} } }`), SearchRequest{})
	if err == nil {
		t.Fatal("ran on after the caller stopped it")
	}
}

func TestPublicAddr(t *testing.T) {
	for addr, public := range map[string]bool{
		"93.184.216.34":   true,
		"2606:4700::1111": true,
		"127.0.0.1":       false,
		"10.1.2.3":        false,
		"172.16.0.1":      false,
		"192.168.0.1":     false,
		"169.254.169.254": false,
		"100.64.0.1":      false,
		"0.0.0.0":         false,
		"255.255.255.255": false,
		"224.0.0.1":       false,
		"::1":             false,
		"::":              false,
		"fe80::1":         false,
		"fd12::1":         false,
		"::ffff:10.0.0.1": false,
		"64:ff9b::a00:1":  false,
		"2002:a00:1::":    false,
		"2001:0:a00:1::":  false,
		"198.18.0.1":      false,
	} {
		if got := publicAddr(netip.MustParseAddr(addr)); got != public {
			t.Errorf("%s: public %v, want %v", addr, got, public)
		}
	}
}

// The dialer refuses a name that answers with one local address among public
// ones, not only a name that answers with nothing but.
func TestOneLocalAnswerIsEnough(t *testing.T) {
	d := &dialer{
		resolve: func(context.Context, string) ([]netip.Addr, error) {
			return []netip.Addr{netip.MustParseAddr("93.184.216.34"), netip.MustParseAddr("127.0.0.1")}, nil
		},
		allow: publicAddr,
	}

	_, err := d.DialContext(context.Background(), "tcp", net.JoinHostPort("mixed.example.org", "80"))

	var local *LocalAddressError
	if !errors.As(err, &local) {
		t.Fatalf("%v; want it refused", err)
	}
}

// A site that never finishes its answer is cut off by the call's deadline:
// the request in flight is cancelled, not waited out.
func TestHangingSiteIsCutOff(t *testing.T) {
	release := make(chan struct{})

	s := newSite(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.(http.Flusher).Flush()
		<-release
	})

	// Cleanups run last first: the hanging handler has to be let go before
	// the server's Close waits for it.
	t.Cleanup(func() { close(release) })

	limits := DefaultLimits()
	limits.Call = 300 * time.Millisecond

	start := time.Now()
	_, err := s.runner(limits).Search(context.Background(), plugin(fmt.Sprintf(`
		class Provider {
			async search() {
				try { await fetch('http://tracker.example.org:%s/') } catch (e) {}
				for (;;) {}
			}
		}`, s.port), "tracker.example.org"), SearchRequest{})

	if !errors.Is(err, ErrTimeout) {
		t.Fatalf("%v; want a timeout", err)
	}
	if elapsed := time.Since(start); elapsed > 3*time.Second {
		t.Fatalf("cut off after %s", elapsed)
	}
}

func TestPostAndJSON(t *testing.T) {
	var method, contentType, body string
	s := newSite(t, func(w http.ResponseWriter, r *http.Request) {
		method, contentType = r.Method, r.Header.Get("Content-Type")
		raw := make([]byte, 64)
		n, _ := r.Body.Read(raw)
		body = string(raw[:n])
		w.Header().Set("X-Total", "1")
		fmt.Fprint(w, `{"items":[{"name":"from json"}]}`)
	})

	got := outcome(t, s.runner(DefaultLimits()), plugin(fmt.Sprintf(`
		class Provider {
			async search(request) {
				const res = await fetch('http://tracker.example.org:%s/api', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ q: request.query }),
				})
				const data = await res.json()
				return [{ title: data.items[0].name + ' ' + res.headers.get('x-total') + ' ' + res.headers.get('x-none'), infoHash: '0123456789abcdef0123456789abcdef01234567' }]
			}
		}`, s.port), "tracker.example.org"))

	if got != "from json 1 null" {
		t.Fatalf("%s", got)
	}
	if method != http.MethodPost || contentType != "application/json" || body != `{"q":"q"}` {
		t.Fatalf("the site saw %s %s %s", method, contentType, body)
	}
}

func TestConsoleGoesToTheLogWithinBounds(t *testing.T) {
	var log strings.Builder
	limits := DefaultLimits()
	limits.MaxLogLines = 3

	r := New(Options{Logger: zerolog.New(&log), Limits: limits})
	_, err := r.Search(context.Background(), plugin(`
		class Provider {
			async search() {
				for (let i = 0; i < 100; i++) console.log('line', i)
				console.error('never logged')
				return []
			}
		}`), SearchRequest{})
	if err != nil {
		t.Fatal(err)
	}

	lines := strings.Split(strings.TrimSpace(log.String()), "\n")
	if len(lines) != 4 {
		t.Fatalf("%d log lines, want three and a notice:\n%s", len(lines), log.String())
	}
	if !strings.Contains(lines[0], `"plugin":"test"`) || !strings.Contains(lines[0], `"message":"line 0"`) {
		t.Fatalf("first line %s", lines[0])
	}
	if !strings.Contains(lines[3], "logs too much") {
		t.Fatalf("last line %s", lines[3])
	}
}
