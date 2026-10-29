package middleware

import (
	"crypto/subtle"
	"net/http"
	"strings"
)

const TokenHeader = "X-Mediary-Node-Token"

func LocalToken(token string, exempt ...string) func(http.Handler) http.Handler {
	exemptSet := make(map[string]struct{}, len(exempt))
	for _, path := range exempt {
		exemptSet[path] = struct{}{}
	}

	expected := []byte(token)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if _, ok := exemptSet[r.URL.Path]; ok {
				next.ServeHTTP(w, r)
				return
			}

			if len(expected) == 0 {
				http.Error(w, "node token is not configured", http.StatusServiceUnavailable)
				return
			}

			presented := presentedToken(r)

			if subtle.ConstantTimeCompare([]byte(presented), expected) != 1 {
				w.Header().Set("WWW-Authenticate", `Bearer realm="mediary-node"`)
				http.Error(w, "invalid or missing node token", http.StatusUnauthorized)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func presentedToken(r *http.Request) string {
	if header := r.Header.Get(TokenHeader); header != "" {
		return header
	}

	if authorization := r.Header.Get("Authorization"); authorization != "" {
		if after, found := strings.CutPrefix(authorization, "Bearer "); found {
			return after
		}
	}

	if acceptsQueryToken(r) {
		return r.URL.Query().Get("token")
	}

	return ""
}

// The WebSocket API and the src of a video or image element cannot set headers, so these
// take the token from the URL. Media is read-only, so only GET qualifies there.
func acceptsQueryToken(r *http.Request) bool {
	if strings.HasPrefix(r.URL.Path, "/ws") {
		return true
	}

	if r.Method != http.MethodGet {
		return false
	}

	for _, prefix := range []string{"/v1/playback/files/", "/v1/reader/files/", "/v1/reader/chapters/"} {
		if strings.HasPrefix(r.URL.Path, prefix) {
			return true
		}
	}

	// A manual title's poster, and nothing else under that title.
	if rest, ok := strings.CutPrefix(r.URL.Path, "/v1/media/manual/"); ok {
		id, tail, found := strings.Cut(rest, "/")
		return found && id != "" && tail == "cover"
	}

	return false
}
