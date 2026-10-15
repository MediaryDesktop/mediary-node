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
// it directly; through the node it gets the node's.
func proxyRemote(hctx huma.Context, link, contentType string) {
	r, w := humachi.Unwrap(hctx)
	proxy(w, r, link, contentType)
}

func proxy(w http.ResponseWriter, r *http.Request, link, contentType string) {
	method := http.MethodGet
	if r.Method == http.MethodHead {
		method = http.MethodHead
	}

	req, err := http.NewRequestWithContext(r.Context(), method, link, http.NoBody)
	if err != nil {
		http.Error(w, "the stream cannot be opened", http.StatusBadGateway)
		return
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
			return
		}
		http.Error(w, "the debrid service cannot be reached", http.StatusBadGateway)
		return
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode >= 400 {
		// Not the CDN's page: its body may name the account.
		http.Error(w, "the debrid service refused the stream", http.StatusBadGateway)
		return
	}

	for _, name := range forwardedResponse {
		if value := resp.Header.Get(name); value != "" {
			w.Header().Set(name, value)
		}
	}
	if contentType != "" {
		w.Header().Set("Content-Type", contentType)
	} else if upstream := resp.Header.Get("Content-Type"); upstream != "" {
		w.Header().Set("Content-Type", upstream)
	}

	w.WriteHeader(resp.StatusCode)

	if method == http.MethodHead {
		return
	}

	// The player drops the connection whenever it seeks, so a copy cut short is
	// the normal end of a response, not a failure to report.
	_, _ = io.Copy(w, resp.Body)
}
