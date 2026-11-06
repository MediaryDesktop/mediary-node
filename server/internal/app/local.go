package app

import (
	"fmt"
	"net"
	"net/url"
	"path/filepath"
	"strconv"

	"github.com/mediaryorg/mediary-node/server/internal/config"
	"github.com/mediaryorg/mediary-node/server/internal/httpapi/middleware"
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
// The URL token rides in the query, as for a video element: this address is
// handed to mpv and FFmpeg on their command line.
func localDirectURL(httpCfg config.HTTP, nodeToken string) func(fileID int64) string {
	token := middleware.URLToken(nodeToken)
	base := localBase(httpCfg)

	return func(fileID int64) string {
		address := fmt.Sprintf("%s/v1/playback/files/%d/direct", base, fileID)
		if token != "" {
			address += "?token=" + url.QueryEscape(token)
		}

		return address
	}
}

// localCoverURL is where a client loads a manual title's poster from. The URL token
// rides in the query too: an <img> sends no headers.
func localCoverURL(httpCfg config.HTTP, nodeToken string) func(id string, version int64) string {
	token := middleware.URLToken(nodeToken)
	base := localBase(httpCfg)

	return func(id string, version int64) string {
		address := fmt.Sprintf("%s/v1/media/manual/%s/cover?v=%d", base, url.PathEscape(id), version)
		if token != "" {
			address += "&token=" + url.QueryEscape(token)
		}

		return address
	}
}

// dataSubdir is a folder of the node's own beside its data, or nothing without a
// data directory — the OpenAPI export has none.
func dataSubdir(dataDir, name string) string {
	if dataDir == "" {
		return ""
	}

	return filepath.Join(dataDir, name)
}
