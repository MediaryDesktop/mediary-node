package service

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/qbittorrent"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/torznab"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
	"github.com/mediaryorg/mediary-node/server/internal/platform/secrets"
)

// Client is the user's torrent client as the node uses it.
type Client interface {
	Version(ctx context.Context) (string, error)
	Add(ctx context.Context, req qbittorrent.AddRequest) error
	Torrents(ctx context.Context, hashes []string) ([]qbittorrent.Torrent, error)
	Files(ctx context.Context, hash string) ([]qbittorrent.File, error)
	SetFilePriority(ctx context.Context, hash string, indices []int, priority int) error
	Pause(ctx context.Context, hash string) error
	Resume(ctx context.Context, hash string) error
	Delete(ctx context.Context, hash string, withFiles bool) error
}

// Library is the library module, through a port: where its folders are, and how a
// downloaded file joins it.
type Library interface {
	RootPath(ctx context.Context, rootID int64) (path string, found bool, err error)
	ImportFile(ctx context.Context, rootID int64, relPath, mediaRef string, episode *int) (int64, error)
	// NameEpisode reads a file's path the way the library would: whether it keeps
	// it as a video, and the episode its name gives.
	NameEpisode(relPath string) (video bool, episode *int)
	// Episodes are the episodes of a title the library has on disk.
	Episodes(ctx context.Context, mediaRef string) ([]int, error)
}

// Client kinds: the user's qBittorrent, the node's own client, or none.
const (
	ClientNone        = ""
	ClientQBittorrent = "qbittorrent"
	ClientEmbedded    = "embedded"
)

// Connection is which client to use and, for qBittorrent, how to reach it.
type Connection struct {
	Kind     string
	URL      string
	Username string
	Password string
}

type Options struct {
	// Defaults is the connection from the node's environment, used until the user
	// saves one; a headless node is set up this way.
	Defaults Connection

	// NewClient builds a qBittorrent client for a connection; tests swap it.
	NewClient func(Connection) (Client, error)

	// Embedded is the node's own client, used when the user picks it; nil where
	// it is not available.
	Embedded Client

	// Torznab searches the user's sources; Titles names the title searched for.
	Torznab *torznab.Client
	Titles  Titles

	// How often the client is asked about torrents while one is downloading, and
	// while none is.
	ActiveInterval time.Duration
	IdleInterval   time.Duration
	// How often the auto-download rules look for new episodes.
	RuleInterval time.Duration

	Now func() time.Time
}

type Service struct {
	store   *store.Store
	secrets *secrets.Store
	library Library
	hub     *events.Hub
	logger  zerolog.Logger
	opts    Options

	wake chan struct{}

	mu sync.Mutex
	// The client for the saved connection; rebuilt when the connection changes.
	client     Client
	clientConn Connection
	// What the client last said about each torrent, by hash.
	live map[string]qbittorrent.Torrent
	// Why the client could not be asked last time; "" when it answered.
	clientError string
	polled      bool
	// How many polls in a row a torrent was missing from the client, by hash.
	missing map[string]int

	search searchCache
}

func New(st *store.Store, secretFile *secrets.Store, library Library, hub *events.Hub, logger zerolog.Logger, opts Options) *Service {
	if opts.NewClient == nil {
		opts.NewClient = func(conn Connection) (Client, error) {
			return qbittorrent.New(qbittorrent.Options{URL: conn.URL, Username: conn.Username, Password: conn.Password})
		}
	}
	if opts.ActiveInterval <= 0 {
		opts.ActiveInterval = 2 * time.Second
	}
	if opts.IdleInterval <= 0 {
		opts.IdleInterval = 30 * time.Second
	}
	if opts.RuleInterval <= 0 {
		opts.RuleInterval = defaultRuleInterval
	}
	if opts.Now == nil {
		opts.Now = time.Now
	}
	if opts.Torznab == nil {
		opts.Torznab = torznab.New(20*time.Second, "mediary-node")
	}

	return &Service{
		store:   st,
		secrets: secretFile,
		library: library,
		hub:     hub,
		logger:  logger,
		opts:    opts,
		wake:    make(chan struct{}, 1),
		live:    map[string]qbittorrent.Torrent{},
		missing: map[string]int{},
		search: searchCache{
			answers:  map[string]cachedAnswer{},
			releases: map[string]cachedRelease{},
		},
	}
}

// messageOf is what an error says to a person: an app error's message without
// its kind and the Go error under it.
func messageOf(err error) string {
	var appErr *apperr.Error
	if errors.As(err, &appErr) {
		return appErr.Message
	}

	return err.Error()
}

func (s *Service) signal() {
	select {
	case s.wake <- struct{}{}:
	default:
	}
}

func (s *Service) publish(reason string, id int64) {
	if s.hub == nil {
		return
	}

	payload := map[string]any{"reason": reason}
	if id != 0 {
		payload["id"] = id
	}

	s.hub.Publish(events.TopicTorrent, payload)
}
