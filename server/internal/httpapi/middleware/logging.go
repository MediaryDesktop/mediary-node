package middleware

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
)

func Logging(logger zerolog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			started := time.Now()
			wrapped := chimw.NewWrapResponseWriter(w, r.ProtoMajor)

			next.ServeHTTP(wrapped, r)

			status := wrapped.Status()

			event := logger.Debug()
			switch {
			case status >= http.StatusInternalServerError:
				event = logger.Error()
			case status >= http.StatusBadRequest:
				event = logger.Warn()
			}

			event.
				Str("request_id", chimw.GetReqID(r.Context())).
				Str("method", r.Method).
				Str("route", routePattern(r)).
				Int("status", status).
				Dur("elapsed", time.Since(started)).
				Msg("http request")
		})
	}
}

func routePattern(r *http.Request) string {
	if ctx := chi.RouteContext(r.Context()); ctx != nil {
		if pattern := ctx.RoutePattern(); pattern != "" {
			return pattern
		}
	}
	return "unmatched"
}
