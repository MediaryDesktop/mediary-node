package torznab

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

const capsFeed = `<?xml version="1.0" encoding="UTF-8"?>
<caps>
  <server title="Jackett" />
  <searching>
    <search available="yes" supportedParams="q" />
    <tv-search available="yes" supportedParams="q,season,ep" />
  </searching>
</caps>`

const searchFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:torznab="http://torznab.com/schemas/2015/feed">
  <channel>
    <item>
      <title>Sousou no Frieren - AniLiberty.TOP [WEB-DL 1080p][HEVC][1-28]</title>
      <guid>https://aniliberty.top/anime/releases/release/sousou-no-frieren/abc</guid>
      <jackettindexer id="anilibria">AniLibria</jackettindexer>
      <comments>https://aniliberty.top/anime/releases/release/sousou-no-frieren</comments>
      <pubDate>Tue, 06 Oct 2026 15:19:15 +0000</pubDate>
      <size>15032385536</size>
      <grabs>301</grabs>
      <link>http://localhost:9117/dl/anilibria/?jackett_apikey=k&amp;path=x</link>
      <enclosure url="http://localhost:9117/dl/anilibria/?jackett_apikey=k&amp;path=x" length="15032385536" type="application/x-bittorrent" />
      <torznab:attr name="seeders" value="18" />
      <torznab:attr name="peers" value="22" />
      <torznab:attr name="infohash" value="3D686DBC956D6D31534B428C40F28999B6531640" />
    </item>
    <item>
      <title>[SubsPlease] Sousou no Frieren - 13 (1080p)</title>
      <prowlarrindexer id="2">Nyaa</prowlarrindexer>
      <link>magnet:?xt=urn:btih:aaaa</link>
      <torznab:attr name="seeders" value="5" />
      <torznab:attr name="peers" value="5" />
    </item>
    <item>
      <title>No link at all</title>
    </item>
  </channel>
</rss>`

func serve(t *testing.T, handler http.HandlerFunc) *httptest.Server {
	t.Helper()

	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	return server
}

func TestCapsAndSearch(t *testing.T) {
	var queries []string

	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		queries = append(queries, r.URL.RawQuery)

		if r.URL.Query().Get("apikey") != "secret" {
			_, _ = w.Write([]byte(`<error code="100" description="Invalid API Key" />`))
			return
		}

		switch r.URL.Query().Get("t") {
		case "caps":
			_, _ = w.Write([]byte(capsFeed))
		case "search":
			_, _ = w.Write([]byte(searchFeed))
		}
	})

	client := New(5*time.Second, "test")
	src := Source{URL: server.URL + "/api/v2.0/indexers/all/results/torznab/", APIKey: "secret"}

	caps, err := client.Caps(context.Background(), src)
	if err != nil || caps.Title != "Jackett" || !caps.Search {
		t.Fatalf("caps = %+v, %v", caps, err)
	}

	items, err := client.Search(context.Background(), src, "Sousou no Frieren")
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 2 {
		t.Fatalf("items = %+v, want two with a link", items)
	}

	first := items[0]
	if first.Indexer != "AniLibria" || first.Seeders != 18 || first.Peers != 4 || first.Grabs != 301 ||
		first.Size != 15032385536 || first.InfoHash != "3d686dbc956d6d31534b428c40f28999b6531640" ||
		!strings.Contains(first.Link, "/dl/anilibria/") || first.PublishedAt.IsZero() {
		t.Fatalf("first = %+v", first)
	}

	second := items[1]
	if second.Indexer != "Nyaa" || second.MagnetURL != "magnet:?xt=urn:btih:aaaa" || second.Link != "" {
		t.Fatalf("a magnet link is a magnet, got %+v", second)
	}

	if !strings.Contains(queries[1], "q=Sousou+no+Frieren") || !strings.Contains(queries[1], "t=search") {
		t.Fatalf("query = %s", queries[1])
	}
}

func TestTorznabErrorsAreUpstreamWithoutTheKey(t *testing.T) {
	server := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`<error code="100" description="Invalid API Key" />`))
	})

	_, err := New(5*time.Second, "test").Caps(context.Background(), Source{URL: server.URL, APIKey: "leaked"})
	if apperr.KindOf(err) != apperr.KindUpstream || !strings.Contains(err.Error(), "Invalid API Key") {
		t.Fatalf("err = %v", err)
	}
	if strings.Contains(err.Error(), "leaked") {
		t.Fatalf("the error carries the API key: %v", err)
	}
}

func TestFetchFollowsARedirectToAMagnet(t *testing.T) {
	server := serve(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/magnet" {
			w.Header().Set("Location", "magnet:?xt=urn:btih:bbbb")
			w.WriteHeader(http.StatusFound)
			return
		}
		_, _ = w.Write([]byte("d4:infod4:name1:aee"))
	})

	client := New(5*time.Second, "test")

	data, magnet, err := client.Fetch(context.Background(), server.URL+"/magnet")
	if err != nil || magnet != "magnet:?xt=urn:btih:bbbb" || data != nil {
		t.Fatalf("redirect: %q, %q, %v", data, magnet, err)
	}

	data, magnet, err = client.Fetch(context.Background(), server.URL+"/file")
	if err != nil || magnet != "" || string(data) != "d4:infod4:name1:aee" {
		t.Fatalf("file: %q, %q, %v", data, magnet, err)
	}
}

func TestParseURLDropsThePastedKey(t *testing.T) {
	got, err := ParseURL(" http://localhost:9117/api/v2.0/indexers/all/results/torznab/api?apikey=abc&t=search ")
	if err != nil || got != "http://localhost:9117/api/v2.0/indexers/all/results/torznab/api" {
		t.Fatalf("ParseURL = %q, %v", got, err)
	}

	if _, err := ParseURL("localhost:9117"); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("err = %v, want invalid", err)
	}
}
