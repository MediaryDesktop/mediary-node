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
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("account user@example.com is banned"))
	}))
	defer upstream.Close()

	rec := httptest.NewRecorder()
	expired := proxy(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", http.NoBody), upstream.URL, "")

	if expired || rec.Code != http.StatusBadGateway || strings.Contains(rec.Body.String(), "example.com") {
		t.Errorf("expired %v, status %d, body %q", expired, rec.Code, rec.Body.String())
	}
}

func TestExpiredLinkIsRenewedOnceBehindTheSameAddress(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/old" {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		_, _ = w.Write([]byte("video"))
	}))
	defer upstream.Close()

	renewals := 0
	renew := func() (string, error) {
		renewals++
		return upstream.URL + "/new", nil
	}

	rec := httptest.NewRecorder()
	serveRemote(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", http.NoBody), upstream.URL+"/old", "", renew)

	if rec.Code != http.StatusOK || rec.Body.String() != "video" || renewals != 1 {
		t.Errorf("status %d, body %q, renewals %d", rec.Code, rec.Body.String(), renewals)
	}

	// A fresh link refused too is an error, not a loop.
	renewals = 0
	rec = httptest.NewRecorder()
	serveRemote(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", http.NoBody), upstream.URL+"/old", "",
		func() (string, error) { renewals++; return upstream.URL + "/old", nil })

	if rec.Code != http.StatusBadGateway || renewals != 1 {
		t.Errorf("status %d, renewals %d", rec.Code, renewals)
	}
}
