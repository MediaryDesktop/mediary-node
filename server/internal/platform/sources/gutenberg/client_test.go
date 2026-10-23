package gutenberg

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

const lastModified = "Sun, 18 Oct 2026 21:30:58 GMT"

type site struct {
	*httptest.Server

	mu       sync.Mutex
	requests []*http.Request
	status   int
}

func newSite(t *testing.T, elsewhere string) *site {
	t.Helper()

	s := &site{}
	s.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		s.requests = append(s.requests, r)
		status := s.status
		s.mu.Unlock()

		if status != 0 {
			w.WriteHeader(status)
			return
		}

		switch r.URL.Path {
		case catalogPath:
			if r.Header.Get("If-Modified-Since") == lastModified {
				w.WriteHeader(http.StatusNotModified)
				return
			}
			w.Header().Set("Last-Modified", lastModified)
			_, _ = io.WriteString(w, "catalogue")
		case "/cache/epub/84/pg84-images-3.epub":
			_, _ = io.WriteString(w, "PK\x03\x04book")
		case "/ebooks/84.epub3.images":
			http.Redirect(w, r, "/cache/epub/84/pg84-images-3.epub", http.StatusFound)
		case "/cache/epub/85/pg85-images-3.epub":
			http.Redirect(w, r, elsewhere+"/book.epub", http.StatusFound)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(s.Close)

	return s
}

func (s *site) count() int {
	s.mu.Lock()
	defer s.mu.Unlock()

	return len(s.requests)
}

func newClient(t *testing.T, endpoint string, interval time.Duration) *Client {
	t.Helper()

	client, err := New(Options{
		Endpoint:    endpoint,
		UserAgent:   "mediary-node/test",
		Contact:     "admin@example.org",
		MinInterval: interval,
	})
	if err != nil {
		t.Fatal(err)
	}

	return client
}

func TestCatalogAsksWhetherItChanged(t *testing.T) {
	s := newSite(t, "")
	client := newClient(t, s.URL, time.Millisecond)
	ctx := context.Background()

	catalog, err := client.Catalog(ctx, "")
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(catalog.Body)
	_ = catalog.Body.Close()

	if string(body) != "catalogue" || catalog.LastModified != lastModified {
		t.Errorf("catalogue %q, last modified %q", body, catalog.LastModified)
	}

	if _, err := client.Catalog(ctx, lastModified); !errors.Is(err, ErrNotModified) {
		t.Errorf("unchanged: %v", err)
	}

	// The site can tell who is asking, and reach them.
	if agent := s.requests[0].Header.Get("User-Agent"); agent != "mediary-node/test (+admin@example.org)" {
		t.Errorf("User-Agent = %q", agent)
	}
}

func TestBookIsTheEPUBWithImages(t *testing.T) {
	s := newSite(t, "")
	client := newClient(t, s.URL, time.Millisecond)

	body, err := client.Book(context.Background(), 84)
	if err != nil {
		t.Fatal(err)
	}
	data, _ := io.ReadAll(body)
	_ = body.Close()

	if string(data) != "PK\x03\x04book" || s.requests[0].URL.Path != "/cache/epub/84/pg84-images-3.epub" {
		t.Errorf("read %q from %s", data, s.requests[0].URL.Path)
	}

	if _, err := client.Book(context.Background(), 0); apperr.KindOf(err) != apperr.KindInvalid {
		t.Errorf("book 0: %v", err)
	}
	if _, err := client.Book(context.Background(), 99); apperr.KindOf(err) != apperr.KindNotFound {
		t.Errorf("a book with no EPUB: %v", err)
	}
}

func TestARedirectStaysOnTheSite(t *testing.T) {
	other := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "PK\x03\x04not from gutenberg")
	}))
	defer other.Close()

	s := newSite(t, other.URL)
	client := newClient(t, s.URL, time.Millisecond)

	if _, err := client.Book(context.Background(), 85); err == nil {
		t.Error("followed a redirect to another host")
	}

	// Its own redirects are followed.
	resp, err := client.get(context.Background(), "/ebooks/84.epub3.images", "")
	if err != nil {
		t.Fatalf("a redirect on the site: %v", err)
	}
	_ = resp.Body.Close()
}

// A site that asks to slow down is told about at once and not asked again.
func TestABusySiteIsNotRetried(t *testing.T) {
	for _, status := range []int{http.StatusTooManyRequests, http.StatusServiceUnavailable, http.StatusForbidden} {
		s := newSite(t, "")
		s.status = status
		client := newClient(t, s.URL, time.Millisecond)

		_, err := client.Catalog(context.Background(), "")
		if apperr.KindOf(err) != apperr.KindUnavailable || s.count() != 1 {
			t.Errorf("%d: %v after %d requests", status, err, s.count())
		}
	}
}

func TestRequestsAreSpacedOut(t *testing.T) {
	s := newSite(t, "")
	client := newClient(t, s.URL, 100*time.Millisecond)
	ctx := context.Background()

	start := time.Now()
	for range 3 {
		body, err := client.Book(ctx, 84)
		if err != nil {
			t.Fatal(err)
		}
		_ = body.Close()
	}

	if elapsed := time.Since(start); elapsed < 200*time.Millisecond {
		t.Errorf("three books in %v", elapsed)
	}
}

func TestNewNeedsAnAddress(t *testing.T) {
	for _, endpoint := range []string{"", "gutenberg.org", "ftp://gutenberg.org"} {
		if _, err := New(Options{Endpoint: endpoint}); err == nil {
			t.Errorf("endpoint %q accepted", endpoint)
		}
	}
}
