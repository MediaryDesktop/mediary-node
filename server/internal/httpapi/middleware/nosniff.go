package middleware

import "net/http"

// NoSniff stops a browser from guessing a response's type. The node serves the
// user's files and streams from other services on its own origin, with the
// local token in the address; a file guessed to be HTML would run as a page
// that can read that token.
func NoSniff(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		next.ServeHTTP(w, r)
	})
}
