// Adapted from Seanime (github.com/5rahim/seanime, internal/mediastream/cassette),
// GPL-3.0.
package cassette

import (
	"bufio"
	"fmt"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/playback/internal/videofile"
)

// KeyframeIndex holds extracted keyframe timestamps
type KeyframeIndex struct {
	Sha       string    `json:"sha"`
	Keyframes []float64 `json:"keyframes"`
	IsDone    bool      `json:"isDone"`

	mu        sync.RWMutex
	ready     sync.WaitGroup
	readyOnce sync.Once
	err       error
	listeners []func(keyframes []float64)
}

// markReady releases everyone waiting for the first keyframes. It runs at most
// once, and must run even when extraction fails, or every request for this file
// would wait forever.
func (ki *KeyframeIndex) markReady() {
	ki.readyOnce.Do(ki.ready.Done)
}

// Get returns the keyframe timestamp
func (ki *KeyframeIndex) Get(idx int32) float64 {
	ki.mu.RLock()
	defer ki.mu.RUnlock()
	return ki.Keyframes[idx]
}

// Slice returns a copy of keyframe timestamps
func (ki *KeyframeIndex) Slice(start, end int32) []float64 {
	if end <= start {
		return nil
	}
	ki.mu.RLock()
	defer ki.mu.RUnlock()
	out := make([]float64, end-start)
	copy(out, ki.Keyframes[start:end])
	return out
}

// Length returns number of keyframes and status
func (ki *KeyframeIndex) Length() (int32, bool) {
	ki.mu.RLock()
	defer ki.mu.RUnlock()
	return len32(len(ki.Keyframes)), ki.IsDone
}

// AddListener registers a callback for new keyframes
func (ki *KeyframeIndex) AddListener(fn func([]float64)) {
	ki.mu.Lock()
	defer ki.mu.Unlock()
	ki.listeners = append(ki.listeners, fn)
}

func (ki *KeyframeIndex) append(values []float64) {
	ki.mu.Lock()
	defer ki.mu.Unlock()
	ki.Keyframes = append(ki.Keyframes, values...)
	for _, fn := range ki.listeners {
		fn(ki.Keyframes)
	}
}

// global keyframe cache

var (
	kfCacheMu sync.Mutex
	kfCache   = map[string]*KeyframeIndex{}
)

// ClearKeyframeCache removes cached indexes
func ClearKeyframeCache() {
	kfCacheMu.Lock()
	kfCache = map[string]*KeyframeIndex{}
	kfCacheMu.Unlock()
}

// getOrExtractKeyframes returns a keyframe index, extracting it on first use.
// A failed extraction is not cached, so the next request tries again.
func getOrExtractKeyframes(
	path string,
	hash string,
	duration float64,
	settings *Settings,
	logger *zerolog.Logger,
) (*KeyframeIndex, error) {
	kfCacheMu.Lock()
	if ki, ok := kfCache[hash]; ok {
		kfCacheMu.Unlock()
		ki.ready.Wait()
		return ki, ki.err
	}

	ki := &KeyframeIndex{Sha: hash}
	ki.ready.Add(1)
	kfCache[hash] = ki
	kfCacheMu.Unlock()

	go func() {
		diskPath := filepath.Join(settings.StreamDir, hash, "keyframes.json")

		if err := getSavedInfo(diskPath, ki); err == nil {
			logger.Trace().Msg("cassette: keyframes disk cache HIT")
			ki.markReady()
			return
		}

		if err := extractKeyframes(settings.FfprobePath, path, duration, ki, logger); err != nil {
			logger.Error().Err(err).Str("path", path).Msg("cassette: keyframe extraction failed")
			ki.mu.Lock()
			ki.err = err
			ki.mu.Unlock()
			kfCacheMu.Lock()
			if kfCache[hash] == ki {
				delete(kfCache, hash)
			}
			kfCacheMu.Unlock()
			ki.markReady()
			return
		}

		_ = saveInfo(diskPath, ki)
	}()

	ki.ready.Wait()
	return ki, ki.err
}

// extractKeyframes reads keyframe times off the first video stream, publishing
// them in batches so the first segments can be served before the scan ends.
func extractKeyframes(
	ffprobePath string,
	path string,
	duration float64,
	ki *KeyframeIndex,
	logger *zerolog.Logger,
) error {
	defer printExecTime(logger, "ffprobe keyframe analysis for %s", path)()

	probeBin := ffprobePath
	if probeBin == "" {
		probeBin = "ffprobe"
	}

	cmd := exec.Command( //nolint:gosec,noctx // the configured ffprobe; ends when its output does
		probeBin,
		"-loglevel", "error",
		"-select_streams", "v:0",
		"-show_entries", "packet=pts_time,flags",
		"-of", "csv=print_section=0",
		path,
	)
	videofile.HideWindow(cmd)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	defer func() { _ = cmd.Wait() }()

	scanner := bufio.NewScanner(stdout)
	buf := make([]float64, 0, 1000)
	batchSize := 100
	flushed := int32(0)

	flush := func() {
		if len(buf) == 0 {
			return
		}
		ki.append(buf)
		flushed += len32(len(buf))
		ki.markReady()
		buf = buf[:0]
		// Past the first few hundred, bigger batches keep listener overhead down
		// on long files.
		if flushed >= 500 {
			batchSize = 500
		}
	}

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, ",", 2)
		if len(parts) < 2 {
			continue
		}
		pts, flags := parts[0], parts[1]
		if pts == "N/A" {
			break
		}
		if flags == "" || flags[0] != 'K' {
			continue
		}
		fpts, err := strconv.ParseFloat(pts, 64)
		if err != nil {
			return err
		}
		buf = append(buf, fpts)
		if len(buf) >= batchSize {
			flush()
		}
	}

	// A file with one keyframe or none still has to be cut somewhere.
	if flushed == 0 && len(buf) < 2 {
		if duration <= 0 {
			return fmt.Errorf("no keyframes and no duration in %s", path)
		}
		buf = dummyKeyframes(duration)
	}

	flush()
	ki.mu.Lock()
	ki.IsDone = true
	ki.mu.Unlock()
	return nil
}

// dummyKeyframes cuts every two seconds.
func dummyKeyframes(duration float64) []float64 {
	const interval = 2.0
	out := make([]float64, int(duration/interval)+1)
	for i := range out {
		out[i] = float64(i) * interval
	}
	return out
}
