package handler

import (
	"io"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
)

// remoteHTTP fetches streams. There is no overall timeout: a response is a whole
// episode, read for as long as it plays.
var remoteHTTP = &http.Client{Transport: &http.Transport{
	Proxy:                 http.ProxyFromEnvironment,
	ResponseHeaderTimeout: 30 * time.Second,
	IdleConnTimeout:       90 * time.Second,
}}

// The request headers a range read needs, and the response headers the player
// reads back.
var (
	forwardedRequest  = []string{"Range", "If-Range"}
	forwardedResponse = []string{"Content-Length", "Content-Range", "Accept-Ranges", "Last-Modified", "ETag"}
)

// proxyRemote passes a range request on to a stream's link and the answer back.
// The service's CDN sends no CORS headers, so the video element could not read
// it directly; through the node it gets the node's. A link the CDN no longer
// takes is renewed once, behind the same address.
func proxyRemote(hctx huma.Context, link, contentType string, renew func() (string, error)) {
	r, w := humachi.Unwrap(hctx)
	serveRemote(w, r, link, contentType, renew)
}

func serveRemote(w http.ResponseWriter, r *http.Request, link, contentType string, renew func() (string, error)) {
	if !proxy(w, r, link, contentType) {
		return
	}

	fresh, err := renew()
	if err != nil || proxy(w, r, fresh, contentType) {
		http.Error(w, "the debrid service refused the stream", http.StatusBadGateway)
		return
	}
}

// Statuses with which a CDN refuses a link that has expired or was revoked;
// a fresh link from the service may well be taken.
var expiredStatuses = map[int]bool{
	http.StatusUnauthorized: true,
	http.StatusForbidden:    true,
	http.StatusNotFound:     true,
	http.StatusGone:         true,
}

// proxy serves one request from link. It reports expired, having written
// nothing, when the CDN refused the link as stale; any other failure it answers
// itself.
func proxy(w http.ResponseWriter, r *http.Request, link, contentType string) (expired bool) {
	method := http.MethodGet
	if r.Method == http.MethodHead {
		method = http.MethodHead
	}

	req, err := http.NewRequestWithContext(r.Context(), method, link, http.NoBody)
	if err != nil {
		http.Error(w, "the stream cannot be opened", http.StatusBadGateway)
		return false
	}
	for _, name := range forwardedRequest {
		if value := r.Header.Get(name); value != "" {
			req.Header.Set(name, value)
		}
	}

	resp, err := remoteHTTP.Do(req)
	if err != nil {
		// A player that went away has nobody left to tell.
		if r.Context().Err() != nil {
			return false
		}
		http.Error(w, "the debrid service cannot be reached", http.StatusBadGateway)
		return false
	}
	defer func() { _ = resp.Body.Close() }()

	if expiredStatuses[resp.StatusCode] {
		return true
	}
	if resp.StatusCode >= 400 {
		// Not the CDN's page: its body may name the account.
		http.Error(w, "the debrid service refused the stream", http.StatusBadGateway)
		return false
	}

	for _, name := range forwardedResponse {
		if value := resp.Header.Get(name); value != "" {
			w.Header().Set(name, value)
		}
	}
	// Never the CDN's own type: whatever it calls the file is served on the
	// node's origin, and text/html there would run as a page.
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	w.Header().Set("Content-Type", contentType)

	w.WriteHeader(resp.StatusCode)

	if method == http.MethodHead {
		return false
	}

	// The player drops the connection whenever it seeks, so a copy cut short is
	// the normal end of a response, not a failure to report.
	_, _ = io.Copy(w, resp.Body)

	return false
}
