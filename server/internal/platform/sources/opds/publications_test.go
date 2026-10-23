package opds

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

// catalogue serves hand-written feeds shaped as a book catalogue writes them,
// with origin in the fixtures replaced by the test server's own address.
func catalogue(t *testing.T, dir, origin, user, pass string, routes map[string]string) *httptest.Server {
	t.Helper()

	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if gotUser, gotPass, ok := r.BasicAuth(); !ok || gotUser != user || gotPass != pass {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		key := r.URL.Path
		if r.URL.RawQuery != "" {
			key += "?" + r.URL.RawQuery
		}

		name, ok := routes[key]
		if !ok {
			http.NotFound(w, r)
			return
		}

		if strings.HasPrefix(name, "file:") {
			w.Header().Set("Content-Type", "application/epub+zip; charset=binary")
			_, _ = w.Write([]byte(strings.TrimPrefix(name, "file:")))
			return
		}

		data, err := os.ReadFile(filepath.Join("testdata", dir, name))
		if err != nil {
			t.Error(err)
			return
		}

		if origin != "" {
			data = []byte(strings.ReplaceAll(string(data), origin, srv.URL))
		}

		w.Header().Set("Content-Type", "application/atom+xml")
		_, _ = w.Write(data)
	}))
	t.Cleanup(srv.Close)

	return srv
}

func TestCalibreWebSearchKeepsBooksWithFiles(t *testing.T) {
	srv := catalogue(t, "calibreweb", "", "reader", "secret", map[string]string{
		"/opds":             "catalog.xml",
		"/opds/search/dune": "search.xml",
	})
	server := Server{URL: srv.URL + "/opds", Username: "reader", Password: "secret"}

	pubs, err := New(5*time.Second, "test").SearchPublications(context.Background(), server, "dune")
	if err != nil {
		t.Fatal(err)
	}

	// The author's navigation entry, the book only for sale and the file on
	// another server are left out.
	want := []Publication{{
		ID:       "urn:uuid:8b2c1f3e-0000-4000-8000-000000000001",
		Title:    "Dune",
		Authors:  []string{"Frank Herbert"},
		Language: "eng",
		Issued:   "1965-08-01",
		Summary:  "A desert planet and the spice.",
		Files: []File{
			{Path: "/opds/download/1/epub/", Type: "application/epub+zip", Length: 812345},
			{Path: "/opds/download/1/pdf/", Type: "application/pdf", Length: 2345678},
		},
	}}
	if !reflect.DeepEqual(pubs, want) {
		t.Errorf("publications =\n%+v\nwant\n%+v", pubs, want)
	}
}

// Standard Ebooks describes its search with OpenSearch, marks its files
// open-access, and takes a patron's e-mail with an empty password.
func TestStandardEbooksSearchThroughOpenSearch(t *testing.T) {
	srv := catalogue(t, "standardebooks", "https://standardebooks.test", "patron@example.org", "", map[string]string{
		"/feeds/opds":                        "catalog.xml",
		"/ebooks/opensearch":                 "opensearch.xml",
		"/feeds/opds/all?query=frankenstein": "search.xml",
	})
	server := Server{URL: srv.URL + "/feeds/opds", Username: "patron@example.org"}

	pubs, err := New(5*time.Second, "test").SearchPublications(context.Background(), server, "frankenstein")
	if err != nil {
		t.Fatal(err)
	}

	if len(pubs) != 1 {
		t.Fatalf("publications = %+v", pubs)
	}

	pub := pubs[0]
	if pub.Title != "Frankenstein" || !reflect.DeepEqual(pub.Authors, []string{"Mary Shelley"}) ||
		pub.Language != "en-GB" || pub.Issued != "1818-01-01T00:00:00Z" {
		t.Errorf("publication = %+v", pub)
	}

	wantFiles := []File{
		{
			Path:   "/ebooks/mary-shelley/frankenstein/downloads/mary-shelley_frankenstein.epub",
			Type:   "application/epub+zip",
			Length: 563210,
		},
		{
			Path:   "/ebooks/mary-shelley/frankenstein/downloads/mary-shelley_frankenstein.azw3",
			Type:   "application/x-mobipocket-ebook",
			Length: 701234,
		},
	}
	if !reflect.DeepEqual(pub.Files, wantFiles) {
		t.Errorf("files = %+v", pub.Files)
	}
}

func TestOpenGivesTheTypeAndStopsPastTheLimit(t *testing.T) {
	srv := catalogue(t, "calibreweb", "", "reader", "secret", map[string]string{
		"/opds/download/1/epub/": "file:PK0123456789",
	})
	server := Server{URL: srv.URL + "/opds", Username: "reader", Password: "secret"}
	client := New(5*time.Second, "test")

	body, contentType, err := client.Open(context.Background(), server, "/opds/download/1/epub/", 4)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = body.Close() }()

	data, err := io.ReadAll(body)
	if err != nil {
		t.Fatal(err)
	}

	// One byte past the limit is how the caller learns the file was too large.
	if string(data) != "PK012" || contentType != "application/epub+zip" {
		t.Errorf("read %q of type %q", data, contentType)
	}

	if _, _, err := client.Open(context.Background(), server, "https://other.example/book.epub", 4); err == nil {
		t.Error("opened a file on another server with the catalogue's password")
	}
}
