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

	if strings.HasPrefix(r.URL.Path, "/ws") {
		return r.URL.Query().Get("token")
	}

	return ""
}
