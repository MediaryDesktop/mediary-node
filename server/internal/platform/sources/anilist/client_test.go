package anilist

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"sync/atomic"
	"testing"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

func newTestClient(t *testing.T, endpoint string) *Client {
	t.Helper()

	return New(Options{
		Endpoint:    endpoint,
		Timeout:     5 * time.Second,
		Tokens:      NewTokenStore(filepath.Join(t.TempDir(), "anilist-token")),
		MinInterval: time.Millisecond,
	})
}

func writeJSON(t *testing.T, w http.ResponseWriter, status int, body any) {
	t.Helper()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		t.Errorf("encode response: %v", err)
	}
}

func TestViewerSendsTheTokenAsBearer(t *testing.T) {
	t.Parallel()

	var gotAuth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		writeJSON(t, w, http.StatusOK, map[string]any{
			"data": map[string]any{"Viewer": map[string]any{
				"id":               7,
				"name":             "lukas",
				"mediaListOptions": map[string]any{"scoreFormat": "POINT_10"},
			}},
		})
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)

	viewer, err := client.ViewerWithToken(context.Background(), "secret")
	if err != nil {
		t.Fatalf("viewer: %v", err)
	}

	if gotAuth != "Bearer secret" {
		t.Fatalf("authorization header = %q", gotAuth)
	}

	if viewer.ID != 7 || viewer.MediaListOptions.ScoreFormat != "POINT_10" {
		t.Fatalf("unexpected viewer: %+v", viewer)
	}
}

func TestQueryRetriesAfterRateLimit(t *testing.T) {
	t.Parallel()

	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if calls.Add(1) == 1 {
			w.Header().Set("Retry-After", "0")
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		writeJSON(t, w, http.StatusOK, map[string]any{
			"data": map[string]any{"Viewer": map[string]any{"id": 1, "name": "a"}},
		})
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)

	if _, err := client.ViewerWithToken(context.Background(), "t"); err != nil {
		t.Fatalf("a single 429 must be retried, got: %v", err)
	}

	if calls.Load() != 2 {
		t.Fatalf("expected 2 calls, got %d", calls.Load())
	}
}

func TestInvalidTokenIsReportedAsRejected(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(t, w, http.StatusBadRequest, map[string]any{
			"data":   nil,
			"errors": []map[string]any{{"message": "Invalid token", "status": 400}},
		})
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)

	_, err := client.ViewerWithToken(context.Background(), "stale")
	if !IsTokenRejected(err) {
		t.Fatalf("want a rejected-token error, got %v", err)
	}
}

func TestUnreachableAniListIsUnavailable(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.NotFoundHandler())
	endpoint := server.URL
	server.Close()

	client := newTestClient(t, endpoint)

	_, err := client.ViewerWithToken(context.Background(), "t")
	if apperr.KindOf(err) != apperr.KindUnavailable {
		t.Fatalf("want unavailable, got %v (kind %s)", err, apperr.KindOf(err))
	}
}

func TestCollectionWithoutATokenNeedsSignIn(t *testing.T) {
	t.Parallel()

	client := newTestClient(t, "http://127.0.0.1:1")

	_, err := client.Collection(context.Background(), 1, MediaTypeAnime)
	if apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("want precondition, got %v (kind %s)", err, apperr.KindOf(err))
	}
}

func TestTokenStoreRoundTrip(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "anilist-token")
	store := NewTokenStore(path)

	if token, err := store.Token(); err != nil || token != "" {
		t.Fatalf("a missing file must read as no token, got %q, %v", token, err)
	}

	if err := store.Save("abc"); err != nil {
		t.Fatalf("save: %v", err)
	}

	if token, err := NewTokenStore(path).Token(); err != nil || token != "abc" {
		t.Fatalf("a fresh store must read the saved token, got %q, %v", token, err)
	}

	if runtime.GOOS != "windows" {
		info, err := os.Stat(path)
		if err != nil {
			t.Fatalf("stat: %v", err)
		}
		if info.Mode().Perm() != 0o600 {
			t.Fatalf("token file mode = %v, want 0600", info.Mode().Perm())
		}
	}

	if err := store.Clear(); err != nil {
		t.Fatalf("clear: %v", err)
	}

	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("token file must be gone after clear, stat err = %v", err)
	}
}
