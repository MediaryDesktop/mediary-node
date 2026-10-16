package cassette

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/playback/internal/videofile"
)

// The test binary stands in for an ffmpeg that crashes on every file, as the
// real one does when seeking in some old AVIs with AC3 audio.
const crashingFFmpegEnv = "CASSETTE_CRASHING_FFMPEG"

func TestMain(m *testing.M) {
	if os.Getenv(crashingFFmpegEnv) == "1" {
		os.Exit(1)
	}

	os.Exit(m.Run())
}

// A segment ffmpeg crashed on used to be waited for until the request timed
// out, and asked for again, forever: the player buffered instead of offering mpv.
func TestCrashingEncoderFailsSegmentsFast(t *testing.T) {
	ffmpeg, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg is not on PATH")
	}
	ffprobe, err := exec.LookPath("ffprobe")
	if err != nil {
		t.Skip("ffprobe is not on PATH")
	}

	dir := t.TempDir()
	path := filepath.Join(dir, "sample.mkv")

	out, err := exec.CommandContext(t.Context(), ffmpeg, "-v", "error",
		"-f", "lavfi", "-i", "testsrc=size=320x240:rate=24:duration=6",
		"-c:v", "libx264", "-pix_fmt", "yuv420p10le", "-g", "48", path).CombinedOutput()
	if err != nil {
		t.Skipf("ffmpeg cannot make a sample here: %v %s", err, out)
	}

	info, err := videofile.Prober{}.Info(t.Context(), path)
	if err != nil {
		t.Fatalf("probe: %v", err)
	}

	self, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv(crashingFFmpegEnv, "1")

	logger := zerolog.Nop()
	c, err := New(&NewCassetteOptions{Logger: &logger, TempOutDir: filepath.Join(dir, "out"), FfmpegPath: self, FfprobePath: ffprobe})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(c.Destroy)

	if _, err = c.GetMaster(path, "sample", info, "desktop", "t"); err != nil {
		t.Fatalf("master: %v", err)
	}

	for attempt := 1; attempt <= maxEncoderFailures+1; attempt++ {
		ctx, cancel := context.WithTimeout(t.Context(), 20*time.Second)
		started := time.Now()

		_, err := c.GetVideoSegment(ctx, path, "sample", info, Original, 0, "desktop")
		cancel()

		if !errors.Is(err, ErrEncoderFailed) {
			t.Fatalf("attempt %d: err = %v, want the encoder's failure", attempt, err)
		}
		if waited := time.Since(started); waited > 10*time.Second {
			t.Fatalf("attempt %d waited %s for a segment that could not come", attempt, waited)
		}
	}
}
