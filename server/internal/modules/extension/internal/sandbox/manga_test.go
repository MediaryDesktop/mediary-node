package sandbox

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// A PNG's first bytes: enough for the node to see an image.
var pngBytes = []byte("\x89PNG\x0D\x0A\x1A\x0Afake image data")

// comicsSite is the made-up site the manga example reads, all of it on one
// local server: the pages' host is a name for it too.
func comicsSite(t *testing.T) (*site, Plugin) {
	t.Helper()

	var s *site
	s = newSite(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/search":
			fmt.Fprintf(w, `<div class="series" data-id="frieren/1"><a class="title"> Sousou no
				Frieren </a><span class="year">2020</span></div>
				<div class="series" data-id=""><a class="title">No id</a></div>`)
		case r.URL.Path == "/api/series/frieren%2F1/chapters" || r.URL.RawPath == "/api/series/frieren%2F1/chapters":
			fmt.Fprint(w, `[
				{"id": "c:1", "chapter": "1", "title": "The End", "volume": "1", "lang": "en", "group": "Scans", "date": "2020-04-28T00:00:00Z"},
				{"id": "c:1.5", "chapter": "1.5", "lang": "en"},
				{"id": "c:1-uk", "chapter": "1", "lang": "uk"},
				{"chapter": "2", "lang": "en"}
			]`)
		case strings.HasPrefix(r.URL.Path, "/api/chapters/"):
			fmt.Fprintf(w, `{"base": "http://img.comics.example.org:%s/img", "files": ["001.png", "002.png"]}`, s.port)
		case strings.HasPrefix(r.URL.Path, "/img/"):
			if r.Header.Get("Referer") != "http://comics.example.org:"+s.port+"/" {
				http.Error(w, "hotlinking", http.StatusForbidden)
				return
			}
			_, _ = w.Write(pngBytes)
		default:
			http.NotFound(w, r)
		}
	})

	code, err := os.ReadFile(filepath.Join("..", "manifest", "testdata", "manga-example", "plugin.js"))
	if err != nil {
		t.Fatal(err)
	}

	return s, Plugin{
		ID:      "example-comics",
		Code:    strings.Replace(string(code), "'https://comics.example.org'", "'http://comics.example.org:"+s.port+"'", 1),
		Network: []string{"comics.example.org", "img.comics.example.org"},
		Config:  map[string]string{"language": "en"},
	}
}

func TestMangaExampleFindsSeriesChaptersAndPages(t *testing.T) {
	s, p := comicsSite(t)
	r := s.runner(DefaultLimits())
	ctx := context.Background()

	series, err := r.MangaSearch(ctx, p, MangaSearchRequest{Query: "frieren", Titles: []string{"Sousou no Frieren"}})
	if err != nil {
		t.Fatal(err)
	}
	if len(series) != 1 || series[0].ID != "frieren/1" || series[0].Title != "Sousou no Frieren" || series[0].Detail != "2020" {
		t.Fatalf("series = %+v; the one without an id is left out", series)
	}

	chapters, err := r.MangaChapters(ctx, p, series[0].ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(chapters) != 2 {
		t.Fatalf("chapters = %+v; want the two English ones with an id", chapters)
	}
	first := chapters[0]
	if first.ID != "c:1" || first.Number != "1" || first.Title != "The End" || first.Volume != "1" ||
		first.Language != "en" || len(first.Groups) != 1 || first.Groups[0] != "Scans" || first.PublishedAt == nil {
		t.Fatalf("chapter = %+v", first)
	}
	if chapters[1].Number != "1.5" {
		t.Fatalf("chapter = %+v", chapters[1])
	}

	pages, err := r.MangaPages(ctx, p, first.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(pages) != 2 || pages[0].Referer != "http://comics.example.org:"+s.port+"/" {
		t.Fatalf("pages = %+v", pages)
	}

	data, contentType, err := r.FetchImage(ctx, p, pages[0])
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(data, pngBytes) || contentType != "image/png" {
		t.Fatalf("image = %d bytes, %s", len(data), contentType)
	}
}

func TestMangaChapterNumbersComeAsText(t *testing.T) {
	s := newSite(t, http.NotFound)
	p := plugin(`class Provider {
		chapters() { return [{ id: 'a', number: 13 }, { id: 'b', number: 13.5 }, { id: 'c', number: -1 }, { id: 'd' }] }
	}`)

	chapters, err := s.runner(DefaultLimits()).MangaChapters(context.Background(), p, "x")
	if err != nil {
		t.Fatal(err)
	}

	var numbers []string
	for _, c := range chapters {
		numbers = append(numbers, c.Number)
	}
	if strings.Join(numbers, ",") != "13,13.5,," {
		t.Fatalf("numbers = %q", numbers)
	}
}

// A page the node could not fetch would shift every page after it: a chapter
// with one is refused whole.
func TestMangaPagesAreAllOnThePluginsHosts(t *testing.T) {
	s := newSite(t, http.NotFound)

	for name, pages := range map[string]string{
		"another site":    `[{ url: 'https://comics.example.org/1.png' }, { url: 'https://evil.example.com/2.png' }]`,
		"a local address": `[{ url: 'http://127.0.0.1/1.png' }]`,
		"no address":      `[{ referer: 'https://comics.example.org/' }]`,
		"not a web page":  `[{ url: 'file:///etc/passwd' }]`,
		"none at all":     `[]`,
	} {
		p := plugin(`class Provider { pages() { return `+pages+` } }`, "comics.example.org")
		if _, err := s.runner(DefaultLimits()).MangaPages(context.Background(), p, "c"); err == nil {
			t.Errorf("%s: pages were accepted", name)
		}
	}

	// A referer elsewhere is dropped, the page kept.
	p := plugin(`class Provider { pages() { return [{ url: 'https://comics.example.org/1.png', referer: 'https://tracker.example.com/' }] } }`, "comics.example.org")
	pages, err := s.runner(DefaultLimits()).MangaPages(context.Background(), p, "c")
	if err != nil || len(pages) != 1 || pages[0].Referer != "" {
		t.Fatalf("pages = %+v, %v", pages, err)
	}
}

func TestFetchImageTakesOnlyAnImageFromThePluginsHosts(t *testing.T) {
	big := make([]byte, maxImage+1)
	copy(big, pngBytes)

	s := newSite(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/page.html":
			fmt.Fprint(w, "<html><body>Checking your browser…</body></html>")
		case "/big.png":
			_, _ = w.Write(big)
		case "/away.png":
			http.Redirect(w, r, "http://evil.example.com/1.png", http.StatusFound)
		case "/page.avif":
			_, _ = w.Write([]byte("\x00\x00\x00\x1cftypavif\x00\x00\x00\x00"))
		default:
			http.NotFound(w, r)
		}
	})
	r := s.runner(DefaultLimits())
	p := plugin("", "comics.example.org")
	base := "http://comics.example.org:" + s.port

	for name, page := range map[string]string{
		"not an image":         base + "/page.html",
		"too large":            base + "/big.png",
		"a redirect elsewhere": base + "/away.png",
		"another host":         "http://evil.example.com:" + s.port + "/1.png",
		"missing":              base + "/none.png",
	} {
		if _, _, err := r.FetchImage(context.Background(), p, Page{URL: page}); err == nil {
			t.Errorf("%s: fetched", name)
		}
	}

	if _, contentType, err := r.FetchImage(context.Background(), p, Page{URL: base + "/page.avif"}); err != nil || contentType != "image/avif" {
		t.Fatalf("avif: %s, %v", contentType, err)
	}
}

// A torrent provider asked for chapters says so, rather than failing oddly.
func TestAMethodThePluginLacks(t *testing.T) {
	s := newSite(t, http.NotFound)
	p := plugin(`class Provider { search() { return [] } }`)

	_, err := s.runner(DefaultLimits()).MangaChapters(context.Background(), p, "x")
	if !errors.Is(err, ErrNoProvider) || !strings.Contains(err.Error(), "chapters") {
		t.Fatalf("err = %v, want no chapters method", err)
	}
}
