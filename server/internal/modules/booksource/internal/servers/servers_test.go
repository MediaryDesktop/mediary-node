package servers

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/source"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/db"
	"github.com/mediaryorg/mediary-node/server/internal/platform/secrets"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/opds"
)

const calibreRoot = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>calibre-web</id>
  <title>Calibre-Web</title>
  <link rel="search" href="/opds/search/{searchTerms}" type="application/atom+xml"/>
</feed>`

const calibreSearch = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:dcterms="http://purl.org/dc/terms/">
  <id>search</id>
  <title>Search</title>
  <entry>
    <title>Dune</title>
    <id>urn:uuid:dune</id>
    <author><name>Frank Herbert</name></author>
    <dcterms:language>eng</dcterms:language>
    <dcterms:issued>1965-08-01</dcterms:issued>
    <link rel="http://opds-spec.org/acquisition" href="/opds/download/1/epub/" length="812345" type="application/epub+zip"/>
    <link rel="http://opds-spec.org/acquisition" href="/opds/download/1/pdf/" length="2345678" type="application/pdf"/>
    <link rel="http://opds-spec.org/acquisition" href="/opds/download/1/cbz/" type="application/x-cbz"/>
  </entry>
  <entry>
    <title>Dune: A Graphic Novel</title>
    <id>urn:uuid:graphic</id>
    <author><name>Raúl Allén</name></author>
    <link rel="http://opds-spec.org/acquisition" href="/opds/download/2/epub/" type="application/epub+zip"/>
  </entry>
  <entry>
    <title>Dune (no author given)</title>
    <id>urn:uuid:anonymous</id>
    <link rel="http://opds-spec.org/acquisition" href="/opds/download/3/epub/" type="application/epub+zip"/>
  </entry>
  <entry>
    <title>Dune comics only</title>
    <id>urn:uuid:comics</id>
    <author><name>Frank Herbert</name></author>
    <link rel="http://opds-spec.org/acquisition" href="/opds/download/4/cbz/" type="application/x-cbz"/>
  </entry>
</feed>`

// Standard Ebooks: an e-mail and no password, two EPUBs, and an AZW3 given the
// MOBI type.
const standardSearch = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/terms/">
  <id>search</id>
  <title>Search results</title>
  <entry>
    <id>https://standardebooks.org/ebooks/mary-shelley/frankenstein</id>
    <title>Frankenstein</title>
    <author><name>Mary Shelley</name></author>
    <dc:issued>1818-01-01T00:00:00Z</dc:issued>
    <link href="/ebooks/mary-shelley/frankenstein/downloads/mary-shelley_frankenstein.epub" length="563210" rel="http://opds-spec.org/acquisition/open-access" type="application/epub+zip"/>
    <link href="/ebooks/mary-shelley/frankenstein/downloads/mary-shelley_frankenstein_advanced.epub" rel="http://opds-spec.org/acquisition/open-access" type="application/epub+zip"/>
    <link href="/ebooks/mary-shelley/frankenstein/downloads/mary-shelley_frankenstein.azw3" length="701234" rel="http://opds-spec.org/acquisition/open-access" type="application/x-mobipocket-ebook"/>
  </entry>
</feed>`

type catalogue struct {
	*httptest.Server

	user, pass string
	routes     map[string]string

	mu      sync.Mutex
	queries []string
}

func newCatalogue(t *testing.T, user, pass string, routes map[string]string) *catalogue {
	t.Helper()

	c := &catalogue{user: user, pass: pass, routes: routes}
	c.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotUser, gotPass, _ := r.BasicAuth()
		if gotUser != c.user || gotPass != c.pass {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		c.mu.Lock()
		c.queries = append(c.queries, r.URL.Path)
		c.mu.Unlock()

		body, ok := c.routes[r.URL.Path]
		if !ok {
			http.NotFound(w, r)
			return
		}

		if target, redirect := strings.CutPrefix(body, "redirect:"); redirect {
			http.Redirect(w, r, target, http.StatusFound)
			return
		}

		if strings.HasPrefix(body, "<?xml") {
			w.Header().Set("Content-Type", "application/atom+xml")
		} else {
			w.Header().Set("Content-Type", "application/octet-stream")
		}
		_, _ = io.WriteString(w, body)
	}))
	t.Cleanup(c.Close)

	return c
}

func (c *catalogue) last() string {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.queries[len(c.queries)-1]
}

func newServers(t *testing.T) *Servers {
	t.Helper()

	ctx := context.Background()
	dir := t.TempDir()

	database, err := db.Open(ctx, filepath.Join(dir, "node.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = database.Close() })

	if err = db.Migrate(ctx, database, zerolog.Nop()); err != nil {
		t.Fatal(err)
	}

	return New(Options{
		DB:        database,
		Client:    opds.New(5*time.Second, "mediary-node/test"),
		Passwords: secrets.New(filepath.Join(dir, "book-opds-secrets.json")),
		Logger:    zerolog.Nop(),
	})
}

func password(value string) *string { return &value }

func calibre(t *testing.T) *catalogue {
	t.Helper()

	return newCatalogue(t, "reader", "secret", map[string]string{
		"/opds":                  calibreRoot,
		"/opds/search/Dune":      calibreSearch,
		"/opds/search/a":         `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><id>s</id><title>Search</title></feed>`,
		"/opds/download/1/epub/": "PK\x03\x04dune",
	})
}

func addCalibre(t *testing.T, s *Servers, c *catalogue) *Server {
	t.Helper()

	server, err := s.Create(context.Background(), Input{
		Name: "Home Calibre", URL: c.URL + "/opds", Username: "reader", Password: password("secret"),
	})
	if err != nil {
		t.Fatal(err)
	}

	return server
}

func TestServersKeepThePasswordToThemselves(t *testing.T) {
	s := newServers(t)
	ctx := context.Background()

	server, err := s.Create(ctx, Input{
		Name: " Home Calibre ", URL: "http://nas:8083/opds#top", Username: "reader", Password: password("secret"),
	})
	if err != nil {
		t.Fatal(err)
	}
	if *server != (Server{ID: server.ID, Name: "Home Calibre", URL: "http://nas:8083/opds", Username: "reader", HasPassword: true}) {
		t.Errorf("server = %+v", server)
	}

	// No password given keeps the one stored; an empty one removes it.
	if server, err = s.Update(ctx, server.ID, Input{Name: "NAS", URL: "http://nas:8083/opds", Username: "reader"}); err != nil || !server.HasPassword {
		t.Errorf("updated without a password: %+v, %v", server, err)
	}
	if server, err = s.Update(ctx, server.ID, Input{Name: "NAS", URL: "http://nas:8083/opds", Password: password("")}); err != nil || server.HasPassword {
		t.Errorf("updated with an empty password: %+v, %v", server, err)
	}

	for _, in := range []Input{
		{Name: "", URL: "http://nas/opds"},
		{Name: "NAS", URL: "nas/opds"},
		{Name: "NAS", URL: "ftp://nas/opds"},
		{Name: "NAS", URL: "http://reader:secret@nas/opds"},
		{Name: strings.Repeat("n", 101), URL: "http://nas/opds"},
	} {
		if _, err = s.Create(ctx, in); apperr.KindOf(err) != apperr.KindInvalid {
			t.Errorf("Create(%+v): %v", in, err)
		}
	}

	if _, err = s.Update(ctx, 99, Input{Name: "NAS", URL: "http://nas/opds"}); apperr.KindOf(err) != apperr.KindNotFound {
		t.Errorf("updating a server that is not there: %v", err)
	}

	if err = s.Delete(ctx, server.ID); err != nil {
		t.Fatal(err)
	}
	if err = s.Delete(ctx, server.ID); apperr.KindOf(err) != apperr.KindNotFound {
		t.Errorf("deleting twice: %v", err)
	}
	if list, _ := s.List(ctx); len(list) != 0 {
		t.Errorf("servers = %+v", list)
	}
}

func TestAServerIsSearchedForTheBookOfThePage(t *testing.T) {
	c := calibre(t)
	s := newServers(t)
	server := addCalibre(t, s, c)
	ctx := context.Background()

	sources := s.Sources(ctx)
	if len(sources) != 1 || sources[0].ID() != "opds:1" || sources[0].Name() != "Home Calibre" || server.ID != 1 {
		t.Fatalf("sources = %+v", sources)
	}

	editions, err := sources[0].Search(ctx, source.Query{Title: "Dune: Deluxe Edition", Authors: []string{"Frank Herbert"}})
	if err != nil {
		t.Fatal(err)
	}

	// The catalogue is asked for the title without its subtitle.
	if got := c.last(); got != "/opds/search/Dune" {
		t.Errorf("searched %s", got)
	}

	// Another author's book is left out; one with no author named is kept; one
	// only in a format the library does not keep is gone.
	refs := make([]string, 0, len(editions))
	for i := range editions {
		refs = append(refs, editions[i].Ref)
	}
	if strings.Join(refs, " ") != "opds:1:urn:uuid:dune opds:1:urn:uuid:anonymous" {
		t.Fatalf("editions %v", refs)
	}

	dune := editions[0]
	if dune.Title != "Dune" || dune.Year != 1965 || dune.Language != "eng" || dune.Source != "Home Calibre" || len(dune.Formats) != 2 ||
		dune.Formats[0] != (source.Format{Type: "application/epub+zip", Ext: ".epub", Size: 812345, Location: "/opds/download/1/epub/"}) ||
		dune.Formats[1].Ext != ".pdf" {
		t.Errorf("edition = %+v", dune)
	}

	body, err := sources[0].Open(ctx, dune.Ref, dune.Formats[0].Location)
	if err != nil {
		t.Fatal(err)
	}
	data, _ := io.ReadAll(body)
	_ = body.Close()

	if string(data) != "PK\x03\x04dune" {
		t.Errorf("read %q", data)
	}
}

func TestStandardEbooksTakesAnEmailAlone(t *testing.T) {
	c := newCatalogue(t, "patron@example.org", "", map[string]string{
		"/feeds/opds":               calibreRoot,
		"/opds/search/frankenstein": standardSearch,
	})
	s := newServers(t)
	ctx := context.Background()

	if _, err := s.Create(ctx, Input{Name: "Standard Ebooks", URL: c.URL + "/feeds/opds", Username: "patron@example.org"}); err != nil {
		t.Fatal(err)
	}

	editions, err := s.Sources(ctx)[0].Search(ctx, source.Query{Text: "frankenstein"})
	if err != nil {
		t.Fatal(err)
	}
	if len(editions) != 1 {
		t.Fatalf("editions = %+v", editions)
	}

	// The compatible EPUB, not the advanced one; the AZW3 by its name.
	formats := editions[0].Formats
	if len(formats) != 2 ||
		formats[0].Location != "/ebooks/mary-shelley/frankenstein/downloads/mary-shelley_frankenstein.epub" ||
		formats[1] != (source.Format{Type: "application/x-mobi8-ebook", Ext: ".azw3", Size: 701234, Location: "/ebooks/mary-shelley/frankenstein/downloads/mary-shelley_frankenstein.azw3"}) ||
		editions[0].Year != 1818 {
		t.Errorf("edition = %+v", editions[0])
	}
}

func TestCheckSaysWhatIsWrong(t *testing.T) {
	c := calibre(t)
	s := newServers(t)
	server := addCalibre(t, s, c)
	ctx := context.Background()

	for _, tc := range []struct {
		name string
		in   CheckInput
		want string
	}{
		{"works", CheckInput{URL: c.URL + "/opds", Username: "reader", Password: password("secret")}, ""},
		{"stored password", CheckInput{ServerID: &server.ID, URL: c.URL + "/opds", Username: "reader"}, ""},
		{"wrong password", CheckInput{URL: c.URL + "/opds", Username: "reader", Password: password("guess")}, "unauthorized"},
		{"not a catalogue", CheckInput{URL: c.URL + "/nothing", Username: "reader", Password: password("secret")}, "not_opds"},
		{"nobody there", CheckInput{URL: "http://127.0.0.1:1/opds"}, "unreachable"},
	} {
		result, err := s.Check(ctx, tc.in)
		if err != nil {
			t.Fatalf("%s: %v", tc.name, err)
		}
		if result.OK != (tc.want == "") || result.Problem != tc.want {
			t.Errorf("%s: %+v", tc.name, result)
		}
	}

	if _, err := s.Check(ctx, CheckInput{URL: "nas"}); apperr.KindOf(err) != apperr.KindInvalid {
		t.Errorf("a bad address: %v", err)
	}
}

// A catalogue without a search is told about when checked, and takes no part
// in searches rather than failing each one.
func TestACatalogueWithoutSearchSitsOut(t *testing.T) {
	c := newCatalogue(t, "", "", map[string]string{
		"/opds": `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><id>x</id><title>Kavita</title></feed>`,
	})
	s := newServers(t)
	ctx := context.Background()

	result, err := s.Check(ctx, CheckInput{URL: c.URL + "/opds"})
	if err != nil || result.Problem != "no_search" {
		t.Errorf("check: %+v, %v", result, err)
	}

	if _, err = s.Create(ctx, Input{Name: "Kavita", URL: c.URL + "/opds"}); err != nil {
		t.Fatal(err)
	}
	editions, err := s.Sources(ctx)[0].Search(ctx, source.Query{Text: "dune"})
	if err != nil || len(editions) != 0 {
		t.Errorf("search: %+v, %v", editions, err)
	}
}

// A file the server sends from elsewhere is not followed, and the user is told
// so without the addresses.
func TestAFileFromAnotherHostIsRefused(t *testing.T) {
	elsewhere := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "PK\x03\x04not from the server")
	}))
	defer elsewhere.Close()

	c := calibre(t)
	c.routes["/opds/download/9/epub/"] = "redirect:" + elsewhere.URL + "/book.epub"
	s := newServers(t)
	addCalibre(t, s, c)
	ctx := context.Background()

	_, err := s.Sources(ctx)[0].Open(ctx, "opds:1:urn:uuid:nine", "/opds/download/9/epub/")

	var appErr *apperr.Error
	if !errors.As(err, &appErr) || appErr.Message != "Home Calibre: the server sent the file from another address, which Mediary does not follow" {
		t.Errorf("open: %v", err)
	}
}

// A server removed while a book from it waits in the queue: the download fails
// saying so, rather than reaching for another server.
func TestARemovedServerIsNotOpened(t *testing.T) {
	c := calibre(t)
	s := newServers(t)
	server := addCalibre(t, s, c)
	ctx := context.Background()

	src := s.Sources(ctx)[0]
	if err := s.Delete(ctx, server.ID); err != nil {
		t.Fatal(err)
	}

	if _, err := src.Open(ctx, "opds:1:urn:uuid:dune", "/opds/download/1/epub/"); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Errorf("open: %v", err)
	}
}
