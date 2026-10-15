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
	Client      string         `json:"client" enum:",qbittorrent,embedded,torbox,realdebrid,alldebrid,premiumize" doc:"The user's qBittorrent, the node's own client, the user's account on a debrid service, or none."`
	URL         string         `json:"url"`
	Username    string         `json:"username"`
	HasPassword bool           `json:"has_password"`
	HasAPIKey   bool           `json:"has_api_key" doc:"Whether the chosen debrid service has a key saved; keys are never returned."`
	DebridKeys  []string       `json:"debrid_keys" doc:"The debrid services that have a key saved, chosen or not."`
	RootID      int64          `json:"root_id"`
	PathMap     TorrentPathMap `json:"path_map"`
}

type TorrentSettingsUpdate struct {
	Client   string
	URL      string
	Username string
	// Nil keeps the saved password; "" removes it.
	Password *string
	// The chosen debrid service's key. Nil keeps the saved one; "" removes it.
	APIKey  *string
	RootID  int64
	PathMap TorrentPathMap
}

// debridNames name the services in messages.
var debridNames = map[string]string{
	ClientTorBox:     "TorBox",
	ClientRealDebrid: "Real-Debrid",
	ClientAllDebrid:  "AllDebrid",
	ClientPremiumize: "Premiumize",
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
		DebridKeys:  []string{},
	}

	for _, kind := range debridKinds {
		key, err := s.secrets.Get(kind)
		if err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "read the %s key", debridNames[kind])
		}
		if key != "" {
			settings.DebridKeys = append(settings.DebridKeys, kind)
		}
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

	switch {
	case update.Client == ClientNone, update.Client == ClientEmbedded:
	case update.Client == ClientQBittorrent:
		if update.URL == "" {
			return nil, apperr.Invalid("url", "the qBittorrent address is empty")
		}
	case IsDebrid(update.Client):
		if err := s.requireDebridKey(update.Client, update.APIKey); err != nil {
			return nil, err
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
	if update.APIKey != nil && IsDebrid(update.Client) {
		if err := s.secrets.Set(update.Client, *update.APIKey); err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "save the %s key", debridNames[update.Client])
		}
	}

	s.signal()
	s.publish("settings", 0)

	return s.Settings(ctx)
}

// requireDebridKey refuses a debrid service this node lacks, or one left
// without a key: a new key given, or one saved before.
func (s *Service) requireDebridKey(kind string, given *string) error {
	if _, ok := s.opts.Debrid[kind]; !ok {
		return apperr.Invalid("client", "this node cannot use %s", debridNames[kind])
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

// TorrentCheckResult is what the client said when the node tried it.
type TorrentCheckResult struct {
	Version string `json:"version"`
}

// Check tries a connection before or after it is saved. An empty password or
// key means the saved one, so the user need not type it again.
func (s *Service) Check(ctx context.Context, conn Connection, keepSecret bool) (*TorrentCheckResult, error) {
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

	if IsDebrid(conn.Kind) {
		return s.checkDebrid(ctx, conn.Kind, conn.APIKey, keepSecret)
	}

	conn.URL = strings.TrimSpace(conn.URL)
	if conn.URL == "" {
		return nil, apperr.Invalid("url", "the qBittorrent address is empty")
	}

	if keepSecret {
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

// checkDebrid tries a debrid service's key, or the saved one when keepKey, and
// names the account.
func (s *Service) checkDebrid(ctx context.Context, kind, key string, keepKey bool) (*TorrentCheckResult, error) {
	service, ok := s.opts.Debrid[kind]
	if !ok || service.Check == nil {
		return nil, apperr.New(apperr.KindUnavailable, "this node cannot use %s", debridNames[kind])
	}

	if keepKey {
		saved, err := s.secrets.Get(kind)
		if err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "read the %s key", debridNames[kind])
		}
		key = saved
	}

	key = strings.TrimSpace(key)
	if key == "" {
		return nil, apperr.Invalid("api_key", "the %s key is empty", debridNames[kind])
	}

	version, err := service.Check(ctx, key)
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

	conn := Connection{Kind: kind, URL: url, Username: username, Password: password}

	if IsDebrid(kind) {
		if conn.APIKey, err = s.secrets.Get(kind); err != nil {
			return Connection{}, apperr.Wrap(err, apperr.KindInternal, "read the %s key", debridNames[kind])
		}
	}

	return conn, nil
}

// currentClient is the client for the saved connection, or nil when there is
// none.
func (s *Service) currentClient(ctx context.Context) (Client, error) {
	conn, err := s.connection(ctx)
	if err != nil {
		return nil, err
	}

	switch {
	case conn.Kind == ClientEmbedded:
		if s.opts.Embedded == nil {
			return nil, apperr.New(apperr.KindUnavailable, "this node has no built-in torrent client")
		}
		return s.opts.Embedded, nil
	case IsDebrid(conn.Kind):
		service, ok := s.opts.Debrid[conn.Kind]
		if !ok {
			return nil, apperr.New(apperr.KindUnavailable, "this node cannot use %s", debridNames[conn.Kind])
		}
		if conn.APIKey == "" {
			return nil, nil
		}
		return service.Client, nil
	case conn.Kind == ClientQBittorrent:
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
