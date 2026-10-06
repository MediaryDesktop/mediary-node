// Package metainfo reads the two things the node needs from what the user hands
// over — a magnet link or a .torrent file — before the client has it: the info
// hash, which is how the client names the torrent, and a display name.
package metainfo

import (
	"crypto/sha1" //nolint:gosec // BitTorrent v1 names a torrent by the SHA-1 of its info dictionary.
	"encoding/base32"
	"encoding/hex"
	"net/url"
	"strconv"
	"strings"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// The largest .torrent file the node accepts; a season pack's is well under 1 MiB.
const MaxTorrentBytes = 8 << 20

type Info struct {
	// InfoHash is the v1 hash in lower-case hex, as qBittorrent reports it.
	InfoHash string
	Name     string
}

// FromMagnet reads a magnet link. Only links with a v1 (btih) hash are accepted:
// a v2-only torrent is named by a different hash the node could not match.
func FromMagnet(raw string) (*Info, error) {
	raw = strings.TrimSpace(raw)

	link, err := url.Parse(raw)
	if err != nil || link.Scheme != "magnet" {
		return nil, apperr.Invalid("magnet", "this is not a magnet link")
	}

	query, err := url.ParseQuery(link.RawQuery)
	if err != nil {
		return nil, apperr.Invalid("magnet", "this magnet link cannot be read")
	}

	for _, topic := range query["xt"] {
		value, ok := strings.CutPrefix(strings.ToLower(topic), "urn:btih:")
		if !ok {
			continue
		}

		hash, err := hashFromTopic(topic[len(topic)-len(value):])
		if err != nil {
			return nil, err
		}

		return &Info{InfoHash: hash, Name: query.Get("dn")}, nil
	}

	return nil, apperr.Invalid("magnet", "the magnet link has no BitTorrent v1 hash")
}

func hashFromTopic(value string) (string, error) {
	switch len(value) {
	case 40:
		if _, err := hex.DecodeString(value); err == nil {
			return strings.ToLower(value), nil
		}
	case 32:
		if decoded, err := base32.StdEncoding.DecodeString(strings.ToUpper(value)); err == nil {
			return hex.EncodeToString(decoded), nil
		}
	}

	return "", apperr.Invalid("magnet", "the magnet link's hash is malformed")
}

// FromTorrent reads a .torrent file.
func FromTorrent(data []byte) (*Info, error) {
	if len(data) > MaxTorrentBytes {
		return nil, apperr.Invalid("torrent", "the .torrent file is larger than %d MiB", MaxTorrentBytes>>20)
	}

	d := decoder{data: data}

	if d.peek() != 'd' {
		return nil, apperr.Invalid("torrent", "this is not a .torrent file")
	}
	d.pos++

	for d.pos < len(d.data) && d.peek() != 'e' {
		key, err := d.bytes()
		if err != nil {
			return nil, err
		}

		start := d.pos
		if err := d.skip(0); err != nil {
			return nil, err
		}

		if string(key) != "info" {
			continue
		}

		raw := d.data[start:d.pos]
		if raw[0] != 'd' {
			return nil, apperr.Invalid("torrent", "the .torrent file's info is not a dictionary")
		}

		sum := sha1.Sum(raw) //nolint:gosec // See the import.

		return &Info{InfoHash: hex.EncodeToString(sum[:]), Name: infoName(raw)}, nil
	}

	return nil, apperr.Invalid("torrent", "the .torrent file has no info dictionary")
}

// infoName is the "name" entry of the info dictionary, or "" without one.
func infoName(raw []byte) string {
	d := decoder{data: raw, pos: 1}

	for d.pos < len(d.data) && d.peek() != 'e' {
		key, err := d.bytes()
		if err != nil {
			return ""
		}

		if string(key) == "name" && d.peek() >= '0' && d.peek() <= '9' {
			value, err := d.bytes()
			if err != nil {
				return ""
			}
			return string(value)
		}

		if err := d.skip(0); err != nil {
			return ""
		}
	}

	return ""
}

// The deepest nesting a real .torrent has is a few levels; a deeper one is an
// attack on the stack, not a torrent.
const maxDepth = 64

type decoder struct {
	data []byte
	pos  int
}

func (d *decoder) peek() byte {
	if d.pos >= len(d.data) {
		return 0
	}
	return d.data[d.pos]
}

func malformed() error {
	return apperr.Invalid("torrent", "the .torrent file is malformed")
}

// bytes reads a byte string: <length>:<bytes>.
func (d *decoder) bytes() ([]byte, error) {
	colon := d.pos
	for colon < len(d.data) && d.data[colon] != ':' {
		colon++
	}
	if colon >= len(d.data) {
		return nil, malformed()
	}

	length, err := strconv.Atoi(string(d.data[d.pos:colon]))
	if err != nil || length < 0 || colon+1+length > len(d.data) {
		return nil, malformed()
	}

	start := colon + 1
	d.pos = start + length

	return d.data[start:d.pos], nil
}

// skip moves past one value of any type.
func (d *decoder) skip(depth int) error {
	if depth > maxDepth {
		return malformed()
	}

	switch c := d.peek(); {
	case c == 'i':
		end := d.pos + 1
		for end < len(d.data) && d.data[end] != 'e' {
			end++
		}
		if end >= len(d.data) {
			return malformed()
		}
		d.pos = end + 1
	case c == 'l' || c == 'd':
		d.pos++
		for d.peek() != 'e' {
			if d.pos >= len(d.data) {
				return malformed()
			}
			if err := d.skip(depth + 1); err != nil {
				return err
			}
		}
		d.pos++
	case c >= '0' && c <= '9':
		if _, err := d.bytes(); err != nil {
			return err
		}
	default:
		return malformed()
	}

	return nil
}
