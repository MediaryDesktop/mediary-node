package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"net/http"
	"strings"
)

const TokenHeader = "X-Mediary-Node-Token" //nolint:gosec // a header name, not a credential

// urlTokenLabel is what the URL token is derived under. The desktop shell
// derives the same value (desktop/electron/main/url-token.ts); change both
// together.
const urlTokenLabel = "mediary-node url token v1" //nolint:gosec // a public HMAC label, not a credential

// URLToken is the token that may ride in an address — ?token= on a WebSocket,
// a video, a page image, a poster — derived from the node token so whoever
// holds that one can compute it and nobody else can. Addresses end up in
// process lists, browser caches and players' logs; this token opens only the
// read-only routes that take it, and the node token itself never needs to be
// in a URL.
func URLToken(token string) string {
	if token == "" {
		return ""
	}

	mac := hmac.New(sha256.New, []byte(token))
	mac.Write([]byte(urlTokenLabel))

	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// LocalToken lets a request through with the node token in a header, or with
// the URL token in ?token= on the routes that take one. Neither works in the
// other's place.
func LocalToken(token string, exempt ...string) func(http.Handler) http.Handler {
	exemptSet := make(map[string]struct{}, len(exempt))
	for _, path := range exempt {
		exemptSet[path] = struct{}{}
	}

	expected := []byte(token)
	expectedURL := []byte(URLToken(token))

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

			if !authorized(r, expected, expectedURL) {
				w.Header().Set("WWW-Authenticate", `Bearer realm="mediary-node"`)
				http.Error(w, "invalid or missing node token", http.StatusUnauthorized)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func authorized(r *http.Request, expected, expectedURL []byte) bool {
	if header := headerToken(r); header != "" {
		return subtle.ConstantTimeCompare([]byte(header), expected) == 1
	}

	if acceptsQueryToken(r) {
		return subtle.ConstantTimeCompare([]byte(r.URL.Query().Get("token")), expectedURL) == 1
	}

	return false
}

func headerToken(r *http.Request) string {
	if header := r.Header.Get(TokenHeader); header != "" {
		return header
	}

	if authorization := r.Header.Get("Authorization"); authorization != "" {
		if after, found := strings.CutPrefix(authorization, "Bearer "); found {
			return after
		}
	}

	return ""
}

// The WebSocket API and the src of a video or image element cannot set headers, so these
// take the URL token from the address. Media is read-only, so only GET qualifies there.
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
