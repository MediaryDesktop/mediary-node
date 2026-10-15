package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestProxyPassesRangesOnAndBack(t *testing.T) {
	content := strings.Repeat("0123456789", 100)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/octet-stream")
		http.ServeContent(w, r, "x", time.Time{}, strings.NewReader(content))
	}))
	defer upstream.Close()

	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/v1/playback/files/-1/direct", http.NoBody)
	req.Header.Set("Range", "bytes=10-19")
	rec := httptest.NewRecorder()

	proxy(rec, req, upstream.URL, "video/x-matroska")

	if rec.Code != http.StatusPartialContent {
		t.Fatalf("status = %d", rec.Code)
	}
	if rec.Body.String() != content[10:20] {
		t.Errorf("body = %q", rec.Body.String())
	}
	if got := rec.Header().Get("Content-Range"); got != "bytes 10-19/1000" {
		t.Errorf("Content-Range = %q", got)
	}
	if got := rec.Header().Get("Content-Type"); got != "video/x-matroska" {
		t.Errorf("Content-Type = %q, want the container's", got)
	}
}

func TestProxyHidesTheServicesRefusal(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte("account user@example.com is banned"))
	}))
	defer upstream.Close()

	rec := httptest.NewRecorder()
	proxy(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", http.NoBody), upstream.URL, "")

	if rec.Code != http.StatusBadGateway || strings.Contains(rec.Body.String(), "example.com") {
		t.Errorf("status %d, body %q", rec.Code, rec.Body.String())
	}
}
