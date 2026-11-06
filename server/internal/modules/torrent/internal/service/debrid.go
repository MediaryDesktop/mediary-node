package service

import (
	"context"
	"strings"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

const keyDebrid = "torrent.debrid.service"

// debridNames name the services in messages.
var debridNames = map[string]string{
	DebridTorBox:     "TorBox",
	DebridRealDebrid: "Real-Debrid",
	DebridAllDebrid:  "AllDebrid",
	DebridPremiumize: "Premiumize",
}

// TorrentDebrid is the debrid service set up apart from the torrent client. With
// a key it plays torrents without downloading them and marks the releases it
// holds, whatever the client; downloads go through it only when the client is
// "debrid".
type TorrentDebrid struct {
	Service   string   `json:"service" enum:",torbox,realdebrid,alldebrid,premiumize" doc:"The service, or none."`
	HasAPIKey bool     `json:"has_api_key" doc:"Whether the service has a key saved; keys are never returned."`
	Keys      []string `json:"keys" doc:"The services that have a key saved, chosen or not: switching back needs no key typed again."`
	// Ready is a service with a key: what streams and cached marks need.
	Ready bool `json:"ready"`
	// InUse says the torrent client downloads through it, which keeps it from
	// being turned off until the client is changed.
	InUse bool `json:"in_use"`
}

type DebridUpdate struct {
	Service string
	// Nil keeps the service's saved key; "" removes it.
	APIKey *string
}

// activeService is the debrid service set up, with its key.
type activeService struct {
	kind    string
	service DebridService
}

func (s *Service) Debrid(ctx context.Context) (*TorrentDebrid, error) {
	kind, err := s.debridKind(ctx)
	if err != nil {
		return nil, err
	}

	debrid := &TorrentDebrid{Service: kind, Keys: []string{}}

	for _, candidate := range debridKinds {
		key, keyErr := s.secrets.Get(candidate)
		if keyErr != nil {
			return nil, apperr.Wrap(keyErr, apperr.KindInternal, "read the %s key", debridNames[candidate])
		}
		if key == "" {
			continue
		}
		debrid.Keys = append(debrid.Keys, candidate)
		if candidate == kind {
			debrid.HasAPIKey = true
		}
	}

	_, available := s.opts.Debrid[kind]
	debrid.Ready = kind != DebridNone && debrid.HasAPIKey && available

	conn, err := s.connection(ctx)
	if err != nil {
		return nil, err
	}
	debrid.InUse = conn.Kind == ClientDebrid

	return debrid, nil
}

// UpdateDebrid sets up the debrid service, or turns it off with an empty one.
func (s *Service) UpdateDebrid(ctx context.Context, update DebridUpdate) (*TorrentDebrid, error) {
	if update.APIKey != nil {
		trimmed := strings.TrimSpace(*update.APIKey)
		update.APIKey = &trimmed
	}

	if update.Service == DebridNone {
		conn, err := s.connection(ctx)
		if err != nil {
			return nil, err
		}
		if conn.Kind == ClientDebrid {
			return nil, apperr.New(apperr.KindConflict, "the torrent client downloads through the debrid service: choose another client first")
		}
	} else if err := s.requireDebridKey(update.Service, update.APIKey); err != nil {
		return nil, err
	}

	if err := s.store.SetMeta(ctx, keyDebrid, update.Service); err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "save the debrid service")
	}

	if update.APIKey != nil && update.Service != DebridNone {
		if err := s.secrets.Set(update.Service, *update.APIKey); err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "save the %s key", debridNames[update.Service])
		}
	}

	s.signal()
	s.publish("settings", 0)

	return s.Debrid(ctx)
}

// requireDebridKey refuses a debrid service this node lacks, or one left
// without a key: a new key given, or one saved before.
func (s *Service) requireDebridKey(kind string, given *string) error {
	if !IsDebrid(kind) {
		return apperr.Invalid("service", "unknown debrid service %q", kind)
	}
	if _, ok := s.opts.Debrid[kind]; !ok {
		return apperr.Invalid("service", "this node cannot use %s", debridNames[kind])
	}

	if given != nil {
		if *given == "" {
			return apperr.Invalid("api_key", "the %s key is empty", debridNames[kind])
		}
		return nil
	}

	saved, err := s.secrets.Get(kind)
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "read the %s key", debridNames[kind])
	}
	if saved == "" {
		return apperr.Invalid("api_key", "the %s key is empty", debridNames[kind])
	}

	return nil
}

// CheckDebrid tries a service's key, or its saved one when key is nil, and
// names the account.
func (s *Service) CheckDebrid(ctx context.Context, kind string, key *string) (*TorrentCheckResult, error) {
	if !IsDebrid(kind) {
		return nil, apperr.Invalid("service", "unknown debrid service %q", kind)
	}

	service, ok := s.opts.Debrid[kind]
	if !ok || service.Check == nil {
		return nil, apperr.New(apperr.KindUnavailable, "this node cannot use %s", debridNames[kind])
	}

	var tried string
	if key != nil {
		tried = *key
	} else {
		saved, err := s.secrets.Get(kind)
		if err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "read the %s key", debridNames[kind])
		}
		tried = saved
	}

	tried = strings.TrimSpace(tried)
	if tried == "" {
		return nil, apperr.Invalid("api_key", "the %s key is empty", debridNames[kind])
	}

	version, err := service.Check(ctx, tried)
	if err != nil {
		return nil, err
	}

	return &TorrentCheckResult{Version: version}, nil
}

// debridKind is the service set up. Before it had settings of its own, the
// torrent client named it, and that choice still counts until one is saved.
func (s *Service) debridKind(ctx context.Context) (string, error) {
	kind, saved, err := s.store.Meta(ctx, keyDebrid)
	if err != nil {
		return "", apperr.Wrap(err, apperr.KindInternal, "read the debrid service")
	}
	if saved {
		return kind, nil
	}

	client, _, err := s.store.Meta(ctx, keyKind)
	if err != nil {
		return "", apperr.Wrap(err, apperr.KindInternal, "read torrent settings")
	}
	if IsDebrid(client) {
		return client, nil
	}

	return DebridNone, nil
}

// activeDebrid is the debrid service set up with its key, or nil while there
// is none.
func (s *Service) activeDebrid(ctx context.Context) (*activeService, error) {
	kind, err := s.debridKind(ctx)
	if err != nil || kind == DebridNone {
		return nil, err
	}

	service, ok := s.opts.Debrid[kind]
	if !ok {
		return nil, nil
	}

	key, err := s.secrets.Get(kind)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read the %s key", debridNames[kind])
	}
	if key == "" {
		return nil, nil
	}

	return &activeService{kind: kind, service: service}, nil
}
