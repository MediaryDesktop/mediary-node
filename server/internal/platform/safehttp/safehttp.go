// Package safehttp fetches addresses someone else chose — a URL pasted by the
// user, a picture a search engine found — without letting them reach what only
// the node can: itself, the user's router, other machines on the local network.
package safehttp

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"syscall"
	"time"
)

// ErrForbiddenAddress is a request that would leave the public internet.
var ErrForbiddenAddress = errors.New("address is not on the public internet")

const maxRedirects = 5

// NewClient returns a client that connects only to public addresses. The check
// runs on the address actually dialled, after DNS, so a name that resolves to
// 127.0.0.1 — or starts to, between two lookups — is refused all the same, and
// so is every hop of a redirect.
func NewClient(timeout time.Duration) *http.Client {
	dialer := &net.Dialer{
		Timeout: 10 * time.Second,
		Control: func(_, address string, _ syscall.RawConn) error {
			return checkAddress(address)
		},
	}

	transport := &http.Transport{
		Proxy:                 nil,
		DialContext:           dialer.DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          10,
		IdleConnTimeout:       30 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 20 * time.Second,
	}

	return &http.Client{
		Timeout:   timeout,
		Transport: transport,
		CheckRedirect: func(request *http.Request, via []*http.Request) error {
			if len(via) >= maxRedirects {
				return fmt.Errorf("stopped after %d redirects", maxRedirects)
			}

			return CheckURLScheme(request.URL.Scheme)
		},
	}
}

// CheckURLScheme allows plain web addresses only: no file:, no ftp:, no data:.
func CheckURLScheme(scheme string) error {
	if scheme != "http" && scheme != "https" {
		return fmt.Errorf("%w: scheme %q", ErrForbiddenAddress, scheme)
	}

	return nil
}

func checkAddress(address string) error {
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		return fmt.Errorf("%w: %s", ErrForbiddenAddress, address)
	}

	ip, err := netip.ParseAddr(host)
	if err != nil {
		return fmt.Errorf("%w: %s", ErrForbiddenAddress, host)
	}

	if !Public(ip) {
		return fmt.Errorf("%w: %s", ErrForbiddenAddress, ip)
	}

	return nil
}

// Public reports whether an address is somewhere on the internet rather than on
// this machine or the network it sits in.
func Public(ip netip.Addr) bool {
	ip = ip.Unmap()

	if !ip.IsValid() || ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsInterfaceLocalMulticast() || ip.IsMulticast() || ip.IsUnspecified() {
		return false
	}

	for _, blocked := range nonPublic {
		if blocked.Contains(ip) {
			return false
		}
	}

	return true
}

// Ranges the standard library does not call private but that are not the
// internet either: carrier-grade NAT, the IPv4 "this network" block, benchmarking,
// IPv6 unique-local and the IPv4-embedding prefixes that could smuggle a private
// address through.
var nonPublic = []netip.Prefix{
	netip.MustParsePrefix("0.0.0.0/8"),
	netip.MustParsePrefix("100.64.0.0/10"),
	netip.MustParsePrefix("192.0.0.0/24"),
	netip.MustParsePrefix("198.18.0.0/15"),
	netip.MustParsePrefix("240.0.0.0/4"),
	netip.MustParsePrefix("fc00::/7"),
	netip.MustParsePrefix("64:ff9b::/96"),
	netip.MustParsePrefix("2002::/16"),
}

// Get fetches a URL with the client, after checking its scheme.
func Get(ctx context.Context, client *http.Client, address string, header http.Header) (*http.Response, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, address, http.NoBody)
	if err != nil {
		return nil, err
	}

	if err := CheckURLScheme(request.URL.Scheme); err != nil {
		return nil, err
	}

	for name, values := range header {
		request.Header[name] = values
	}

	return client.Do(request)
}
