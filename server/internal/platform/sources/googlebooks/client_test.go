package googlebooks

import (
	"context"
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

func newClient(t *testing.T, handler http.HandlerFunc, fallback string) *Client {
	t.Helper()

	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	client := New(Options{
		Endpoint:    server.URL,
		Keys:        NewKeys(secrets.New(filepath.Join(t.TempDir(), "secrets.json")), fallback),
		MinInterval: 1,
	})
	client.backoff = time.Millisecond

	return client
}

func TestSearchSendsTheKeyAndReadsVolumes(t *testing.T) {
	client := newClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("key") != "build" || r.URL.Query().Get("q") != "Тіні забутих предків" {
			t.Errorf("query %s", r.URL.RawQuery)
		}

		_, _ = w.Write([]byte(`{"totalItems":1,"items":[{"id":"JXRKDwAAQBAJ","volumeInfo":{
			"title":"Тіні забутих предків","authors":["Михайло Коцюбинський"],"publishedDate":"2018-02-05",
			"pageCount":92,"imageLinks":{"thumbnail":"http://books.google.com/books/content?id=JXRKDwAAQBAJ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api"}}}]}`))
	}, "build")

	page, err := client.Search(context.Background(), SearchParams{Query: "Тіні забутих предків", MaxResults: 5})
	if err != nil {
		t.Fatal(err)
	}

	info := page.Items[0].VolumeInfo
	if info.Title != "Тіні забутих предків" || *info.PageCount != 92 || *info.Year() != 2018 {
		t.Fatalf("volume %+v", info)
	}

	cover := *info.ImageLinks.Cover()
	if !strings.HasPrefix(cover, "https://") || strings.Contains(cover, "edge=") || !strings.Contains(cover, "fife=w600") {
		t.Errorf("cover %s", cover)
	}
}

func TestWithoutAKeyNothingIsAsked(t *testing.T) {
	client := newClient(t, func(http.ResponseWriter, *http.Request) {
		t.Error("asked Google without a key")
	}, "")

	if _, err := client.Volume(context.Background(), "JXRKDwAAQBAJ"); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Errorf("error %v, want a precondition", err)
	}
}

func TestErrorsSayWhatTheUserCanDo(t *testing.T) {
	cases := []struct {
		status int
		body   string
		want   apperr.Kind
	}{
		{http.StatusBadRequest, `{"error":{"message":"API key not valid. Please pass a valid API key.","errors":[{"reason":"badRequest"}]}}`, apperr.KindPrecondition},
		{http.StatusForbidden, `{"error":{"message":"Books API has not been used in project 1","errors":[{"reason":"accessNotConfigured"}]}}`, apperr.KindPrecondition},
		{http.StatusTooManyRequests, `{"error":{"message":"Quota exceeded","errors":[{"reason":"rateLimitExceeded"}]}}`, apperr.KindUnavailable},
		{http.StatusForbidden, `{"error":{"message":"Daily limit","errors":[{"reason":"dailyLimitExceeded"}]}}`, apperr.KindUnavailable},
		{http.StatusNotFound, `{}`, apperr.KindNotFound},
		{http.StatusServiceUnavailable, ``, apperr.KindUnavailable},
	}

	for _, c := range cases {
		client := newClient(t, func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(c.status)
			_, _ = w.Write([]byte(c.body))
		}, "build")

		_, err := client.Volume(context.Background(), "JXRKDwAAQBAJ")
		if apperr.KindOf(err) != c.want {
			t.Errorf("%d %s: %v, want %v", c.status, c.body, err, c.want)
		}
		if err != nil && strings.Contains(err.Error(), "build") {
			t.Errorf("the error quotes the key: %v", err)
		}
	}
}

func TestAPassing503IsTriedAgain(t *testing.T) {
	var calls atomic.Int32

	client := newClient(t, func(w http.ResponseWriter, _ *http.Request) {
		if calls.Add(1) == 1 {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}

		_, _ = w.Write([]byte(`{"id":"JXRKDwAAQBAJ","volumeInfo":{"title":"Тіні забутих предків"}}`))
	}, "build")

	volume, err := client.Volume(context.Background(), "JXRKDwAAQBAJ")
	if err != nil || volume.VolumeInfo.Title == "" || calls.Load() != 2 {
		t.Fatalf("volume %+v, err %v after %d calls", volume, err, calls.Load())
	}
}
