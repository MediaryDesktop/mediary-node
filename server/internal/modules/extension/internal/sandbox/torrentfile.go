package sandbox

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// maxTorrentFile is the largest .torrent the node takes from a plugin's link.
// A season's batch is a few hundred kilobytes.
const maxTorrentFile = 10 << 20

// FetchTorrent downloads the .torrent a plugin's release links to. The node
// does this itself, after the search and outside the script — so under the
// plugin's own rule: a host on its list, on every redirect, at a public
// address. A link that redirects to a magnet gives the magnet, as indexers'
// links often do.
func (r *Runner) FetchTorrent(ctx context.Context, plugin Plugin, link string) (data []byte, magnet string, err error) {
	h := hosts(plugin.Network)

	target, err := url.Parse(link)
	if err != nil {
		return nil, "", fmt.Errorf("%q is not an address", link)
	}
	if checkErr := h.checkURL(target); checkErr != nil {
		return nil, "", checkErr
	}

	ctx, cancel := context.WithTimeout(ctx, r.limits.Request)
	defer cancel()

	client := clientFor(r.transport, h)
	guarded := client.CheckRedirect
	client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		if req.URL.Scheme == "magnet" {
			return http.ErrUseLastResponse
		}
		return guarded(req, via)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), http.NoBody)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("User-Agent", r.userAgent)

	resp, err := client.Do(req)
	if err != nil {
		return nil, "", errors.New(reason(err))
	}
	defer func() { _ = resp.Body.Close() }()

	if location := resp.Header.Get("Location"); strings.HasPrefix(location, "magnet:?") {
		return nil, location, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("the site answered %s for the torrent", resp.Status)
	}

	data, err = io.ReadAll(io.LimitReader(resp.Body, maxTorrentFile+1))
	if err != nil {
		return nil, "", errors.New(reason(err))
	}
	if len(data) > maxTorrentFile {
		return nil, "", fmt.Errorf("the torrent file is larger than %d MB", maxTorrentFile>>20)
	}

	return data, "", nil
}
