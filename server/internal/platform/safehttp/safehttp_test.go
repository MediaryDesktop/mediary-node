package safehttp

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"
	"time"
)

// fetch asks for an address and closes whatever comes back.
func fetch(client *http.Client, address string) error {
	response, err := Get(context.Background(), client, address, nil)
	if response != nil {
		_ = response.Body.Close()
	}

	return err
}

func TestOnlyPublicAddressesArePublic(t *testing.T) {
	for address, public := range map[string]bool{
		"8.8.8.8":         true,
		"2606:4700::1111": true,
		"127.0.0.1":       false,
		"10.1.2.3":        false,
		"192.168.1.1":     false,
		"172.16.0.1":      false,
		"169.254.169.254": false,
		"100.64.0.1":      false,
		"0.0.0.0":         false,
		"::1":             false,
		"fe80::1":         false,
		"fd00::1":         false,
		"::ffff:10.0.0.1": false,
		"64:ff9b::a00:1":  false,
		"224.0.0.1":       false,
	} {
		if got := Public(netip.MustParseAddr(address)); got != public {
			t.Errorf("%s: public = %v, want %v", address, got, public)
		}
	}
}

func TestTheNodeItselfCannotBeReached(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("secret"))
	}))
	t.Cleanup(server.Close)

	client := NewClient(5 * time.Second)

	err := fetch(client, server.URL)
	if !errors.Is(err, ErrForbiddenAddress) {
		t.Fatalf("a loopback address must be refused, got %v", err)
	}
}

func TestOnlyWebSchemesAreFetched(t *testing.T) {
	client := NewClient(5 * time.Second)

	for _, address := range []string{"file:///etc/passwd", "ftp://example.com/x", "gopher://example.com"} {
		if err := fetch(client, address); !errors.Is(err, ErrForbiddenAddress) {
			t.Errorf("%s must be refused, got %v", address, err)
		}
	}
}

func TestARedirectToTheNodeIsRefused(t *testing.T) {
	inner := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("secret"))
	}))
	t.Cleanup(inner.Close)

	client := NewClient(5 * time.Second)
	request, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, inner.URL, http.NoBody)

	if err := client.CheckRedirect(request, nil); err != nil {
		t.Fatalf("an http hop passes the scheme check, got %v", err)
	}

	response, err := client.Do(request)
	if response != nil {
		_ = response.Body.Close()
	}

	if !errors.Is(err, ErrForbiddenAddress) {
		t.Fatalf("every connection is checked, a redirect's too, got %v", err)
	}
}
