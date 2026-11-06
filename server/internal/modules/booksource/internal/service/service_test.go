package service

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/booksource/internal/source"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

type fakeSource struct {
	id, name string
	editions []source.Edition
	err      error

	queries []source.Query
	opened  []string
}

func (f *fakeSource) ID() string   { return f.id }
func (f *fakeSource) Name() string { return f.name }

func (f *fakeSource) Search(_ context.Context, query source.Query) ([]source.Edition, error) {
	f.queries = append(f.queries, query)

	return f.editions, f.err
}

func (f *fakeSource) Open(_ context.Context, ref, location string) (io.ReadCloser, error) {
	f.opened = append(f.opened, ref+" "+location)

	return io.NopCloser(strings.NewReader("PK\x03\x04")), nil
}

type fakeWorks map[string]*Work

func (f fakeWorks) Work(_ context.Context, mediaRef string) (*Work, error) {
	switch mediaRef {
	case "openlibrary:broken":
		return nil, errors.New("the provider is down")
	case "openlibrary:OL1W":
		return nil, apperr.New(apperr.KindNotFound, "Open Library has no such book")
	}

	return f[mediaRef], nil
}

const epub = "application/epub+zip"

func press() *fakeSource {
	return &fakeSource{
		id:   "press",
		name: "Open Press",
		editions: []source.Edition{
			{
				Ref:     "press:84",
				Title:   "Frankenstein; Or, The Modern Prometheus",
				Authors: []string{"Mary Wollstonecraft Shelley"},
				Formats: []source.Format{
					{Type: epub, Ext: ".epub", Size: 500, Location: "cache/epub/84/pg84-images-3.epub"},
					{Type: "text/html", Ext: ".html", Location: "ebooks/84.html.images"},
				},
			},
			// Nothing the library keeps.
			{Ref: "press:85", Title: "Audio", Formats: []source.Format{{Type: "audio/mpeg", Ext: ".mp3"}}},
		},
	}
}

type harness struct {
	svc   *Service
	press *fakeSource
	opds  *fakeSource
	now   time.Time
}

func newHarness() *harness {
	h := &harness{
		press: press(),
		opds:  &fakeSource{id: "opds:2", name: "Home Calibre", err: apperr.New(apperr.KindUpstream, "the server did not answer")},
		now:   time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC),
	}

	h.svc = New(Options{
		Sources: func(context.Context) []source.Source { return []source.Source{h.press, h.opds} },
		Works: fakeWorks{"openlibrary:OL450063W": {
			Title:   "Frankenstein",
			Authors: []string{"Mary Shelley"},
		}},
		Now: func() time.Time { return h.now },
	})

	return h
}

func TestSearchLooksForTheBookOfThePage(t *testing.T) {
	h := newHarness()

	result, err := h.svc.Search(context.Background(), "openlibrary:OL450063W", "")
	if err != nil {
		t.Fatal(err)
	}

	want := source.Query{Title: "Frankenstein", Authors: []string{"Mary Shelley"}}
	if len(h.press.queries) != 1 || h.press.queries[0].Title != want.Title ||
		strings.Join(h.press.queries[0].Authors, ",") != "Mary Shelley" {
		t.Errorf("queries = %+v", h.press.queries)
	}

	// Only the EPUB is left, of the one edition that has a format the library keeps.
	if len(result.Editions) != 1 {
		t.Fatalf("editions = %+v", result.Editions)
	}
	edition := result.Editions[0]
	if edition.Ref != "press:84" || edition.Source != "Open Press" ||
		len(edition.Formats) != 1 || edition.Formats[0].Type != epub {
		t.Errorf("edition = %+v", edition)
	}

	// The failed source says why, beside the results of the other.
	if len(result.Sources) != 2 ||
		result.Sources[0] != (SourceOutcome{ID: "press", Name: "Open Press", Results: 1}) ||
		result.Sources[1] != (SourceOutcome{ID: "opds:2", Name: "Home Calibre", Error: "the server did not answer"}) {
		t.Errorf("sources = %+v", result.Sources)
	}
}

func TestSearchNeedsSomethingToLookFor(t *testing.T) {
	h := newHarness()
	ctx := context.Background()

	if _, err := h.svc.Search(ctx, "", "  "); apperr.KindOf(err) != apperr.KindInvalid {
		t.Errorf("nothing: %v", err)
	}
	if _, err := h.svc.Search(ctx, "openlibrary:unknown", ""); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Errorf("a book the node does not know: %v", err)
	}
	if _, err := h.svc.Search(ctx, "openlibrary:broken", ""); apperr.KindOf(err) != apperr.KindUpstream {
		t.Errorf("a book the node cannot read: %v", err)
	}
	if _, err := h.svc.Search(ctx, "openlibrary:OL1W", ""); apperr.KindOf(err) != apperr.KindNotFound {
		t.Errorf("a book the provider does not have: %v", err)
	}

	if _, err := h.svc.Search(ctx, "", "frankenstein"); err != nil {
		t.Errorf("text alone: %v", err)
	}
	if len(h.press.queries) != 1 || h.press.queries[0].Text != "frankenstein" {
		t.Errorf("queries = %+v", h.press.queries)
	}
}

func TestPrepareTakesTheFileFromTheSearch(t *testing.T) {
	h := newHarness()
	ctx := context.Background()

	if _, err := h.svc.Search(ctx, "", "frankenstein"); err != nil {
		t.Fatal(err)
	}

	book, err := h.svc.Prepare("press:84", epub, "openlibrary:OL450063W")
	if err != nil {
		t.Fatal(err)
	}
	if book.Location != "cache/epub/84/pg84-images-3.epub" || book.Ext != ".epub" || book.Size != 500 ||
		book.MediaRef != "openlibrary:OL450063W" || book.SourceName != "Open Press" ||
		book.Authors != "Mary Wollstonecraft Shelley" {
		t.Errorf("book = %+v", book)
	}

	// A format the search dropped is not there to download.
	if _, err := h.svc.Prepare("press:84", "text/html", "openlibrary:OL450063W"); apperr.KindOf(err) != apperr.KindInvalid {
		t.Errorf("a dropped format: %v", err)
	}
	if _, err := h.svc.Prepare("press:84", epub, "OL450063W"); apperr.KindOf(err) != apperr.KindInvalid {
		t.Errorf("a media reference without a provider: %v", err)
	}
	if _, err := h.svc.Prepare("press:99", epub, "openlibrary:OL450063W"); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Errorf("a copy no search found: %v", err)
	}

	h.now = h.now.Add(editionTTL + time.Second)
	if _, err := h.svc.Prepare("press:84", epub, "openlibrary:OL450063W"); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Errorf("a copy found too long ago: %v", err)
	}
}

func TestOpenAsksTheSourceOfTheReference(t *testing.T) {
	h := newHarness()
	ctx := context.Background()

	body, err := h.svc.Open(ctx, "opds:2:urn:uuid:1", "/books/1/epub")
	if err != nil {
		t.Fatal(err)
	}
	_ = body.Close()

	if len(h.opds.opened) != 1 || h.opds.opened[0] != "opds:2:urn:uuid:1 /books/1/epub" || len(h.press.opened) != 0 {
		t.Errorf("opened: opds %v, press %v", h.opds.opened, h.press.opened)
	}

	if _, err := h.svc.Open(ctx, "opds:3:urn:uuid:1", "/books/1/epub"); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Errorf("a source that is gone: %v", err)
	}
}
