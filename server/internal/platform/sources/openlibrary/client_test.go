package openlibrary

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

func newTestClient(t *testing.T, contact string, handler http.HandlerFunc) *Client {
	t.Helper()

	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	return New(Options{Endpoint: server.URL, UserAgent: "mediary-node/test", Contact: contact, MinInterval: time.Millisecond})
}

func TestTheContactGoesInTheUserAgent(t *testing.T) {
	var agent string

	client := newTestClient(t, "someone@example.com", func(w http.ResponseWriter, r *http.Request) {
		agent = r.Header.Get("User-Agent")
		_, _ = w.Write([]byte(`{"numFound":0,"docs":[]}`))
	})

	if _, err := client.Search(context.Background(), SearchParams{Query: "dune"}); err != nil {
		t.Fatalf("search: %v", err)
	}

	if agent != "mediary-node/test (someone@example.com)" {
		t.Fatalf("user agent %q", agent)
	}

	if New(Options{Contact: "x"}).interval != contactInterval || New(Options{}).interval != anonymousInterval {
		t.Fatal("an identified client may ask three times a second, an anonymous one once")
	}
}

func TestSearchAsksForTheCardFields(t *testing.T) {
	var query map[string]string

	client := newTestClient(t, "", func(w http.ResponseWriter, r *http.Request) {
		query = map[string]string{}
		for key := range r.URL.Query() {
			query[key] = r.URL.Query().Get(key)
		}
		_, _ = w.Write([]byte(`{"numFound":1,"docs":[{"key":"/works/OL893414W","title":"Dune","author_name":["Frank Herbert"],"cover_i":11481354,"number_of_pages_median":608,"ratings_average":4.3,"ratings_count":448}]}`))
	})

	page, err := client.Search(context.Background(), SearchParams{Query: `dune subject:"fantasy"`, Sort: "rating", Page: 2, Limit: 20})
	if err != nil {
		t.Fatalf("search: %v", err)
	}

	if query["q"] != `dune subject:"fantasy"` || query["sort"] != "rating" || query["page"] != "2" || query["limit"] != "20" || query["fields"] != docFields {
		t.Fatalf("query %v", query)
	}

	doc := page.Docs[0]
	if doc.WorkID() != "OL893414W" || *doc.Pages != 608 || doc.AuthorName[0] != "Frank Herbert" {
		t.Fatalf("doc %+v", doc)
	}
}

func TestADescriptionIsTextEitherWay(t *testing.T) {
	var plain, typed Work

	if err := json.Unmarshal([]byte(`{"description":"A desert planet."}`), &plain); err != nil {
		t.Fatalf("plain: %v", err)
	}
	if err := json.Unmarshal([]byte(`{"description":{"type":"/type/text","value":"A desert planet."}}`), &typed); err != nil {
		t.Fatalf("typed: %v", err)
	}

	if plain.Description != "A desert planet." || typed.Description != "A desert planet." {
		t.Fatalf("plain %q typed %q", plain.Description, typed.Description)
	}
}

func TestAMissingWorkIsNotFound(t *testing.T) {
	client := newTestClient(t, "", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/search.json" {
			_, _ = w.Write([]byte(`{"numFound":0,"docs":[]}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	})

	if _, err := client.Work(context.Background(), "OL1W"); apperr.KindOf(err) != apperr.KindNotFound {
		t.Fatalf("work: %v", err)
	}

	if _, err := client.WorkDoc(context.Background(), "OL1W"); apperr.KindOf(err) != apperr.KindNotFound {
		t.Fatalf("work doc: %v", err)
	}

	if _, err := client.Work(context.Background(), "../etc"); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("a malformed id must not reach the network, got %v", err)
	}
}

func TestARateLimitedRequestIsRetried(t *testing.T) {
	var requests atomic.Int32

	client := newTestClient(t, "", func(w http.ResponseWriter, _ *http.Request) {
		if requests.Add(1) == 1 {
			w.Header().Set("Retry-After", "0")
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		_, _ = w.Write([]byte(`{"key":"/works/OL893414W","title":"Dune"}`))
	})

	work, err := client.Work(context.Background(), "OL893414W")
	if err != nil || work.Title != "Dune" || requests.Load() != 2 {
		t.Fatalf("work %+v, %v after %d requests", work, err, requests.Load())
	}
}

func TestEditionByISBNCleansTheNumber(t *testing.T) {
	var path string

	client := newTestClient(t, "", func(w http.ResponseWriter, r *http.Request) {
		path = r.URL.Path
		_, _ = w.Write([]byte(`{"key":"/books/OL1M","works":[{"key":"/works/OL893414W"}],"number_of_pages":604}`))
	})

	edition, err := client.EditionByISBN(context.Background(), "978-0-441-17271-9")
	if err != nil {
		t.Fatalf("edition: %v", err)
	}

	if path != "/isbn/9780441172719.json" || edition.WorkID() != "OL893414W" || *edition.Pages != 604 {
		t.Fatalf("path %s edition %+v", path, edition)
	}

	if _, err := client.EditionByISBN(context.Background(), "12345"); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("short isbn: %v", err)
	}
}

func TestCoverURL(t *testing.T) {
	id := 11481354

	if got := CoverURL(&id, "L"); got == nil || *got != "https://covers.openlibrary.org/b/id/11481354-L.jpg" {
		t.Fatalf("got %v", got)
	}

	zero := 0
	if CoverURL(nil, "L") != nil || CoverURL(&zero, "L") != nil {
		t.Fatal("no id, no cover")
	}
}
