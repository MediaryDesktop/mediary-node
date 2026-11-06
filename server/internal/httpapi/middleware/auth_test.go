package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// The desktop shell derives the same value from the same token
// (desktop/electron/main/url-token.test.ts); the two tests share this vector.
const secretURLToken = "YC1QSADjGYnd-n8gi4Qt60AnFThGZfn6eCD1HpnoJtU"

func TestURLTokenMatchesTheShells(t *testing.T) {
	if got := URLToken("secret"); got != secretURLToken {
		t.Errorf("URLToken = %q, want %q", got, secretURLToken)
	}
	if got := URLToken(""); got != "" {
		t.Errorf("URLToken of no token = %q, want empty", got)
	}
}

func TestQueryTokenIsAcceptedOnlyWhereHeadersCannotBeSent(t *testing.T) {
	handler := LocalToken("secret")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	const u = secretURLToken

	tests := []struct {
		method string
		target string
		want   int
	}{
		{http.MethodGet, "/ws?token=" + u, http.StatusNoContent},
		{http.MethodGet, "/v1/playback/files/7/direct?token=" + u, http.StatusNoContent},
		{http.MethodGet, "/v1/playback/files/7/direct?token=wrong", http.StatusUnauthorized},
		{http.MethodPost, "/v1/playback/files/7/direct?token=" + u, http.StatusUnauthorized},
		{http.MethodGet, "/v1/library/files?token=" + u, http.StatusUnauthorized},
		{http.MethodGet, "/v1/reader/files/7/pages/0?token=" + u, http.StatusNoContent},
		{http.MethodPost, "/v1/reader/files/7/progress?token=" + u, http.StatusUnauthorized},
		{http.MethodGet, "/v1/reader/chapters/local:7/pages/0?token=" + u, http.StatusNoContent},
		{http.MethodPost, "/v1/reader/chapters/local:7/progress?token=" + u, http.StatusUnauthorized},
		{http.MethodGet, "/v1/media/manual/0123456789abcdef0123/cover?v=2&token=" + u, http.StatusNoContent},
		{http.MethodPut, "/v1/media/manual/0123456789abcdef0123/cover?token=" + u, http.StatusUnauthorized},
		{http.MethodGet, "/v1/media/manual/0123456789abcdef0123/cover/candidates?token=" + u, http.StatusUnauthorized},
		{http.MethodGet, "/v1/media/manual/suggest?token=" + u, http.StatusUnauthorized},

		// The node token itself is never taken from an address.
		{http.MethodGet, "/ws?token=secret", http.StatusUnauthorized},
		{http.MethodGet, "/v1/playback/files/7/direct?token=secret", http.StatusUnauthorized},
		{http.MethodGet, "/v1/media/manual/0123456789abcdef0123/cover?token=secret", http.StatusUnauthorized},
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

func TestHeadersTakeOnlyTheNodeToken(t *testing.T) {
	handler := LocalToken("secret")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	tests := []struct {
		name   string
		header string
		value  string
		want   int
	}{
		{"node token", TokenHeader, "secret", http.StatusNoContent},
		{"bearer node token", "Authorization", "Bearer secret", http.StatusNoContent},
		{"url token in the header", TokenHeader, secretURLToken, http.StatusUnauthorized},
		{"url token as bearer", "Authorization", "Bearer " + secretURLToken, http.StatusUnauthorized},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/v1/library/files", http.NoBody)
			req.Header.Set(tt.header, tt.value)

			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, req)

			if recorder.Code != tt.want {
				t.Errorf("status = %d, want %d", recorder.Code, tt.want)
			}
		})
	}
}
