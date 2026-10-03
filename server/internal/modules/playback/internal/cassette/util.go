// Adapted from Seanime (github.com/5rahim/seanime, internal/mediastream/cassette),
// GPL-3.0.
package cassette

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"time"

	"github.com/rs/zerolog"
)

// ParseSegment extracts the segment number from a filename like "segment-42.ts"
func ParseSegment(segment string) (int32, error) {
	var ret int32
	_, err := fmt.Sscanf(segment, "segment-%d.ts", &ret)
	if err != nil {
		return 0, errors.New("cassette: could not parse segment name")
	}
	return ret, nil
}

// getSavedInfo deserializes a json file the cassette wrote under its stream dir.
func getSavedInfo[T any](savePath string, target *T) error {
	data, err := os.ReadFile(savePath) //nolint:gosec // a path under the node's own stream dir
	if err != nil {
		return err
	}
	return json.Unmarshal(data, target)
}

// saveInfo serializes the value to json and stores it on disk
func saveInfo[T any](savePath string, value *T) error {
	data, err := json.Marshal(*value)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(savePath), 0o750); err != nil {
		return err
	}
	return os.WriteFile(savePath, data, 0o600)
}

// printExecTime logs elapsed time for an operation
func printExecTime(logger *zerolog.Logger, message string, args ...any) func() {
	msg := fmt.Sprintf(message, args...)
	start := time.Now()
	logger.Trace().Msgf("cassette: Running %s", msg)
	return func() {
		logger.Trace().Msgf("cassette: %s finished in %s", msg, time.Since(start))
	}
}

// GetEnvOr returns the environment variable value or default
func GetEnvOr(env, def string) string {
	if v := os.Getenv(env); v != "" {
		return v
	}
	return def
}

// closestEven rounds n up to the nearest even number
func closestEven(n int32) int32 {
	if n%2 != 0 {
		return n + 1
	}
	return n
}

// len32 converts a length to the int32 that segment numbers use. A file with
// more than two billion keyframes is not one anyone plays.
func len32(n int) int32 {
	if n > math.MaxInt32 {
		return math.MaxInt32
	}
	return int32(n) //nolint:gosec // bounded above
}

// clamp32 converts a stream dimension reported by ffprobe.
func clamp32(n uint32) int32 {
	if n > math.MaxInt32 {
		return math.MaxInt32
	}
	return int32(n) //nolint:gosec // bounded above
}

// abs32 returns the absolute value of an int32
func abs32(x int32) int32 {
	if x < 0 {
		return -x
	}
	return x
}
