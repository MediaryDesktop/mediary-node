package mangadex

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

type recorded struct {
	mu      sync.Mutex
	paths   []string
	agents  []string
	reports []map[string]any
	auth    []string
}

// fakeDex serves the answers recorded from the real API, and stands in for the
// at-home node and the report endpoint too.
func fakeDex(t *testing.T) (*Client, *recorded) {
	t.Helper()

	rec := &recorded{}
	read := func(name string) []byte {
		data, err := os.ReadFile(filepath.Join("testdata", name))
		if err != nil {
			t.Fatal(err)
		}

		return data
	}

	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec.mu.Lock()
		rec.paths = append(rec.paths, r.URL.Path)
		rec.agents = append(rec.agents, r.UserAgent())
		rec.auth = append(rec.auth, r.Header.Get("Authorization"))
		rec.mu.Unlock()

		switch {
		case r.URL.Path == "/manga":
			_, _ = w.Write(read("search.json"))
		case strings.HasSuffix(r.URL.Path, "/feed"):
			_, _ = w.Write(read("feed.json"))
		case strings.HasPrefix(r.URL.Path, "/chapter/"):
			_, _ = w.Write(read("chapter.json"))
		case strings.HasPrefix(r.URL.Path, "/at-home/server/"):
			var home map[string]any
			_ = json.Unmarshal(read("at-home.json"), &home)
			home["baseUrl"] = srv.URL + "/node"
			_ = json.NewEncoder(w).Encode(home)
		case strings.HasPrefix(r.URL.Path, "/node/data/"):
			if strings.HasSuffix(r.URL.Path, "broken.jpg") {
				w.WriteHeader(http.StatusBadGateway)
				return
			}
			w.Header().Set("Content-Type", "image/jpeg")
			w.Header().Set("X-Cache", "HIT - node")
			_, _ = w.Write([]byte{0xff, 0xd8, 0xff, 1, 2, 3})
		case r.URL.Path == "/report":
			var report map[string]any
			_ = json.NewDecoder(r.Body).Decode(&report)
			rec.mu.Lock()
			rec.reports = append(rec.reports, report)
			rec.mu.Unlock()
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)

	return New(Options{Endpoint: srv.URL, ReportEndpoint: srv.URL + "/report", Timeout: 5 * time.Second, UserAgent: "mediary-test"}), rec
}

func TestSearchNamesTheSeriesAndItsAniListID(t *testing.T) {
	client, rec := fakeDex(t)

	found, err := client.Search(context.Background(), "berserk")
	if err != nil {
		t.Fatal(err)
	}

	if len(found) != 3 || found[0].ID != "801513ba-a712-498c-8f57-cae55b38cc92" || found[0].AniListID != "30002" {
		t.Fatalf("found = %+v", found)
	}
	if found[0].Title == "" {
		t.Error("a series with only a romanised title has no title")
	}
	if rec.agents[0] != "mediary-test" {
		t.Errorf("User-Agent = %q", rec.agents[0])
	}
}

func TestFeedCarriesNumbersLanguagesAndGroups(t *testing.T) {
	client, _ := fakeDex(t)

	chapters, err := client.Feed(context.Background(), "801513ba-a712-498c-8f57-cae55b38cc92", []string{"en"})
	if err != nil {
		t.Fatal(err)
	}

	// The fixture is the first six of 425; the client asks for the rest, which the
	// fake answers with the same six.
	if len(chapters) < 6 {
		t.Fatalf("chapters = %d", len(chapters))
	}

	first := chapters[0]
	if first.Number != "0.01" || first.Language != "en" || first.Pages != 94 ||
		len(first.Groups) != 1 || first.Groups[0] != "Band of the Hawks" {
		t.Errorf("first = %+v", first)
	}
}

func TestChapterKnowsItsSeries(t *testing.T) {
	client, _ := fakeDex(t)

	chapter, err := client.Chapter(context.Background(), "6310f6a1-17ee-4890-b837-2ec1b372905b")
	if err != nil {
		t.Fatal(err)
	}

	if chapter.MangaID != "801513ba-a712-498c-8f57-cae55b38cc92" || chapter.Pages != 94 {
		t.Errorf("chapter = %+v", chapter)
	}
}

func TestPagesComeFromTheNodeWithoutCredentialsAndAreReported(t *testing.T) {
	client, rec := fakeDex(t)
	ctx := context.Background()

	home, err := client.AtHome(ctx, "6310f6a1-17ee-4890-b837-2ec1b372905b")
	if err != nil {
		t.Fatal(err)
	}
	if len(home.Files) != 94 {
		t.Fatalf("files = %d", len(home.Files))
	}

	data, contentType, err := client.Image(ctx, home, 0)
	if err != nil || contentType != "image/jpeg" || len(data) != 6 {
		t.Fatalf("image = %d bytes %q %v", len(data), contentType, err)
	}

	home.Files[1] = "broken.jpg"
	if _, _, err := client.Image(ctx, home, 1); !errors.Is(err, ErrUnhealthy) {
		t.Errorf("broken page: %v", err)
	}

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		rec.mu.Lock()
		count := len(rec.reports)
		rec.mu.Unlock()
		if count == 2 {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}

	rec.mu.Lock()
	defer rec.mu.Unlock()

	if len(rec.reports) != 2 || rec.reports[0]["success"] != true || rec.reports[0]["cached"] != true ||
		rec.reports[1]["success"] != false {
		t.Errorf("reports = %+v", rec.reports)
	}
	for _, auth := range rec.auth {
		if auth != "" {
			t.Errorf("a request carried credentials: %q", auth)
		}
	}
}

func TestPagesFromMangaDexItselfAreNotReported(t *testing.T) {
	client, rec := fakeDex(t)

	client.report(context.Background(), "https://uploads.mangadex.org/data/x/1.jpg", true, false, 10, time.Now())
	time.Sleep(50 * time.Millisecond)

	rec.mu.Lock()
	defer rec.mu.Unlock()
	if len(rec.reports) != 0 {
		t.Errorf("reported a page from mangadex.org: %+v", rec.reports)
	}
}

func TestTooManyRequestsHoldsBackTheNextOne(t *testing.T) {
	retry := time.Now().Add(2 * time.Second).Unix()
	calls := 0

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls++
		w.Header().Set("X-RateLimit-Retry-After", strconv.FormatInt(retry, 10))
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	defer srv.Close()

	client := New(Options{Endpoint: srv.URL, Timeout: 5 * time.Second, UserAgent: "mediary-test"})

	if _, err := client.Search(context.Background(), "x"); !errors.Is(err, ErrUnhealthy) {
		t.Fatalf("first: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
	defer cancel()

	if _, err := client.Search(ctx, "x"); !errors.Is(err, context.DeadlineExceeded) || calls != 1 {
		t.Errorf("second request went out while blocked: err=%v calls=%d", err, calls)
	}
}
