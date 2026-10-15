package debrid

import (
	"context"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/qbittorrent"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// Stream gives the service a torrent to play from rather than download: it is
// not among the downloads, nothing of it is fetched to disk, and it stays on the
// account afterwards like anything the user adds on the service's site. Returns
// the torrent's hash, by which its state and links are asked.
func (c *Client) Stream(ctx context.Context, magnet string, torrent []byte) (string, error) {
	if err := c.start(); err != nil {
		return "", err
	}

	hash, name, err := identify(qbittorrent.AddRequest{Magnet: magnet, Torrent: torrent})
	if err != nil {
		return "", err
	}

	remotes, err := c.listing(ctx, true)
	if err != nil {
		return "", err
	}

	var remoteID string
	if existing, ok := remotes[hash]; ok {
		remoteID = existing.ID
	} else if remoteID, err = c.opts.Provider.Add(ctx, magnet, torrent, name); err != nil {
		return "", err
	}

	c.mu.Lock()
	c.streams[hash] = remoteID
	c.listedAt = time.Time{}
	c.mu.Unlock()

	return hash, nil
}

// StreamState is how far the service is with a torrent given to Stream, its
// files included once it has them.
func (c *Client) StreamState(ctx context.Context, hash string) (Remote, error) {
	remotes, err := c.listing(ctx, false)
	if err != nil {
		return Remote{}, err
	}

	remote, ok := remotes[hash]
	if !ok {
		return Remote{Hash: hash}, nil
	}

	remote.Files = usable(remote.Files)

	return remote, nil
}

// StreamLink is an address to play one file of a ready torrent from.
func (c *Client) StreamLink(ctx context.Context, hash string, fileID int) (string, error) {
	remotes, err := c.listing(ctx, false)
	if err != nil {
		return "", err
	}

	remote, ok := remotes[hash]
	if !ok || !remote.Ready {
		return "", apperr.New(apperr.KindPrecondition, "%s does not hold the torrent's files yet", c.opts.Name)
	}

	return c.opts.Provider.Link(ctx, remote, fileID)
}
