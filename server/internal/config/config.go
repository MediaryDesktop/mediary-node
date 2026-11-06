package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/caarlos0/env/v11"
)

const (
	EnvDevelopment = "development"
	EnvProduction  = "production"
)

const DefaultPort = 43711

type Config struct {
	Env string `env:"NODE_ENV" envDefault:"development"`

	DataDir string `env:"NODE_DATA_DIR"`

	HTTP        HTTP
	Library     Library
	Torrent     Torrent
	Playback    Playback
	Cloud       Cloud
	AniList     AniList
	AniZip      AniZip
	TMDB        TMDB
	OpenLibrary OpenLibrary
	GoogleBooks GoogleBooks
	Claude      Claude
	AI          AI
	ImageSearch ImageSearch
	Log         Log
}

// ImageSearch finds posters for titles added by hand on Wikimedia Commons,
// which needs no key. An empty endpoint turns it off.
type ImageSearch struct {
	WikimediaEndpoint string        `env:"NODE_WIKIMEDIA_ENDPOINT"   envDefault:"https://commons.wikimedia.org/w/api.php"`
	Timeout           time.Duration `env:"NODE_IMAGE_SEARCH_TIMEOUT" envDefault:"15s"`
}

// Claude fills in the details of a title the user describes by hand. An empty
// endpoint turns it off. There is no key the build ships with: every request is
// paid for, so only the user's own key, saved in the app, is ever sent.
type Claude struct {
	Endpoint string        `env:"NODE_CLAUDE_ENDPOINT" envDefault:"https://api.anthropic.com"`
	Timeout  time.Duration `env:"NODE_CLAUDE_TIMEOUT"  envDefault:"90s"`
}

// AI is everything else that can fill in a title: Gemini and any
// OpenAI-compatible endpoint with the user's own key, and the cloud's free AI
// on its key. The timeout covers all of them; an empty Gemini endpoint turns
// the user's own Gemini off.
type AI struct {
	GeminiEndpoint string        `env:"NODE_GEMINI_ENDPOINT" envDefault:"https://generativelanguage.googleapis.com"`
	Timeout        time.Duration `env:"NODE_AI_TIMEOUT"      envDefault:"90s"`
}

type AniList struct {
	ClientID     string        `env:"NODE_ANILIST_CLIENT_ID"`
	Endpoint     string        `env:"NODE_ANILIST_ENDPOINT"      envDefault:"https://graphql.anilist.co"`
	AuthorizeURL string        `env:"NODE_ANILIST_AUTHORIZE_URL" envDefault:"https://anilist.co/api/v2/oauth/authorize"`
	Timeout      time.Duration `env:"NODE_ANILIST_TIMEOUT"       envDefault:"30s"`

	RefreshInterval time.Duration `env:"NODE_ANILIST_REFRESH_INTERVAL" envDefault:"5m"`
}

type HTTP struct {
	Host            string        `env:"NODE_HTTP_HOST" envDefault:"127.0.0.1"`
	Port            int           `env:"NODE_HTTP_PORT" envDefault:"43711"`
	ReadTimeout     time.Duration `env:"NODE_HTTP_READ_TIMEOUT"     envDefault:"30s"`
	WriteTimeout    time.Duration `env:"NODE_HTTP_WRITE_TIMEOUT"    envDefault:"0s"`
	IdleTimeout     time.Duration `env:"NODE_HTTP_IDLE_TIMEOUT"     envDefault:"120s"`
	ShutdownTimeout time.Duration `env:"NODE_HTTP_SHUTDOWN_TIMEOUT" envDefault:"15s"`

	AllowedOrigins []string `env:"NODE_HTTP_ALLOWED_ORIGINS" envSeparator:"," envDefault:"http://localhost:5173"`

	Token string `env:"NODE_TOKEN"`

	// AllowPlaintext confirms that a node reachable from the network may speak
	// plain HTTP — the token crosses the wire with every request — because a
	// TLS proxy in front of it is the only thing the network sees. Without it a
	// node off loopback refuses to start. Loopback ignores it.
	AllowPlaintext bool `env:"NODE_HTTP_ALLOW_PLAINTEXT" envDefault:"false"`
}

func (h HTTP) Addr() string {
	return fmt.Sprintf("%s:%d", h.Host, h.Port)
}

// Loopback says whether the node listens only on this machine. Only then can
// it know which Host a legitimate request names.
func (h HTTP) Loopback() bool {
	return h.Host == "127.0.0.1" || h.Host == "localhost"
}

// AniZip is the episode-listing source. An empty endpoint turns it off, and the
// episode list falls back on what AniList itself carries.
type AniZip struct {
	Endpoint string        `env:"NODE_ANIZIP_ENDPOINT" envDefault:"https://api.ani.zip"`
	Timeout  time.Duration `env:"NODE_ANIZIP_TIMEOUT"  envDefault:"15s"`
}

// TMDB is the source for movies, series and doramas. An empty endpoint turns it
// off. The key is the one the build ships with; a user's own key, saved in the
// app, takes its place.
type TMDB struct {
	Endpoint string        `env:"NODE_TMDB_ENDPOINT" envDefault:"https://api.themoviedb.org/3"`
	APIKey   string        `env:"NODE_TMDB_API_KEY"`
	Timeout  time.Duration `env:"NODE_TMDB_TIMEOUT"  envDefault:"20s"`
}

// OpenLibrary is the source for books. An empty endpoint turns it off. A contact,
// an e-mail address or a site, goes into the User-Agent and lets the node ask
// three times a second instead of once, as Open Library's terms allow.
type OpenLibrary struct {
	Endpoint string        `env:"NODE_OPENLIBRARY_ENDPOINT" envDefault:"https://openlibrary.org"`
	Contact  string        `env:"NODE_OPENLIBRARY_CONTACT"`
	Timeout  time.Duration `env:"NODE_OPENLIBRARY_TIMEOUT"  envDefault:"20s"`
}

// GoogleBooks is the fallback source for books Open Library does not know. An
// empty endpoint turns it off. Google refuses an anonymous caller, so without a
// key — the build's or the user's own, saved in the app — it is asked nothing.
type GoogleBooks struct {
	Endpoint string        `env:"NODE_GOOGLE_BOOKS_ENDPOINT" envDefault:"https://www.googleapis.com/books/v1"`
	APIKey   string        `env:"NODE_GOOGLE_BOOKS_API_KEY"`
	Timeout  time.Duration `env:"NODE_GOOGLE_BOOKS_TIMEOUT"  envDefault:"20s"`
}

type Library struct {
	Paths []string `env:"NODE_LIBRARY_PATHS" envSeparator:"|"`

	ScanInterval time.Duration `env:"NODE_LIBRARY_SCAN_INTERVAL" envDefault:"1h"`

	FollowSymlinks bool `env:"NODE_LIBRARY_FOLLOW_SYMLINKS" envDefault:"false"`
}

type Torrent struct {
	// Which client to use until the user picks one in the settings. none: no
	// client; embedded: the node's own; qbittorrent: the connection below, for a
	// headless node.
	Client       string `env:"NODE_TORRENT_CLIENT" envDefault:"none"`
	DownloadDir  string `env:"NODE_TORRENT_DOWNLOAD_DIR"`
	ListenPort   int    `env:"NODE_TORRENT_LISTEN_PORT" envDefault:"0"`
	MaxDownloads int    `env:"NODE_TORRENT_MAX_DOWNLOADS" envDefault:"3"`

	EnableUPnP bool `env:"NODE_TORRENT_ENABLE_UPNP" envDefault:"false"`

	ExternalURL      string `env:"NODE_TORRENT_EXTERNAL_URL"`
	ExternalUser     string `env:"NODE_TORRENT_EXTERNAL_USER"`
	ExternalPassword string `env:"NODE_TORRENT_EXTERNAL_PASSWORD"`
}

type Playback struct {
	MPVPath     string `env:"NODE_MPV_PATH"`
	FFmpegPath  string `env:"NODE_FFMPEG_PATH"`
	FFprobePath string `env:"NODE_FFPROBE_PATH"`

	TranscodeDir string `env:"NODE_TRANSCODE_DIR"`

	// On by default: it costs nothing until a file the renderer cannot play
	// directly is opened, and without it such a file only plays in mpv.
	EnableTranscoding bool `env:"NODE_ENABLE_TRANSCODING" envDefault:"true"`

	// cpu, auto, nvidia, qsv, vaapi or videotoolbox. CPU until hardware
	// encoding has proven itself on real libraries.
	TranscodeHWAccel string `env:"NODE_TRANSCODE_HWACCEL" envDefault:"cpu"`
}

type Cloud struct {
	BaseURL string `env:"NODE_CLOUD_URL" envDefault:"http://localhost:8080"`

	DeviceToken string        `env:"NODE_CLOUD_DEVICE_TOKEN"`
	Timeout     time.Duration `env:"NODE_CLOUD_TIMEOUT" envDefault:"20s"`

	SyncInterval time.Duration `env:"NODE_CLOUD_SYNC_INTERVAL" envDefault:"5m"`
}

func (c Cloud) Linked() bool {
	return c.DeviceToken != ""
}

type Log struct {
	Level  string `env:"NODE_LOG_LEVEL"  envDefault:"info"`
	Pretty bool   `env:"NODE_LOG_PRETTY" envDefault:"true"`

	File string `env:"NODE_LOG_FILE"`
}

func Load() (*Config, error) {
	var cfg Config

	if err := env.Parse(&cfg); err != nil {
		return nil, fmt.Errorf("parse environment: %w", err)
	}

	if err := cfg.applyDefaults(); err != nil {
		return nil, err
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return &cfg, nil
}

func (c *Config) DatabasePath() string {
	return filepath.Join(c.DataDir, "node.db")
}

func (c *Config) TokenPath() string {
	return filepath.Join(c.DataDir, "token")
}

func (c *Config) AniListTokenPath() string {
	return filepath.Join(c.DataDir, "anilist-token")
}

func (c *Config) applyDefaults() error {
	if c.DataDir == "" {
		base, err := os.UserConfigDir()
		if err != nil {
			return fmt.Errorf("locate user config dir: %w", err)
		}
		c.DataDir = filepath.Join(base, "Mediary", "node")
	}

	if err := os.MkdirAll(c.DataDir, 0o700); err != nil {
		return fmt.Errorf("create data dir %s: %w", c.DataDir, err)
	}

	if c.Torrent.DownloadDir == "" {
		c.Torrent.DownloadDir = filepath.Join(c.DataDir, "downloads")
	}

	if c.Playback.TranscodeDir == "" {
		c.Playback.TranscodeDir = filepath.Join(c.DataDir, "transcode")
	}

	if c.Log.File == "" {
		c.Log.File = filepath.Join(c.DataDir, "node.log")
	}

	return nil
}

func (c *Config) validate() error {
	switch c.Env {
	case EnvDevelopment, EnvProduction:
	default:
		return fmt.Errorf("NODE_ENV must be development or production, got %q", c.Env)
	}

	if c.HTTP.Port < 1 || c.HTTP.Port > 65535 {
		return fmt.Errorf("NODE_HTTP_PORT out of range: %d", c.HTTP.Port)
	}

	switch c.Torrent.Client {
	case "none", "embedded":
	case "qbittorrent":
		if c.Torrent.ExternalURL == "" {
			return errors.New("NODE_TORRENT_EXTERNAL_URL is required when NODE_TORRENT_CLIENT=qbittorrent")
		}
	default:
		return fmt.Errorf("NODE_TORRENT_CLIENT must be none, qbittorrent or embedded, got %q", c.Torrent.Client)
	}

	if c.AniList.RefreshInterval < time.Minute {
		return fmt.Errorf(
			"NODE_ANILIST_REFRESH_INTERVAL must be at least 1m, got %s: "+
				"the collection is one of the heaviest AniList queries",
			c.AniList.RefreshInterval,
		)
	}

	if !c.HTTP.Loopback() && c.HTTP.Token == "" {
		return fmt.Errorf(
			"NODE_HTTP_HOST is %q (not loopback) but NODE_TOKEN is unset: "+
				"a node reachable from the network must be given an explicit token",
			c.HTTP.Host,
		)
	}

	if !c.HTTP.Loopback() && !c.HTTP.AllowPlaintext {
		return fmt.Errorf(
			"NODE_HTTP_HOST is %q (reachable from the network) but the node speaks plain HTTP: "+
				"the token would cross the network in clear text. Put a TLS proxy in front of it "+
				"(mediary-node README, \"Headless\") and set NODE_HTTP_ALLOW_PLAINTEXT=true to "+
				"confirm the plain HTTP stays between the proxy and the node",
			c.HTTP.Host,
		)
	}

	return nil
}
