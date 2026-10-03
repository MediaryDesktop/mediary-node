package videofile

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// cacheVersion is part of every cache key, so a change to what probe extracts
// retires every entry written before it instead of serving stale info.
const cacheVersion = 2

const probeTimeout = 40 * time.Second

// Prober reads a file's streams with ffprobe once per version of the file.
// Probing a large mkv takes long enough to notice, and the answer only changes
// when the file does.
type Prober struct {
	FFprobePath string

	// CacheDir holds one JSON file per probed file version. Empty disables the
	// cache.
	CacheDir string
}

func (p Prober) Info(ctx context.Context, path string) (*MediaInfo, error) {
	stat, err := os.Stat(path)
	if err != nil {
		return nil, err
	}

	cachePath := ""
	if p.CacheDir != "" {
		cachePath = filepath.Join(p.CacheDir, cacheKey(path, stat)+".json")

		if info, ok := readCached(cachePath); ok {
			return info, nil
		}
	}

	ctx, cancel := context.WithTimeout(ctx, probeTimeout)
	defer cancel()

	info, err := probe(ctx, p.FFprobePath, path)
	if err != nil {
		return nil, fmt.Errorf("probe %s: %w", path, err)
	}

	if cachePath != "" {
		// A cache that cannot be written only costs the next probe.
		_ = writeCached(cachePath, info)
	}

	return info, nil
}

func cacheKey(path string, stat os.FileInfo) string {
	sum := sha256.Sum256(fmt.Appendf(nil, "%d:%s:%d:%d", cacheVersion, path, stat.ModTime().UnixNano(), stat.Size()))

	return hex.EncodeToString(sum[:20])
}

func readCached(path string) (*MediaInfo, bool) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, false
	}

	var info MediaInfo
	if json.Unmarshal(raw, &info) != nil {
		return nil, false
	}

	return &info, true
}

func writeCached(path string, info *MediaInfo) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}

	raw, err := json.Marshal(info)
	if err != nil {
		return err
	}

	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}

	return os.Rename(tmp, path)
}
