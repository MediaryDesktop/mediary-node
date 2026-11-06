package tmdb

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/secrets"
)

const accessToken = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJ4In0.c2lnbmF0dXJl"

func newClient(t *testing.T, fallback string, handler http.HandlerFunc) (*Client, *Keys) {
	t.Helper()

	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	keys := NewKeys(secrets.New(filepath.Join(t.TempDir(), "tmdb-secrets.json")), fallback)

	return New(Options{Endpoint: server.URL, Keys: keys, MinInterval: time.Millisecond}), keys
}

func TestAKeyGoesInTheQueryAndATokenInTheHeader(t *testing.T) {
	var seen []string

	client, keys := newClient(t, "v3key", func(w http.ResponseWriter, r *http.Request) {
		seen = append(seen, r.URL.Query().Get("api_key")+"|"+r.Header.Get("Authorization"))
		_, _ = w.Write([]byte(`{"genres":[{"id":28,"name":"Action"}]}`))
	})

	if _, err := client.Genres(context.Background(), KindMovie, "en-US"); err != nil {
		t.Fatalf("genres with key: %v", err)
	}

	if err := keys.SetUserKey(accessToken); err != nil {
		t.Fatalf("save key: %v", err)
	}

	if _, err := client.Genres(context.Background(), KindMovie, "en-US"); err != nil {
		t.Fatalf("genres with token: %v", err)
	}

	want := []string{"v3key|", "|Bearer " + accessToken}
	if fmt.Sprint(seen) != fmt.Sprint(want) {
		t.Fatalf("credentials sent %q, want %q", seen, want)
	}
}

func TestTheUsersKeyOutranksTheBuildsAndClearingItFallsBack(t *testing.T) {
	keys := NewKeys(secrets.New(filepath.Join(t.TempDir(), "tmdb-secrets.json")), "build")

	assertSource := func(want KeySource, wantKey string) {
		t.Helper()

		source, err := keys.Source()
		if err != nil {
			t.Fatalf("source: %v", err)
		}
		key, _ := keys.Key()
		if source != want || key != wantKey {
			t.Fatalf("source %s key %q, want %s %q", source, key, want, wantKey)
		}
	}

	assertSource(KeySourceBuild, "build")

	if err := keys.SetUserKey("  mine  "); err != nil {
		t.Fatalf("save: %v", err)
	}
	assertSource(KeySourceUser, "mine")

	if err := keys.SetUserKey(""); err != nil {
		t.Fatalf("clear: %v", err)
	}
	assertSource(KeySourceBuild, "build")
}

func TestWithoutAKeyNothingIsSent(t *testing.T) {
	var requests atomic.Int32

	client, _ := newClient(t, "", func(http.ResponseWriter, *http.Request) { requests.Add(1) })

	_, err := client.Title(context.Background(), KindMovie, 603, "")
	if !errors.Is(err, ErrNoKey) || apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("err = %v, want a precondition wrapping ErrNoKey", err)
	}

	if requests.Load() != 0 {
		t.Fatalf("%d requests went out without a key", requests.Load())
	}
}

func TestARejectedKeyIsAPreconditionNotAnUnauthorized(t *testing.T) {
	client, _ := newClient(t, "bad", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	})

	err := client.Check(context.Background(), "bad")
	if apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("kind = %s, want precondition", apperr.KindOf(err))
	}
}

func TestARateLimitedRequestIsRetried(t *testing.T) {
	var requests atomic.Int32

	client, _ := newClient(t, "key", func(w http.ResponseWriter, _ *http.Request) {
		if requests.Add(1) == 1 {
			w.Header().Set("Retry-After", "0")
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		_, _ = w.Write([]byte(`{"id":603,"title":"The Matrix"}`))
	})

	details, err := client.Title(context.Background(), KindMovie, 603, "")
	if err != nil {
		t.Fatalf("title: %v", err)
	}

	if details.Title != "The Matrix" || requests.Load() != 2 {
		t.Fatalf("title %q after %d requests", details.Title, requests.Load())
	}
}

func TestAMissingTitleIsNotFound(t *testing.T) {
	client, _ := newClient(t, "key", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})

	_, err := client.Title(context.Background(), KindTV, 1, "")
	if apperr.KindOf(err) != apperr.KindNotFound {
		t.Fatalf("kind = %s, want not_found", apperr.KindOf(err))
	}
}

func TestSeasonsAreFetchedTwentyToARequest(t *testing.T) {
	var appended []string

	client, _ := newClient(t, "key", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/tv/42" {
			t.Errorf("path %s", r.URL.Path)
		}

		keys := strings.Split(r.URL.Query().Get("append_to_response"), ",")
		appended = append(appended, r.URL.Query().Get("append_to_response"))

		parts := []string{`"id":42`}
		for _, key := range keys {
			number := strings.TrimPrefix(key, "season/")
			if number == "3" {
				continue
			}
			parts = append(parts, fmt.Sprintf(`%q:{"season_number":%s,"episodes":[{"episode_number":1,"name":"E1"}]}`, key, number))
		}
		_, _ = w.Write([]byte("{" + strings.Join(parts, ",") + "}"))
	})

	numbers := make([]int, 0, 25)
	for number := 1; number <= 25; number++ {
		numbers = append(numbers, number)
	}

	seasons, err := client.Seasons(context.Background(), 42, numbers, "")
	if err != nil {
		t.Fatalf("seasons: %v", err)
	}

	if len(appended) != 2 || strings.Count(appended[0], ",") != 19 || appended[1] != "season/21,season/22,season/23,season/24,season/25" {
		t.Fatalf("requests appended %q", appended)
	}

	if len(seasons) != 24 || seasons[2].SeasonNumber != 4 {
		t.Fatalf("got %d seasons, third is %d; season 3 was missing and must be skipped", len(seasons), seasons[2].SeasonNumber)
	}
}

func TestImageURL(t *testing.T) {
	path := "/abc.jpg"

	if got := ImageURL(&path, "w500"); got == nil || *got != "https://image.tmdb.org/t/p/w500/abc.jpg" {
		t.Fatalf("got %v", got)
	}

	empty := ""
	if ImageURL(&empty, "w500") != nil || ImageURL(nil, "w500") != nil {
		t.Fatal("an absent path must give no link")
	}
}
