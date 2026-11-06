package videofile

import (
	"context"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/childenv"
)

const (
	thumbnailTimeout = 30 * time.Second
	thumbnailWidth   = 640

	// The frame is taken from this stretch of the file: past the opening, short of
	// the ending and the next-episode preview, where a still most likely shows the
	// episode itself.
	thumbnailFrom = 0.2
	thumbnailTo   = 0.65

	// A page of episodes asks for every frame at once. Each one is a seek and a
	// decode, cheap alone and enough to stall the player when a whole season
	// runs them in parallel.
	thumbnailConcurrency = 2
)

// Thumbnailer cuts one still out of a video file with ffmpeg and keeps it for as
// long as the file stays the same. It stands in for an episode image when no
// source has one.
type Thumbnailer struct {
	FFmpeg   Locate
	CacheDir string

	once  sync.Once
	slots chan struct{}

	mu    sync.Mutex
	locks map[string]*sync.Mutex
}

// Thumbnail returns the path of a JPEG still from the file. duration is how long
// the file runs, in seconds; zero means unknown, and the still then comes from
// early in the file rather than not at all.
func (t *Thumbnailer) Thumbnail(ctx context.Context, path string, duration float64) (string, error) {
	stat, err := os.Stat(path)
	if err != nil {
		return "", err
	}

	key := cacheKey(path, stat)
	out := filepath.Join(t.CacheDir, key+".jpg")

	lock := t.lockFor(key)
	lock.Lock()
	defer lock.Unlock()

	if _, err := os.Stat(out); err == nil {
		return out, nil
	}

	if err := t.acquire(ctx); err != nil {
		return "", err
	}
	defer t.release()

	if err := os.MkdirAll(t.CacheDir, 0o700); err != nil {
		return "", err
	}

	// ffmpeg writes beside the final name and the result is renamed into place, so
	// a cut interrupted halfway is never served as a finished still.
	partial := out + ".part"
	defer func() { _ = os.Remove(partial) }()

	if err := t.run(ctx, path, framePosition(key, duration), partial); err != nil {
		return "", err
	}

	return out, os.Rename(partial, out)
}

// framePosition picks a moment that looks random across a season, so neighbouring
// episodes do not all show the same beat, but stays the same for one file: the
// still must not change every time the page is opened.
func framePosition(key string, duration float64) float64 {
	if duration <= 0 {
		return 90
	}

	raw, err := hex.DecodeString(key[:16])
	if err != nil {
		return duration * thumbnailFrom
	}

	fraction := float64(binary.BigEndian.Uint64(raw)%10_000) / 10_000

	return duration * (thumbnailFrom + fraction*(thumbnailTo-thumbnailFrom))
}

func (t *Thumbnailer) run(ctx context.Context, path string, position float64, out string) error {
	ctx, cancel := context.WithTimeout(ctx, thumbnailTimeout)
	defer cancel()

	ffmpeg, err := t.FFmpeg.path("ffmpeg")
	if err != nil {
		return err
	}

	args := []string{
		"-v", "error", "-y",
		// Before -i the seek jumps to the nearest keyframe instead of decoding
		// everything up to it, which is the difference between milliseconds and
		// seconds on a long file.
		"-ss", strconv.FormatFloat(position, 'f', 3, 64),
		"-i", path,
		// Capital V leaves out cover art, which some containers store as a video
		// stream ahead of the real one.
		"-map", "0:V:0",
		"-frames:v", "1",
		"-vf", fmt.Sprintf("scale=%d:-2", thumbnailWidth),
		"-pix_fmt", "yuvj420p",
		"-q:v", "4",
		"-f", "image2",
		out,
	}

	cmd := exec.CommandContext(ctx, ffmpeg, args...) //nolint:gosec // the configured ffmpeg, arguments built here
	HideWindow(cmd)
	childenv.Apply(cmd)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("cut a still from %s: %w: %s", path, err, strings.TrimSpace(string(output)))
	}

	// A seek past the last keyframe makes ffmpeg exit cleanly with nothing written.
	if stat, err := os.Stat(out); err != nil || stat.Size() == 0 {
		return fmt.Errorf("cut a still from %s: ffmpeg produced no frame", path)
	}

	return nil
}

func (t *Thumbnailer) acquire(ctx context.Context) error {
	t.once.Do(func() { t.slots = make(chan struct{}, thumbnailConcurrency) })

	select {
	case t.slots <- struct{}{}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (t *Thumbnailer) release() {
	<-t.slots
}

func (t *Thumbnailer) lockFor(key string) *sync.Mutex {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.locks == nil {
		t.locks = map[string]*sync.Mutex{}
	}

	lock, ok := t.locks[key]
	if !ok {
		lock = &sync.Mutex{}
		t.locks[key] = lock
	}

	return lock
}
