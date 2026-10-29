package app

import (
	"fmt"
	"net"
	"net/url"
	"path/filepath"
	"strconv"

	"github.com/mediaryorg/mediary-node/server/internal/config"
)

// localBase is the node's own address: loopback when it listens on every
// interface, its own address otherwise.
func localBase(httpCfg config.HTTP) string {
	host := httpCfg.Host
	switch host {
	case "", "0.0.0.0", "::", "[::]":
		host = "127.0.0.1"
	}

	return "http://" + net.JoinHostPort(host, strconv.Itoa(httpCfg.Port))
}

// localDirectURL is how the node's own tools reach a file's direct endpoint.
// The token rides in the query, as for a video element.
func localDirectURL(httpCfg config.HTTP, token string) func(fileID int64) string {
	base := localBase(httpCfg)

	return func(fileID int64) string {
		address := fmt.Sprintf("%s/v1/playback/files/%d/direct", base, fileID)
		if token != "" {
			address += "?token=" + url.QueryEscape(token)
		}

		return address
	}
}

// localCoverURL is where a client loads a manual title's poster from. The token
// rides in the query too: an <img> sends no headers.
func localCoverURL(httpCfg config.HTTP, token string) func(id string, version int64) string {
	base := localBase(httpCfg)

	return func(id string, version int64) string {
		address := fmt.Sprintf("%s/v1/media/manual/%s/cover?v=%d", base, url.PathEscape(id), version)
		if token != "" {
			address += "&token=" + url.QueryEscape(token)
		}

		return address
	}
}

// coverDir is where manual titles' posters are kept, or nothing without a data
// directory.
func coverDir(dataDir string) string {
	if dataDir == "" {
		return ""
	}

	return filepath.Join(dataDir, "manual-covers")
}
