package torbox

import (
	"context"
	"strconv"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/debrid"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// Provider is TorBox as the debrid client uses it.
type Provider struct {
	client *Client
}

var _ debrid.Provider = (*Provider)(nil)

func NewProvider(client *Client) *Provider {
	return &Provider{client: client}
}

func (p *Provider) Account(ctx context.Context) (string, error) {
	user, err := p.client.Me(ctx)
	if err != nil {
		return "", err
	}

	if plan := PlanName(user.Plan); plan != "" {
		return "TorBox · " + plan + " plan", nil
	}

	return "TorBox", nil
}

func (p *Provider) Add(ctx context.Context, magnet string, torrent []byte, name string) error {
	_, err := p.client.Create(ctx, magnet, torrent, name)
	return err
}

// Remotes lists the account's torrents and its queue. A queue that cannot be
// read leaves the torrents still listed: they are what downloads follow.
func (p *Provider) Remotes(ctx context.Context) ([]debrid.Remote, error) {
	torrents, err := p.client.Torrents(ctx)
	if err != nil {
		return nil, err
	}

	remotes := make([]debrid.Remote, 0, len(torrents))
	for i := range torrents {
		t := torrents[i]

		files := make([]debrid.RemoteFile, 0, len(t.Files))
		for _, f := range t.Files {
			files = append(files, debrid.RemoteFile{ID: f.ID, Path: f.Name, Size: f.Size})
		}

		remotes = append(remotes, debrid.Remote{
			ID:       strconv.FormatInt(t.ID, 10),
			Hash:     t.Hash,
			Name:     t.Name,
			Ready:    t.Present,
			Progress: t.Progress,
			Files:    files,
		})
	}

	if queued, err := p.client.Queue(ctx); err == nil {
		for _, q := range queued {
			if q.Hash == "" {
				continue
			}
			remotes = append(remotes, debrid.Remote{ID: strconv.FormatInt(q.ID, 10), Hash: q.Hash, Name: q.Name, Queued: true})
		}
	}

	return remotes, nil
}

func (p *Provider) Link(ctx context.Context, remote debrid.Remote, fileID int) (string, error) {
	id, err := remoteID(remote)
	if err != nil {
		return "", err
	}

	return p.client.Link(ctx, id, fileID)
}

func (p *Provider) Delete(ctx context.Context, remote debrid.Remote) error {
	id, err := remoteID(remote)
	if err != nil {
		return err
	}

	return p.client.Delete(ctx, id, remote.Queued)
}

func remoteID(remote debrid.Remote) (int64, error) {
	id, err := strconv.ParseInt(remote.ID, 10, 64)
	if err != nil {
		return 0, apperr.New(apperr.KindInternal, "TorBox torrent ID %q is not a number", remote.ID)
	}

	return id, nil
}
