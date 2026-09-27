package prober_test

import (
	"encoding/binary"
	"math"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/prober"
)

const episode = 1437 * time.Second

func TestDurationReadsISOMovieHeader(t *testing.T) {
	t.Parallel()

	mvhd := append([]byte{0, 0, 0, 0}, make([]byte, 16)...)
	binary.BigEndian.PutUint32(mvhd[12:16], 1000)
	binary.BigEndian.PutUint32(mvhd[16:20], 1_437_000)

	file := concat(
		isoBox("ftyp", []byte("isom\x00\x00\x02\x00")),
		isoBox("moov", isoBox("mvhd", mvhd)),

		// The payload comes after the header in a streamable file, and walking
		// past it must cost nothing but a seek.
		isoBox("mdat", make([]byte, 4096)),
	)

	if got, ok := prober.Duration(write(t, "episode.mp4", file)); !ok || got != episode {
		t.Fatalf("mp4 duration = %v, %v; want %v, true", got, ok, episode)
	}
}

func TestDurationReadsISOVersionOneHeader(t *testing.T) {
	t.Parallel()

	mvhd := append([]byte{1, 0, 0, 0}, make([]byte, 28)...)
	binary.BigEndian.PutUint32(mvhd[20:24], 90_000)
	binary.BigEndian.PutUint64(mvhd[24:32], 1437*90_000)

	file := concat(isoBox("ftyp", []byte("qt  ")), isoBox("moov", isoBox("mvhd", mvhd)))

	if got, ok := prober.Duration(write(t, "episode.mov", file)); !ok || got != episode {
		t.Fatalf("mov duration = %v, %v; want %v, true", got, ok, episode)
	}
}

func TestDurationReadsMatroskaSegmentInfo(t *testing.T) {
	t.Parallel()

	ticks := make([]byte, 8)
	binary.BigEndian.PutUint64(ticks, math.Float64bits(1_437_000))

	// A tick of one millisecond, as almost every muxer writes it.
	info := concat(
		ebml(0x2AD7B1, []byte{0x0F, 0x42, 0x40}),
		ebml(0x4489, ticks),
	)

	file := concat(
		ebml(0x1A45DFA3, []byte{0x42, 0x86, 0x81, 0x01}),
		ebml(0x18538067, concat(
			ebml(0x1549A966, info),

			// Clusters follow Info and must be skipped by their size alone.
			ebml(0x1F43B675, make([]byte, 2048)),
		)),
	)

	if got, ok := prober.Duration(write(t, "episode.mkv", file)); !ok || got != episode {
		t.Fatalf("mkv duration = %v, %v; want %v, true", got, ok, episode)
	}
}

func TestDurationSaysNothingForWhatItCannotRead(t *testing.T) {
	t.Parallel()

	cases := map[string][]byte{
		"episode.avi":  []byte("RIFF....AVI LIST"),
		"episode.mp4":  isoBox("ftyp", []byte("isom")),
		"episode.mkv":  ebml(0x1A45DFA3, []byte{0x42, 0x86, 0x81, 0x01}),
		"episode.part": {0, 1, 2, 3},
	}

	for name, content := range cases {
		if _, ok := prober.Duration(write(t, name, content)); ok {
			t.Fatalf("%s: a file with no readable duration must not report one", name)
		}
	}
}

func TestDurationSaysNothingForAMissingFile(t *testing.T) {
	t.Parallel()

	if _, ok := prober.Duration(filepath.Join(t.TempDir(), "gone.mkv")); ok {
		t.Fatal("a file that is not there has no duration")
	}
}

func TestSupportedFollowsTheContainerNotTheName(t *testing.T) {
	t.Parallel()

	for _, path := range []string{"a.MKV", "b.mp4", "c.mov"} {
		if !prober.Supported(path) {
			t.Fatalf("%s should be probed", path)
		}
	}

	for _, path := range []string{"a.avi", "b.ts", "c.cbz"} {
		if prober.Supported(path) {
			t.Fatalf("%s cannot be probed and should not be opened", path)
		}
	}
}

func write(t *testing.T, name string, content []byte) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(path, content, 0o600); err != nil {
		t.Fatalf("write %s: %v", name, err)
	}

	return path
}

func concat(parts ...[]byte) []byte {
	joined := []byte{}
	for _, part := range parts {
		joined = append(joined, part...)
	}

	return joined
}

func isoBox(kind string, body []byte) []byte {
	box := make([]byte, 8, 8+len(body))
	binary.BigEndian.PutUint32(box[:4], uint32(len(body)+8))
	copy(box[4:8], kind)

	return append(box, body...)
}

// ebml writes an element with its id as the spec spells it and a four-byte size,
// which is always legal and keeps the helper from having to choose a width.
func ebml(id uint32, body []byte) []byte {
	element := []byte{}

	for _, shift := range []uint{24, 16, 8, 0} {
		part := byte(id >> shift)
		if len(element) == 0 && part == 0 {
			continue
		}

		element = append(element, part)
	}

	size := make([]byte, 4)
	binary.BigEndian.PutUint32(size, uint32(len(body)))
	size[0] |= 0x10

	return append(append(element, size...), body...)
}
