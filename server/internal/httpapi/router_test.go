package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rs/zerolog"
)

// The whole chain over a real connection: a loopback node answers to its own
// address, refuses a rebound name even on the routes without a token, and
// still wants the token everywhere else.
func TestLoopbackRouterRefusesRebindingAndKeepsTheToken(t *testing.T) {
	router, _ := New(Options{Token: "secret", Logger: zerolog.Nop(), Loopback: true})
	router.Get("/v1/library/files", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })

	server := httptest.NewServer(router)
	defer server.Close()

	tests := []struct {
		name  string
		host  string
		path  string
		token string
		want  int
	}{
		{"own address", "", "/healthz", "", http.StatusOK},
		{"rebound health", "attacker.example", "/healthz", "", http.StatusMisdirectedRequest},
		{"rebound docs", "attacker.example", "/openapi.json", "", http.StatusMisdirectedRequest},
		{"rebound with token", "attacker.example", "/v1/library/files", "secret", http.StatusMisdirectedRequest},
		{"no token", "", "/v1/library/files", "", http.StatusUnauthorized},
		{"token", "", "/v1/library/files", "secret", http.StatusOK},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, server.URL+tt.path, http.NoBody)
			if err != nil {
				t.Fatal(err)
			}
			if tt.host != "" {
				req.Host = tt.host
			}
			if tt.token != "" {
				req.Header.Set("X-Mediary-Node-Token", tt.token)
			}

			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			_ = resp.Body.Close()

			if resp.StatusCode != tt.want {
				t.Errorf("status = %d, want %d", resp.StatusCode, tt.want)
			}
			if got := resp.Header.Get("X-Content-Type-Options"); got != "nosniff" {
				t.Errorf("X-Content-Type-Options = %q, want nosniff", got)
			}
		})
	}
}

// A node on the network is addressed by whatever name the LAN gives it.
func TestNetworkRouterDoesNotCheckTheHost(t *testing.T) {
	router, _ := New(Options{Token: "secret", Logger: zerolog.Nop()})

	server := httptest.NewServer(router)
	defer server.Close()

	req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, server.URL+"/healthz", http.NoBody)
	if err != nil {
		t.Fatal(err)
	}
	req.Host = "mediary.lan"

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
}
