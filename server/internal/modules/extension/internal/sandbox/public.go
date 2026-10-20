package sandbox

import (
	"context"
	"fmt"
	"net/http"
	"net/netip"
	"time"

	"github.com/dop251/goja"
)

// PublicClient fetches what a plugin's manifest points at — the manifest
// itself, the code, an update — under the same rule as the plugin's own
// requests: public addresses only, no proxy from the environment. A manifest
// is written by whoever wrote the plugin; its addresses must not reach the
// node or the user's network either.
func PublicClient(timeout time.Duration) *http.Client {
	return publicClient(timeout, resolveSystem, publicAddr)
}

func publicClient(
	timeout time.Duration,
	resolve func(ctx context.Context, host string) ([]netip.Addr, error),
	allow func(netip.Addr) bool,
) *http.Client {
	limits := DefaultLimits()
	limits.Request = timeout

	return &http.Client{
		Transport: newTransport(&dialer{resolve: resolve, allow: allow}, limits),
		Timeout:   timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= maxRedirects {
				return fmt.Errorf("more than %d redirects", maxRedirects)
			}
			if req.URL.Scheme != "https" {
				return fmt.Errorf("redirected to %s: only https", req.URL.Redacted())
			}
			return nil
		},
	}
}

// Compile checks that code parses, without running any of it.
func Compile(name, code string) error {
	_, err := goja.Compile(name, code, false)

	return err
}
