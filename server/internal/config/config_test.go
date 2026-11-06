package config

import (
	"strings"
	"testing"
	"time"
)

// valid is a configuration that passes every check but the ones a test sets up.
func valid(host, token string, allowPlaintext bool) *Config {
	return &Config{
		Env: EnvProduction,
		HTTP: HTTP{
			Host:           host,
			Port:           DefaultPort,
			Token:          token,
			AllowPlaintext: allowPlaintext,
		},
		Torrent: Torrent{Client: "none"},
		AniList: AniList{RefreshInterval: 5 * time.Minute},
	}
}

func TestANodeOnTheNetworkNeedsPlainHTTPConfirmed(t *testing.T) {
	tests := []struct {
		name           string
		host           string
		token          string
		allowPlaintext bool
		wantErr        string
	}{
		{"desktop on loopback", "127.0.0.1", "", false, ""},
		{"localhost", "localhost", "", false, ""},
		{"loopback ignores the flag", "127.0.0.1", "", true, ""},
		{"network without a token", "0.0.0.0", "", true, "NODE_TOKEN is unset"},
		{"network without the flag", "0.0.0.0", "secret", false, "NODE_HTTP_ALLOW_PLAINTEXT=true"},
		{"a LAN address without the flag", "192.168.1.10", "secret", false, "NODE_HTTP_ALLOW_PLAINTEXT=true"},
		{"network behind a proxy", "0.0.0.0", "secret", true, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := valid(tt.host, tt.token, tt.allowPlaintext).validate()

			switch {
			case tt.wantErr == "" && err != nil:
				t.Errorf("validate() = %v, want no error", err)
			case tt.wantErr != "" && err == nil:
				t.Errorf("validate() = nil, want an error naming %q", tt.wantErr)
			case tt.wantErr != "" && !strings.Contains(err.Error(), tt.wantErr):
				t.Errorf("validate() = %v, want it to name %q", err, tt.wantErr)
			}
		})
	}
}
