package opds

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// komga serves the feeds recorded from a real Komga, rewritten to its own address.
func komga(t *testing.T) Server {
	t.Helper()

	read := func(name string) string {
		data, err := os.ReadFile(filepath.Join("testdata", "komga", name))
		if err != nil {
			t.Fatal(err)
		}

		return string(data)
	}

	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if user, pass, ok := r.BasicAuth(); !ok || user != "reader" || pass != "secret" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		serve := func(name, contentType string) {
			w.Header().Set("Content-Type", contentType)
			_, _ = w.Write([]byte(strings.ReplaceAll(read(name), "http://komga.test", srv.URL)))
		}

		switch {
		case r.URL.Path == "/opds/v1.2/catalog":
			serve("catalog.xml", "application/atom+xml")
		case r.URL.Path == "/opds/v1.2/search":
			serve("opensearch.xml", "application/opensearchdescription+xml")
		case r.URL.Path == "/opds/v1.2/series" && r.URL.Query().Get("search") == "berserk":
			serve("search.xml", "application/atom+xml")
		case r.URL.Path == "/opds/v1.2/series/0RTZ92JHQ80P8":
			serve("series.xml", "application/atom+xml")
		case strings.HasPrefix(r.URL.Path, "/opds/v1.2/books/0RTZ92JHZ8C7B/pages/"):
			w.Header().Set("Content-Type", "image/png")
			_, _ = w.Write([]byte("\x89PNG page " + strings.TrimPrefix(r.URL.Path, "/opds/v1.2/books/0RTZ92JHZ8C7B/pages/")))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)

	return Server{URL: srv.URL + "/opds/v1.2/catalog", Username: "reader", Password: "secret"}
}

func TestSearchFindsTheSeries(t *testing.T) {
	server := komga(t)

	series, err := New(5*time.Second, "test").Search(context.Background(), server, "berserk")
	if err != nil {
		t.Fatal(err)
	}

	if len(series) != 1 || series[0].ID != "/opds/v1.2/series/0RTZ92JHQ80P8" || series[0].Title != "Berserk" {
		t.Errorf("series = %+v", series)
	}
}

func TestBooksCarryNumbersAndPageStreams(t *testing.T) {
	server := komga(t)
	client := New(5*time.Second, "test")

	books, err := client.Books(context.Background(), server, "/opds/v1.2/series/0RTZ92JHQ80P8")
	if err != nil {
		t.Fatal(err)
	}

	numbers := map[string]Book{}
	for _, book := range books {
		numbers[book.Number] = book
	}
	if len(books) != 3 || numbers["12"].Pages != 5 || numbers["13.5"].Title != "Berserk Chapter 13.5" {
		t.Fatalf("books = %+v", books)
	}

	twelve := numbers["12"]
	if twelve.PageTemplate != "/opds/v1.2/books/0RTZ92JHZ8C7B/pages/{pageNumber}" {
		t.Errorf("template = %q", twelve.PageTemplate)
	}

	data, contentType, err := client.Page(context.Background(), server, twelve.PageTemplate, 3)
	if err != nil || contentType != "image/png" || string(data) != "\x89PNG page 3" {
		t.Errorf("page = %q %q %v", data, contentType, err)
	}
}

func TestAWrongPasswordIsNamedAsSuch(t *testing.T) {
	server := komga(t)
	server.Password = "wrong"

	if err := New(5*time.Second, "test").Check(context.Background(), server); !errors.Is(err, ErrUnauthorized) {
		t.Errorf("err = %v, want unauthorized", err)
	}
}

func TestAPageThatIsNotAFeedIsNotOPDS(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("<!doctype html><html><body>Login</body></html>"))
	}))
	defer srv.Close()

	err := New(5*time.Second, "test").Check(context.Background(), Server{URL: srv.URL})
	if !errors.Is(err, ErrNotOPDS) {
		t.Errorf("err = %v, want not OPDS", err)
	}
}

func TestAnUnreachableServerIsNamedAsSuch(t *testing.T) {
	srv := httptest.NewServer(http.NotFoundHandler())
	address := srv.URL
	srv.Close()

	if err := New(time.Second, "test").Check(context.Background(), Server{URL: address}); !errors.Is(err, ErrUnreachable) {
		t.Errorf("err = %v, want unreachable", err)
	}
}

func TestTheSeriesFeedIsFollowedAcrossPages(t *testing.T) {
	entry := func(title string) string {
		return `<entry><id>` + title + `</id><title>` + title + `</title></entry>`
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next := ""
		if r.URL.Query().Get("page") != "1" {
			next = `<link rel="next" type="application/atom+xml" href="?page=1"/>`
		}
		body := `<feed xmlns="http://www.w3.org/2005/Atom">` + next
		if r.URL.Query().Get("page") == "1" {
			body += entry("Ch 2")
		} else {
			body += entry("Ch 1")
		}
		_, _ = w.Write([]byte(body + `</feed>`))
	}))
	defer srv.Close()

	books, err := New(5*time.Second, "test").Books(context.Background(), Server{URL: srv.URL + "/catalog"}, "/series/1")
	if err != nil || len(books) != 2 || books[1].Number != "2" {
		t.Errorf("books = %+v, err = %v", books, err)
	}
}

func TestALinkToAnotherHostIsNeverFollowed(t *testing.T) {
	var asked bool
	other := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { asked = true }))
	defer other.Close()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`<feed xmlns="http://www.w3.org/2005/Atom"><link rel="next" type="application/atom+xml" href="` + other.URL + `/steal"/></feed>`))
	}))
	defer srv.Close()

	_, err := New(5*time.Second, "test").Books(context.Background(), Server{URL: srv.URL, Password: "secret"}, "/series")
	if !errors.Is(err, ErrOtherHost) || asked {
		t.Errorf("err = %v, other host asked = %v", err, asked)
	}

	redirect := httptest.NewServer(http.RedirectHandler(other.URL+"/steal", http.StatusFound))
	defer redirect.Close()

	if err := New(5*time.Second, "test").Check(context.Background(), Server{URL: redirect.URL, Password: "secret"}); !errors.Is(err, ErrOtherHost) || asked {
		t.Errorf("redirect: err = %v, other host asked = %v", err, asked)
	}
}

func TestChapterNumber(t *testing.T) {
	for title, want := range map[string]string{
		"Berserk Chapter 12":   "12",
		"Berserk Chapter 13.5": "13.5",
		"Vol. 2 Ch. 13":        "13",
		"Vol.2 Ch.013":         "13",
		"Berserk 014":          "14",
		"One Piece #1050":      "1050",
		"Chapter 0":            "0",
		"Oneshot":              "",
		"Berserk Deluxe":       "",
	} {
		if got := ChapterNumber(title); got != want {
			t.Errorf("ChapterNumber(%q) = %q, want %q", title, got, want)
		}
	}
}
