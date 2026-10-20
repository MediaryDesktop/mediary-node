package videofile

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestFramePositionIsStableAndInsideTheEpisode(t *testing.T) {
	const duration = 1440

	keys := []string{
		"00000000000000000000000000000000000000ff",
		"ffffffffffffffffffffffffffffffffffffffff",
		"0123456789abcdef0123456789abcdef01234567",
	}

	seen := map[float64]bool{}

	for _, key := range keys {
		position := framePosition(key, duration)

		if position < duration*thumbnailFrom || position > duration*thumbnailTo {
			t.Fatalf("position %v for %s is outside the episode's middle", position, key)
		}
		if framePosition(key, duration) != position {
			t.Fatalf("the same file must get the same frame every time")
		}

		seen[position] = true
	}

	if len(seen) < 2 {
		t.Fatal("different files should get different moments")
	}

	if framePosition(keys[0], 0) <= 0 {
		t.Fatal("an unknown length still needs a position past the very start")
	}
}

func TestThumbnailIsCutOnceAndKept(t *testing.T) {
	ffmpeg, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg is not installed")
	}

	dir := t.TempDir()
	video := filepath.Join(dir, "episode.mkv")

	generate := exec.CommandContext(context.Background(), ffmpeg, "-v", "error", "-f", "lavfi", "-i", "testsrc=duration=10:size=320x240:rate=10", //nolint:gosec // test fixture
		"-c:v", "mpeg4", video)
	if output, genErr := generate.CombinedOutput(); genErr != nil {
		t.Skipf("cannot make a test video: %v: %s", genErr, output)
	}

	thumbnailer := &Thumbnailer{FFmpeg: At(ffmpeg), CacheDir: filepath.Join(dir, "thumbs")}

	first, err := thumbnailer.Thumbnail(context.Background(), video, 10)
	if err != nil {
		t.Fatalf("thumbnail: %v", err)
	}

	stat, err := os.Stat(first)
	if err != nil || stat.Size() == 0 {
		t.Fatalf("no still was written: %v", err)
	}

	second, err := thumbnailer.Thumbnail(context.Background(), video, 10)
	if err != nil || second != first {
		t.Fatalf("the second request must reuse the first still: %q %v", second, err)
	}

	if after, _ := os.Stat(second); !after.ModTime().Equal(stat.ModTime()) {
		t.Fatal("the still was cut again")
	}
}
