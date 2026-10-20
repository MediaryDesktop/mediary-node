package sandbox

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"time"
)

// hosts is a plugin's network list, as its manifest names it: exact host
// names, and "*.example.org" for the subdomains of example.org.
type hosts []string

func (h hosts) allows(host string) bool {
	host = strings.ToLower(strings.TrimSuffix(host, "."))
	if host == "" {
		return false
	}

	for _, entry := range h {
		if suffix, ok := strings.CutPrefix(entry, "*."); ok {
			if strings.HasSuffix(host, "."+suffix) {
				return true
			}

			continue
		}

		if host == entry {
			return true
		}
	}

	return false
}

// checkURL is the gate every address a plugin asks for goes through, first
// and after every redirect: http or https, no user name, a host on its list.
// An IP address is never on the list, so a literal one is always refused.
func (h hosts) checkURL(u *url.URL) error {
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("%s: only http and https", u.Redacted())
	}
	if u.User != nil {
		return fmt.Errorf("%s: no user names in addresses", u.Redacted())
	}
	if !h.allows(u.Hostname()) {
		return &HostError{Host: u.Hostname()}
	}

	return nil
}

// HostError is a host the plugin's manifest does not list.
type HostError struct {
	Host string
}

func (e *HostError) Error() string {
	return fmt.Sprintf("%s is not one of the hosts the plugin's manifest lists", e.Host)
}

// LocalAddressError is a listed host that resolves somewhere a plugin must not
// reach: the node itself, the user's network, the cloud metadata service.
type LocalAddressError struct {
	Host string
	Addr netip.Addr
}

func (e *LocalAddressError) Error() string {
	if e.Host == e.Addr.String() {
		return fmt.Sprintf("%s is a local or private address", e.Host)
	}

	return fmt.Sprintf("%s resolves to %s, a local or private address", e.Host, e.Addr)
}

// Ranges no plugin reaches whatever its hosts resolve to. netip knows
// loopback, private, link-local and multicast; these are the rest: shared
// carrier NAT, "this network", benchmarking, reserved, and the IPv6 ways of
// carrying an IPv4 address that might be one of the above.
var blocked = []netip.Prefix{
	netip.MustParsePrefix("0.0.0.0/8"),
	netip.MustParsePrefix("100.64.0.0/10"),
	netip.MustParsePrefix("192.0.0.0/24"),
	netip.MustParsePrefix("192.0.2.0/24"),
	netip.MustParsePrefix("198.18.0.0/15"),
	netip.MustParsePrefix("198.51.100.0/24"),
	netip.MustParsePrefix("203.0.113.0/24"),
	netip.MustParsePrefix("240.0.0.0/4"),
	netip.MustParsePrefix("64:ff9b::/96"),
	netip.MustParsePrefix("64:ff9b:1::/48"),
	netip.MustParsePrefix("2001::/32"),
	netip.MustParsePrefix("2002::/16"),
	netip.MustParsePrefix("2001:db8::/32"),
	netip.MustParsePrefix("100::/64"),
}

// publicAddr says whether an address is on the public internet.
func publicAddr(addr netip.Addr) bool {
	addr = addr.Unmap()

	if !addr.IsValid() || addr.IsUnspecified() || addr.IsLoopback() || addr.IsPrivate() ||
		addr.IsLinkLocalUnicast() || addr.IsLinkLocalMulticast() || addr.IsInterfaceLocalMulticast() ||
		addr.IsMulticast() {
		return false
	}

	for _, prefix := range blocked {
		if prefix.Contains(addr) {
			return false
		}
	}

	return true
}

// dialer resolves a host itself and connects to the address it checked, so a
// name cannot resolve to a public address for the check and a local one for
// the connection.
type dialer struct {
	resolve func(ctx context.Context, host string) ([]netip.Addr, error)
	allow   func(netip.Addr) bool
	net     net.Dialer
}

func (d *dialer) DialContext(ctx context.Context, network, address string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return nil, err
	}

	var addrs []netip.Addr
	if literal, parseErr := netip.ParseAddr(host); parseErr == nil {
		addrs = []netip.Addr{literal}
	} else {
		addrs, err = d.resolve(ctx, host)
		if err != nil {
			return nil, err
		}
	}

	if len(addrs) == 0 {
		return nil, fmt.Errorf("%s does not resolve", host)
	}

	// One local answer among public ones is enough to refuse: which one a
	// connection gets is up to whoever runs the name server.
	for _, addr := range addrs {
		if !d.allow(addr) {
			return nil, &LocalAddressError{Host: host, Addr: addr.Unmap()}
		}
	}

	var lastErr error
	for _, addr := range addrs {
		conn, dialErr := d.net.DialContext(ctx, network, net.JoinHostPort(addr.Unmap().String(), port))
		if dialErr == nil {
			return conn, nil
		}
		lastErr = dialErr
	}

	return nil, lastErr
}

func resolveSystem(ctx context.Context, host string) ([]netip.Addr, error) {
	return net.DefaultResolver.LookupNetIP(ctx, "ip", host)
}

const maxRedirects = 5

// newTransport is shared by every plugin: it knows nothing of any plugin's
// hosts, only which addresses no plugin may reach. No proxy from the
// environment: a proxy would make the address check meaningless.
func newTransport(d *dialer, limits Limits) *http.Transport {
	return &http.Transport{
		Proxy:                  nil,
		DialContext:            d.DialContext,
		ForceAttemptHTTP2:      true,
		TLSHandshakeTimeout:    10 * time.Second,
		ResponseHeaderTimeout:  limits.Request,
		MaxResponseHeaderBytes: 64 << 10,
		MaxIdleConns:           32,
		IdleConnTimeout:        90 * time.Second,
	}
}

// clientFor checks every redirect against the plugin's hosts, as the first
// request was.
func clientFor(transport http.RoundTripper, h hosts) *http.Client {
	return &http.Client{
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= maxRedirects {
				return fmt.Errorf("more than %d redirects", maxRedirects)
			}
			if err := h.checkURL(req.URL); err != nil {
				return fmt.Errorf("redirected to %w", err)
			}

			return nil
		},
	}
}

// reason turns what the HTTP client wrapped back into the plain sentence a
// plugin and the user should see.
func reason(err error) string {
	var host *HostError
	var local *LocalAddressError

	switch {
	case errors.As(err, &local):
		return local.Error()
	case errors.As(err, &host):
		if strings.Contains(err.Error(), "redirected to") {
			return "redirected to " + host.Error()
		}
		return host.Error()
	case errors.Is(err, context.DeadlineExceeded):
		return "the request took too long"
	case errors.Is(err, context.Canceled):
		return "the search was stopped"
	}

	var urlErr *url.Error
	if errors.As(err, &urlErr) {
		return urlErr.Err.Error()
	}

	return err.Error()
}
