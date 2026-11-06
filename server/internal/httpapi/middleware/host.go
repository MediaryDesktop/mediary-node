package middleware

import (
	"net"
	"net/http"
	"strings"
)

// LoopbackHost refuses a request whose Host is not a name of this machine. A
// node on loopback is only ever addressed as 127.0.0.1, localhost or ::1; any
// other name means a page rebound its own domain to 127.0.0.1 to talk to the
// node as if it were its own origin (DNS rebinding). The token stops it from
// doing anything, but the routes without one — /healthz, /docs, /openapi.* —
// would still answer. The port is not checked: the shell may move the node to
// another one, and a rebound name differs in the host part anyway.
func LoopbackHost(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !loopbackName(r.Host) {
			http.Error(w, "this node only answers to a loopback address", http.StatusMisdirectedRequest)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func loopbackName(hostport string) bool {
	host := hostport
	if h, _, err := net.SplitHostPort(hostport); err == nil {
		host = h
	}
	host = strings.TrimSuffix(strings.TrimPrefix(host, "["), "]")

	switch strings.ToLower(host) {
	case "127.0.0.1", "localhost", "::1":
		return true
	}

	return false
}
