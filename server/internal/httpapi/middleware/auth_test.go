package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestQueryTokenIsAcceptedOnlyWhereHeadersCannotBeSent(t *testing.T) {
	handler := LocalToken("secret")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	tests := []struct {
		method string
		target string
		want   int
	}{
		{http.MethodGet, "/ws?token=secret", http.StatusNoContent},
		{http.MethodGet, "/v1/playback/files/7/direct?token=secret", http.StatusNoContent},
		{http.MethodGet, "/v1/playback/files/7/direct?token=wrong", http.StatusUnauthorized},
		{http.MethodPost, "/v1/playback/files/7/direct?token=secret", http.StatusUnauthorized},
		{http.MethodGet, "/v1/library/files?token=secret", http.StatusUnauthorized},
		{http.MethodGet, "/v1/reader/files/7/pages/0?token=secret", http.StatusNoContent},
		{http.MethodPost, "/v1/reader/files/7/progress?token=secret", http.StatusUnauthorized},
		{http.MethodGet, "/v1/reader/chapters/local:7/pages/0?token=secret", http.StatusNoContent},
		{http.MethodPost, "/v1/reader/chapters/local:7/progress?token=secret", http.StatusUnauthorized},
		{http.MethodGet, "/v1/media/manual/0123456789abcdef0123/cover?v=2&token=secret", http.StatusNoContent},
		{http.MethodPut, "/v1/media/manual/0123456789abcdef0123/cover?token=secret", http.StatusUnauthorized},
		{http.MethodGet, "/v1/media/manual/0123456789abcdef0123/cover/candidates?token=secret", http.StatusUnauthorized},
		{http.MethodGet, "/v1/media/manual/suggest?token=secret", http.StatusUnauthorized},
	}

	for _, tt := range tests {
		t.Run(tt.method+" "+tt.target, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, httptest.NewRequestWithContext(t.Context(), tt.method, tt.target, http.NoBody))

			if recorder.Code != tt.want {
				t.Errorf("status = %d, want %d", recorder.Code, tt.want)
			}
		})
	}
}
