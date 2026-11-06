package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLoopbackHostAnswersOnlyToThisMachinesNames(t *testing.T) {
	handler := LoopbackHost(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	tests := map[string]int{
		"127.0.0.1:43711":         http.StatusNoContent,
		"127.0.0.1:50123":         http.StatusNoContent,
		"localhost:43711":         http.StatusNoContent,
		"LocalHost:43711":         http.StatusNoContent,
		"[::1]:43711":             http.StatusNoContent,
		"127.0.0.1":               http.StatusNoContent,
		"attacker.example:43711":  http.StatusMisdirectedRequest,
		"127.0.0.1.nip.io:43711":  http.StatusMisdirectedRequest,
		"localhost.example:43711": http.StatusMisdirectedRequest,
		"192.168.1.10:43711":      http.StatusMisdirectedRequest,
		"":                        http.StatusMisdirectedRequest,
	}

	for host, want := range tests {
		t.Run(host, func(t *testing.T) {
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/healthz", http.NoBody)
			req.Host = host

			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, req)

			if recorder.Code != want {
				t.Errorf("status = %d, want %d", recorder.Code, want)
			}
		})
	}
}
