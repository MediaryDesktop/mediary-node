package videofile

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// The font's own name points outside the cache. It has to land inside it anyway.
const hostileFontName = "../../escaped.ttf"

func makeSubtitledSample(t *testing.T, dir string) string {
	t.Helper()

	ffmpeg, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg is not on PATH")
	}
	if _, lookErr := exec.LookPath("ffprobe"); lookErr != nil {
		t.Skip("ffprobe is not on PATH")
	}

	srt := filepath.Join(dir, "sub.srt")
	if err = os.WriteFile(srt, []byte("1\n00:00:00,000 --> 00:00:01,000\nHello there\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	font := filepath.Join(dir, "font.ttf")
	if err = os.WriteFile(font, make([]byte, 64), 0o600); err != nil {
		t.Fatal(err)
	}

	path := filepath.Join(dir, "sample.mkv")

	out, err := exec.CommandContext(t.Context(), ffmpeg, "-v", "error",
		"-f", "lavfi", "-i", "testsrc=size=160x120:rate=12:duration=1",
		"-i", srt,
		"-attach", font,
		"-metadata:s:t", "mimetype=application/x-truetype-font",
		"-metadata:s:t", "filename="+hostileFontName,
		"-map", "0:v", "-map", "1:s",
		"-c:v", "libx264", "-c:s", "srt", path).CombinedOutput()
	if err != nil {
		t.Skipf("ffmpeg cannot make a sample here: %v %s", err, out)
	}

	return path
}

func TestExtractorConvertsSubtitlesAndKeepsFontsInsideTheCache(t *testing.T) {
	dir := t.TempDir()
	path := makeSubtitledSample(t, dir)

	info, err := Prober{}.Info(context.Background(), path)
	if err != nil {
		t.Fatalf("probe: %v", err)
	}
	if len(info.Subtitles) != 1 || len(info.Fonts) != 1 {
		t.Fatalf("probe found %d subtitles and %d fonts, want 1 and 1", len(info.Subtitles), len(info.Fonts))
	}

	cache := filepath.Join(dir, "cache")
	extractor := &Extractor{CacheDir: cache}

	extracted, err := extractor.Extract(context.Background(), path, "", info)
	if err != nil {
		t.Fatalf("extract: %v", err)
	}

	sub, err := os.ReadFile(extracted.Subtitle(info.Subtitles[0].Index))
	if err != nil {
		t.Fatalf("read subtitle: %v", err)
	}
	if !strings.Contains(string(sub), "[Script Info]") || !strings.Contains(string(sub), "Hello there") {
		t.Errorf("subtitle is not ASS with the line in it:\n%s", sub)
	}

	fontPath := extracted.Font(info.Fonts[0])
	if !strings.HasPrefix(fontPath, cache) {
		t.Fatalf("font path %s is outside the cache", fontPath)
	}
	if _, err := os.Stat(fontPath); err != nil {
		t.Errorf("font was not written: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, "escaped.ttf")); !os.IsNotExist(err) {
		t.Errorf("the file's own font name was used: %v", err)
	}

	// A second call is served from the finished directory.
	if _, err := (&Extractor{FFmpeg: At(filepath.Join(dir, "no-ffmpeg")), CacheDir: cache}).Extract(context.Background(), path, "", info); err != nil {
		t.Errorf("second extract ran ffmpeg again: %v", err)
	}
}
