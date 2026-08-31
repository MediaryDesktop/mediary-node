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

	HTTP     HTTP
	Library  Library
	Torrent  Torrent
	Playback Playback
	Cloud    Cloud
	Log      Log
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
}

func (h HTTP) Addr() string {
	return fmt.Sprintf("%s:%d", h.Host, h.Port)
}

type Library struct {
	Paths []string `env:"NODE_LIBRARY_PATHS" envSeparator:"|"`

	ScanInterval time.Duration `env:"NODE_LIBRARY_SCAN_INTERVAL" envDefault:"1h"`

	FollowSymlinks bool `env:"NODE_LIBRARY_FOLLOW_SYMLINKS" envDefault:"false"`
}

type Torrent struct {
	Client       string `env:"NODE_TORRENT_CLIENT" envDefault:"embedded"`
	DownloadDir  string `env:"NODE_TORRENT_DOWNLOAD_DIR"`
	ListenPort   int    `env:"NODE_TORRENT_LISTEN_PORT" envDefault:"0"`
	MaxDownloads int    `env:"NODE_TORRENT_MAX_DOWNLOADS" envDefault:"3"`

	EnableUPnP bool `env:"NODE_TORRENT_ENABLE_UPNP" envDefault:"false"`

	ExternalURL      string `env:"NODE_TORRENT_EXTERNAL_URL"`
	ExternalUser     string `env:"NODE_TORRENT_EXTERNAL_USER"`
	ExternalPassword string `env:"NODE_TORRENT_EXTERNAL_PASSWORD"`
}

type Playback struct {
	MPVPath    string `env:"NODE_MPV_PATH"`
	FFmpegPath string `env:"NODE_FFMPEG_PATH"`

	TranscodeDir string `env:"NODE_TRANSCODE_DIR"`

	EnableTranscoding bool `env:"NODE_ENABLE_TRANSCODING" envDefault:"false"`
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
	case "embedded":
	case "qbittorrent":
		if c.Torrent.ExternalURL == "" {
			return errors.New("NODE_TORRENT_EXTERNAL_URL is required when NODE_TORRENT_CLIENT=qbittorrent")
		}
	default:
		return fmt.Errorf("NODE_TORRENT_CLIENT must be embedded or qbittorrent, got %q", c.Torrent.Client)
	}

	if c.HTTP.Host != "127.0.0.1" && c.HTTP.Host != "localhost" && c.HTTP.Token == "" {
		return fmt.Errorf(
			"NODE_HTTP_HOST is %q (not loopback) but NODE_TOKEN is unset: "+
				"a node reachable from the network must be given an explicit token",
			c.HTTP.Host,
		)
	}

	return nil
}
