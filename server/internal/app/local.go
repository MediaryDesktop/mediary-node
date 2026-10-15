package app

import (
	"fmt"
	"net"
	"net/url"
	"strconv"

	"github.com/mediaryorg/mediary-node/server/internal/config"
)

// localDirectURL is how the node's own tools reach a file's direct endpoint:
// over loopback when the node listens on every interface, on its own address
// otherwise. The token rides in the query, as for a video element.
func localDirectURL(httpCfg config.HTTP, token string) func(fileID int64) string {
	host := httpCfg.Host
	switch host {
	case "", "0.0.0.0", "::", "[::]":
		host = "127.0.0.1"
	}

	base := "http://" + net.JoinHostPort(host, strconv.Itoa(httpCfg.Port))

	return func(fileID int64) string {
		address := fmt.Sprintf("%s/v1/playback/files/%d/direct", base, fileID)
		if token != "" {
			address += "?token=" + url.QueryEscape(token)
		}

		return address
	}
}
