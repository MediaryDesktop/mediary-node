// Package prober reads how long a video file runs out of its own container. It
// opens the file, seeks through its headers and never decodes a frame: the whole
// point is that a library of thousands of files can be measured during a scan.
//
// It knows the two container families a desktop library is actually made of —
// Matroska (mkv, webm) and ISO base media (mp4, m4v, mov) — and says "unknown"
// for everything else rather than guessing. A duration nobody can vouch for is
// worse than none: the list would show a confident wrong number.
package prober

import (
	"errors"
	"io"
	"math"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Version is bumped whenever the prober learns to read something it could not
// read before. A scan re-probes files left by an older build, so an improvement
// reaches the existing library without the files having to change.
const Version = 1

// A container that hides its duration behind megabytes of cues or an index at
// the end of the file is not worth chasing: the walk would turn into a read of
// the whole library.
const maxHeaderBytes = 8 << 20

var probes = map[string]func(io.ReadSeeker, int64) (time.Duration, error){
	".mkv":  matroskaDuration,
	".webm": matroskaDuration,
	".mka":  matroskaDuration,

	".mp4": isoDuration,
	".m4v": isoDuration,
	".mov": isoDuration,
	".3gp": isoDuration,
	".3g2": isoDuration,
}

// Supported reports whether the prober can read this kind of file at all, so a
// caller can skip opening the ones it cannot.
func Supported(path string) bool {
	_, ok := probes[strings.ToLower(filepath.Ext(path))]

	return ok
}

// Duration returns how long the file runs. The second result is false when the
// container is one the prober does not read, when the file cannot be opened, or
// when the header carries no duration — all of which are ordinary and none of
// which are worth failing a scan over.
func Duration(path string) (time.Duration, bool) {
	probe, ok := probes[strings.ToLower(filepath.Ext(path))]
	if !ok {
		return 0, false
	}

	// The path is a file the scan found under a root the user themselves added,
	// and the file is opened read-only to look at its first bytes.
	file, err := os.Open(path) //nolint:gosec // a library file the user pointed the node at
	if err != nil {
		return 0, false
	}
	defer func() { _ = file.Close() }()

	info, err := file.Stat()
	if err != nil {
		return 0, false
	}

	duration, err := probe(file, info.Size())
	if err != nil || duration <= 0 {
		return 0, false
	}

	return duration, true
}

var errNotFound = errors.New("no duration in header")

// signed caps a length a header claims at what a file offset can hold. A header
// that says an element is nine exabytes long is one this prober gives up on
// rather than wraps around on.
func signed(length uint64) int64 {
	if length > math.MaxInt64 {
		return math.MaxInt64
	}

	return int64(length)
}
