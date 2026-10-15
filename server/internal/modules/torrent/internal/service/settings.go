package service

import (
	"context"
	"strconv"
	"strings"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/qbittorrent"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

const (
	keyKind       = "torrent.client.kind"
	keyURL        = "torrent.client.url"
	keyUsername   = "torrent.client.username"
	keyRoot       = "torrent.download_root"
	keyMapClient  = "torrent.path_map.client"
	keyMapNode    = "torrent.path_map.node"
	secretKey     = "qbittorrent"
	torboxKey     = "torbox"
	torrentTag    = "mediary"
	torrentFolder = "mediary"
)

// TorrentPathMap translates folders between the node and a client that sees the disk
// under other names — qBittorrent in Docker or on a NAS. Empty means both see the
// same paths.
type TorrentPathMap struct {
	Client string `json:"client"`
	Node   string `json:"node"`
}

type TorrentSettings struct {
	Client      string         `json:"client" enum:",qbittorrent,embedded,torbox" doc:"The user's qBittorrent, the node's own client, the user's TorBox account, or none."`
	URL         string         `json:"url"`
	Username    string         `json:"username"`
	HasPassword bool           `json:"has_password"`
	HasAPIKey   bool           `json:"has_api_key" doc:"Whether a TorBox API key is saved; the key itself is never returned."`
	RootID      int64          `json:"root_id"`
	PathMap     TorrentPathMap `json:"path_map"`
}

type TorrentSettingsUpdate struct {
	Client   string
	URL      string
	Username string
	// Nil keeps the saved password; "" removes it.
	Password *string
	// Nil keeps the saved TorBox key; "" removes it.
	APIKey  *string
	RootID  int64
	PathMap TorrentPathMap
}

func (s *Service) Settings(ctx context.Context) (*TorrentSettings, error) {
	conn, err := s.connection(ctx)
	if err != nil {
		return nil, err
	}

	settings := &TorrentSettings{
		Client:      conn.Kind,
		URL:         conn.URL,
		Username:    conn.Username,
		HasPassword: conn.Password != "",
		HasAPIKey:   conn.APIKey != "",
	}

	if raw, _, err := s.store.Meta(ctx, keyRoot); err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read the download folder")
	} else if raw != "" {
		settings.RootID, _ = strconv.ParseInt(raw, 10, 64)
	}

	for key, target := range map[string]*string{keyMapClient: &settings.PathMap.Client, keyMapNode: &settings.PathMap.Node} {
		value, _, err := s.store.Meta(ctx, key)
		if err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "read the path mapping")
		}
		*target = value
	}

	return settings, nil
}

func (s *Service) UpdateSettings(ctx context.Context, update TorrentSettingsUpdate) (*TorrentSettings, error) {
	update.URL = strings.TrimSpace(update.URL)
	update.PathMap.Client = strings.TrimSpace(update.PathMap.Client)

	// A desktop from before the built-in client sends an address and no kind.
	if update.Client == ClientNone && update.URL != "" {
		update.Client = ClientQBittorrent
	}

	if update.APIKey != nil {
		trimmed := strings.TrimSpace(*update.APIKey)
		update.APIKey = &trimmed
	}

	switch update.Client {
	case ClientNone, ClientEmbedded:
	case ClientQBittorrent:
		if update.URL == "" {
			return nil, apperr.Invalid("url", "the qBittorrent address is empty")
		}
	case ClientTorBox:
		if s.opts.TorBox == nil {
			return nil, apperr.Invalid("client", "this node cannot use TorBox")
		}
		if update.APIKey == nil {
			saved, err := s.secrets.Get(torboxKey)
			if err != nil {
				return nil, apperr.Wrap(err, apperr.KindInternal, "read the TorBox API key")
			}
			if saved == "" {
				return nil, apperr.Invalid("api_key", "the TorBox API key is empty")
			}
		} else if *update.APIKey == "" {
			return nil, apperr.Invalid("api_key", "the TorBox API key is empty")
		}
	default:
		return nil, apperr.Invalid("client", "unknown torrent client %q", update.Client)
	}
	if update.Client == ClientEmbedded && s.opts.Embedded == nil {
		return nil, apperr.Invalid("client", "this node has no built-in torrent client")
	}
	update.PathMap.Node = strings.TrimSpace(update.PathMap.Node)

	if update.URL != "" {
		if _, err := qbittorrent.New(qbittorrent.Options{URL: update.URL}); err != nil {
			return nil, err
		}
	}

	if (update.PathMap.Client == "") != (update.PathMap.Node == "") {
		return nil, apperr.Invalid("path_map", "a path mapping needs both the client's folder and the node's")
	}

	if update.RootID != 0 {
		if _, found, err := s.library.RootPath(ctx, update.RootID); err != nil {
			return nil, err
		} else if !found {
			return nil, apperr.Invalid("root_id", "library folder %d does not exist", update.RootID)
		}
	}

	values := map[string]string{
		keyKind:      update.Client,
		keyURL:       update.URL,
		keyUsername:  update.Username,
		keyRoot:      "",
		keyMapClient: update.PathMap.Client,
		keyMapNode:   update.PathMap.Node,
	}
	if update.RootID != 0 {
		values[keyRoot] = strconv.FormatInt(update.RootID, 10)
	}

	for key, value := range values {
		if err := s.store.SetMeta(ctx, key, value); err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "save torrent settings")
		}
	}

	if update.Password != nil {
		if err := s.secrets.Set(secretKey, *update.Password); err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "save the qBittorrent password")
		}
	}
	if update.APIKey != nil {
		if err := s.secrets.Set(torboxKey, *update.APIKey); err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "save the TorBox API key")
		}
	}

	s.signal()
	s.publish("settings", 0)

	return s.Settings(ctx)
}

// TorrentCheckResult is what the client said when the node tried it.
type TorrentCheckResult struct {
	Version string `json:"version"`
}

// Check tries a connection before or after it is saved. An empty password with
// the saved URL means the saved password, so the user need not type it again.
func (s *Service) Check(ctx context.Context, conn Connection, keepPassword bool) (*TorrentCheckResult, error) {
	if conn.Kind == ClientEmbedded {
		if s.opts.Embedded == nil {
			return nil, apperr.New(apperr.KindUnavailable, "this node has no built-in torrent client")
		}

		version, err := s.opts.Embedded.Version(ctx)
		if err != nil {
			return nil, err
		}

		return &TorrentCheckResult{Version: version}, nil
	}

	if conn.Kind == ClientTorBox {
		return s.checkTorBox(ctx, conn.APIKey, keepPassword)
	}

	conn.URL = strings.TrimSpace(conn.URL)
	if conn.URL == "" {
		return nil, apperr.Invalid("url", "the qBittorrent address is empty")
	}

	if keepPassword {
		saved, err := s.secrets.Get(secretKey)
		if err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "read the qBittorrent password")
		}
		conn.Password = saved
	}

	client, err := s.opts.NewClient(conn)
	if err != nil {
		return nil, err
	}

	version, err := client.Version(ctx)
	if err != nil {
		return nil, err
	}

	return &TorrentCheckResult{Version: version}, nil
}

// checkTorBox tries a TorBox key, or the saved one when keepKey, and names the
// account's plan.
func (s *Service) checkTorBox(ctx context.Context, key string, keepKey bool) (*TorrentCheckResult, error) {
	if s.opts.CheckTorBox == nil {
		return nil, apperr.New(apperr.KindUnavailable, "this node cannot use TorBox")
	}

	if keepKey {
		saved, err := s.secrets.Get(torboxKey)
		if err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "read the TorBox API key")
		}
		key = saved
	}

	key = strings.TrimSpace(key)
	if key == "" {
		return nil, apperr.Invalid("api_key", "the TorBox API key is empty")
	}

	version, err := s.opts.CheckTorBox(ctx, key)
	if err != nil {
		return nil, err
	}

	return &TorrentCheckResult{Version: version}, nil
}

// connection is the saved connection, or the environment's until one is saved.
// Settings saved before the built-in client existed hold only an address, which
// meant qBittorrent.
func (s *Service) connection(ctx context.Context) (Connection, error) {
	kind, kindSaved, err := s.store.Meta(ctx, keyKind)
	if err != nil {
		return Connection{}, apperr.Wrap(err, apperr.KindInternal, "read torrent settings")
	}

	url, urlSaved, err := s.store.Meta(ctx, keyURL)
	if err != nil {
		return Connection{}, apperr.Wrap(err, apperr.KindInternal, "read torrent settings")
	}
	if !kindSaved && !urlSaved {
		return s.opts.Defaults, nil
	}
	if !kindSaved && url != "" {
		kind = ClientQBittorrent
	}

	username, _, err := s.store.Meta(ctx, keyUsername)
	if err != nil {
		return Connection{}, apperr.Wrap(err, apperr.KindInternal, "read torrent settings")
	}

	password, err := s.secrets.Get(secretKey)
	if err != nil {
		return Connection{}, apperr.Wrap(err, apperr.KindInternal, "read the qBittorrent password")
	}

	apiKey, err := s.secrets.Get(torboxKey)
	if err != nil {
		return Connection{}, apperr.Wrap(err, apperr.KindInternal, "read the TorBox API key")
	}

	return Connection{Kind: kind, URL: url, Username: username, Password: password, APIKey: apiKey}, nil
}

// currentClient is the client for the saved connection, or nil when there is
// none.
func (s *Service) currentClient(ctx context.Context) (Client, error) {
	conn, err := s.connection(ctx)
	if err != nil {
		return nil, err
	}

	switch conn.Kind {
	case ClientEmbedded:
		if s.opts.Embedded == nil {
			return nil, apperr.New(apperr.KindUnavailable, "this node has no built-in torrent client")
		}
		return s.opts.Embedded, nil
	case ClientTorBox:
		if s.opts.TorBox == nil {
			return nil, apperr.New(apperr.KindUnavailable, "this node cannot use TorBox")
		}
		if conn.APIKey == "" {
			return nil, nil
		}
		return s.opts.TorBox, nil
	case ClientQBittorrent:
		if conn.URL == "" {
			return nil, nil
		}
	default:
		return nil, nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.client != nil && s.clientConn == conn {
		return s.client, nil
	}

	client, err := s.opts.NewClient(conn)
	if err != nil {
		return nil, err
	}

	s.client, s.clientConn = client, conn

	return client, nil
}

func (s *Service) requireClient(ctx context.Context) (Client, error) {
	client, err := s.currentClient(ctx)
	if err != nil {
		return nil, err
	}
	if client == nil {
		return nil, apperr.New(apperr.KindPrecondition, "choose a torrent client in the settings first")
	}

	return client, nil
}
