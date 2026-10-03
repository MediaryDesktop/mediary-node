// Adapted from Seanime (github.com/5rahim/seanime, internal/mediastream/videofile),
// GPL-3.0.
package videofile

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const extractTimeout = 2 * time.Minute

// Extractor pulls a file's subtitle tracks and attached fonts out with ffmpeg,
// once per file version. Matroska keeps subtitles interleaved through the whole
// file, so one pass for every track costs the same as one pass for one track.
type Extractor struct {
	FFmpegPath string
	CacheDir   string

	mu    sync.Mutex
	locks map[string]*sync.Mutex
}

// Extracted is where one file's tracks landed.
type Extracted struct {
	dir string
}

// Subtitle is the track as ASS, whatever it was in the file: the renderer only
// speaks ASS, and ffmpeg converts SubRip and WebVTT on the way out.
func (e Extracted) Subtitle(index uint32) string {
	return filepath.Join(e.dir, "subs", fmt.Sprintf("%d.ass", index))
}

func (e Extracted) Font(font Font) string {
	return filepath.Join(e.dir, "fonts", fontFileName(font))
}

func (x *Extractor) Extract(ctx context.Context, path string, info *MediaInfo) (Extracted, error) {
	stat, err := os.Stat(path)
	if err != nil {
		return Extracted{}, err
	}

	key := cacheKey(path, stat)
	out := Extracted{dir: filepath.Join(x.CacheDir, key)}
	done := filepath.Join(out.dir, "done")

	lock := x.lockFor(key)
	lock.Lock()
	defer lock.Unlock()

	if _, err := os.Stat(done); err == nil {
		return out, nil
	}

	if len(info.Subtitles) > 0 {
		if err := x.run(ctx, path, info, out); err != nil {
			// A half-written directory must not be mistaken for a finished one.
			_ = os.RemoveAll(out.dir)

			return Extracted{}, err
		}
	}

	if err := os.MkdirAll(out.dir, 0o700); err != nil {
		return Extracted{}, err
	}

	return out, os.WriteFile(done, nil, 0o600)
}

func (x *Extractor) run(ctx context.Context, path string, info *MediaInfo, out Extracted) error {
	for _, dir := range []string{"subs", "fonts"} {
		if err := os.MkdirAll(filepath.Join(out.dir, dir), 0o700); err != nil {
			return err
		}
	}

	args := []string{"-v", "error", "-y"}

	// Each font is written under a name the node chooses. "-dump_attachment:t ''"
	// would use the name stored in the file, and a crafted file could name a path
	// outside the cache.
	for _, font := range info.Fonts {
		args = append(args, fmt.Sprintf("-dump_attachment:t:%d", font.Index), out.Font(font))
	}

	args = append(args, "-i", path)

	for _, sub := range info.Subtitles {
		codec := "ass"
		if sub.Codec == "ass" || sub.Codec == "ssa" {
			codec = "copy"
		}

		args = append(args, "-map", fmt.Sprintf("0:s:%d", sub.Index), "-c:s", codec, out.Subtitle(sub.Index))
	}

	ctx, cancel := context.WithTimeout(ctx, extractTimeout)
	defer cancel()

	binary := x.FFmpegPath
	if binary == "" {
		binary = "ffmpeg"
	}

	cmd := exec.CommandContext(ctx, binary, args...) //nolint:gosec // the configured ffmpeg, arguments built here
	HideWindow(cmd)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("extract subtitles from %s: %w: %s", path, err, strings.TrimSpace(string(output)))
	}

	return nil
}

func (x *Extractor) lockFor(key string) *sync.Mutex {
	x.mu.Lock()
	defer x.mu.Unlock()

	if x.locks == nil {
		x.locks = map[string]*sync.Mutex{}
	}

	lock, ok := x.locks[key]
	if !ok {
		lock = &sync.Mutex{}
		x.locks[key] = lock
	}

	return lock
}

func fontFileName(font Font) string {
	ext := strings.ToLower(filepath.Ext(font.Name))

	switch ext {
	case ".ttf", ".otf", ".ttc", ".woff", ".woff2":
	default:
		ext = ".ttf"
	}

	return fmt.Sprintf("%d%s", font.Index, ext)
}
