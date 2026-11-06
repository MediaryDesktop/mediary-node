package service

import (
	"context"
	"strconv"
	"strings"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/qbittorrent"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

const (
	keyKind       = "torrent.client.kind"
	keyURL        = "torrent.client.url"
	keyUsername   = "torrent.client.username"
	keyRoot       = "torrent.download_root"
	keyMapClient  = "torrent.path_map.client"
	keyMapNode    = "torrent.path_map.node"
	secretKey     = "qbittorrent"
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
	Client      string `json:"client" enum:",qbittorrent,embedded,debrid" doc:"Who downloads torrents into the library: the user's qBittorrent, the node's own client, the debrid service set up under /v1/torrent/debrid, or none."`
	URL         string `json:"url"`
	Username    string `json:"username"`
	HasPassword bool   `json:"has_password"`
	RootID      int64  `json:"root_id" doc:"Library folder torrents are saved into; 0 saves them into default_folder."`
	// DefaultFolder is where torrents go while RootID is 0.
	DefaultFolder string         `json:"default_folder" doc:"The node's own download folder, used while no library folder is chosen. It joins the library on the first download; empty when the node has none."`
	PathMap       TorrentPathMap `json:"path_map"`
}

type TorrentSettingsUpdate struct {
	Client   string
	URL      string
	Username string
	// Nil keeps the saved password; "" removes it.
	Password *string
	RootID   int64
	PathMap  TorrentPathMap
}

func (s *Service) Settings(ctx context.Context) (*TorrentSettings, error) {
	conn, err := s.connection(ctx)
	if err != nil {
		return nil, err
	}

	settings := &TorrentSettings{
		Client:        conn.Kind,
		URL:           conn.URL,
		Username:      conn.Username,
		HasPassword:   conn.Password != "",
		DefaultFolder: s.opts.DownloadDir,
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

	switch update.Client {
	case ClientNone, ClientEmbedded:
	case ClientQBittorrent:
		if update.URL == "" {
			return nil, apperr.Invalid("url", "the qBittorrent address is empty")
		}
	case ClientDebrid:
		active, err := s.activeDebrid(ctx)
		if err != nil {
			return nil, err
		}
		if active == nil {
			return nil, apperr.Invalid("client", "set up a debrid service first: downloading through one needs its key")
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

	s.signal()
	s.publish("settings", 0)

	return s.Settings(ctx)
}

// TorrentCheckResult is what the client said when the node tried it.
type TorrentCheckResult struct {
	Version string `json:"version"`
}

// Check tries a connection before or after it is saved. An empty password means
// the saved one, so the user need not type it again. Downloading through the
// debrid service is checked with the service's saved key.
func (s *Service) Check(ctx context.Context, conn Connection, keepPassword bool) (*TorrentCheckResult, error) {
	switch conn.Kind {
	case ClientEmbedded:
		if s.opts.Embedded == nil {
			return nil, apperr.New(apperr.KindUnavailable, "this node has no built-in torrent client")
		}

		version, err := s.opts.Embedded.Version(ctx)
		if err != nil {
			return nil, err
		}

		return &TorrentCheckResult{Version: version}, nil
	case ClientDebrid:
		active, err := s.activeDebrid(ctx)
		if err != nil {
			return nil, err
		}
		if active == nil {
			return nil, apperr.New(apperr.KindPrecondition, "set up a debrid service first")
		}

		return s.CheckDebrid(ctx, active.kind, nil)
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
	// Before the debrid service had settings of its own, the client named it.
	if IsDebrid(kind) {
		kind = ClientDebrid
	}

	username, _, err := s.store.Meta(ctx, keyUsername)
	if err != nil {
		return Connection{}, apperr.Wrap(err, apperr.KindInternal, "read torrent settings")
	}

	password, err := s.secrets.Get(secretKey)
	if err != nil {
		return Connection{}, apperr.Wrap(err, apperr.KindInternal, "read the qBittorrent password")
	}

	return Connection{Kind: kind, URL: url, Username: username, Password: password}, nil
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
	case ClientDebrid:
		active, debridErr := s.activeDebrid(ctx)
		if debridErr != nil || active == nil {
			return nil, debridErr
		}
		return active.service.Client, nil
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
