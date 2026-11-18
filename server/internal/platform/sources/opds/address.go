package opds

import (
	"net/url"
	"strings"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

// ServerURL is the address of an OPDS server as the user typed it, made fit to
// save: an http or https URL with a host, without a fragment. The user name and
// password have fields of their own; an address carrying them is refused, so
// they are never stored in plain sight beside it.
func ServerURL(raw string) (string, error) {
	address, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (address.Scheme != "http" && address.Scheme != "https") || address.Host == "" {
		return "", apperr.Invalid("url", "the address must start with http:// or https://")
	}
	if address.User != nil {
		return "", apperr.Invalid("url", "put the user name and password in their own fields, not in the address")
	}

	address.Fragment = ""

	return address.String(), nil
}
