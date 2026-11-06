package cassette

import (
	"context"
	"encoding/json"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/playback/internal/videofile"
)

func ptr(s string) *string { return &s }

func TestMainProfileH264IsCopiedRatherThanReencoded(t *testing.T) {
	ladder := BuildQualityLadder(&videofile.MediaInfo{
		Video: &videofile.Video{MimeCodec: ptr("avc1.4D4029"), Width: 1280, Height: 720},
	})

	if len(ladder) == 0 || !ladder[0].OriginalCanTransmux {
		t.Fatalf("original tier of an H.264 Main file must transmux: %+v", ladder)
	}
}

func TestTenBitH264IsReencoded(t *testing.T) {
	// videofile gives no mime codec for High 10, because Chromium cannot decode it.
	ladder := BuildQualityLadder(&videofile.MediaInfo{
		Video: &videofile.Video{Width: 1920, Height: 1080, PixFmt: "yuv420p10le"},
	})

	if len(ladder) == 0 || ladder[0].OriginalCanTransmux {
		t.Fatalf("a 10-bit source cannot be copied: %+v", ladder)
	}
}

func TestMasterPlaylistCarriesTheToken(t *testing.T) {
	info := &videofile.MediaInfo{
		Video:  &videofile.Video{Width: 1280, Height: 720},
		Audios: []videofile.Audio{{Index: 0, Language: ptr("ja"), IsDefault: true, Channels: 2}},
	}

	master := GenerateMasterPlaylist(info, BuildQualityLadder(info), "secret")

	for _, want := range []string{"./original/index.m3u8?token=secret", `URI="./audio/0/index.m3u8?token=secret"`} {
		if !strings.Contains(master, want) {
			t.Errorf("master playlist lacks %s:\n%s", want, master)
		}
	}
}

// Without ffprobe the keyframe scan fails before it reads anything. That used to
// leave every request for the file waiting forever.
func TestMissingFFprobeFailsInsteadOfHanging(t *testing.T) {
	logger := zerolog.Nop()
	c, err := New(&NewCassetteOptions{
		Logger:      &logger,
		TempOutDir:  t.TempDir(),
		FfmpegPath:  "ffmpeg",
		FfprobePath: filepath.Join(t.TempDir(), "no-ffprobe"),
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(c.Destroy)

	done := make(chan error, 1)
	go func() {
		_, err := c.GetMaster("/nowhere.mkv", "hash", &videofile.MediaInfo{Duration: 10}, "desktop", "")
		done <- err
	}()

	select {
	case err := <-done:
		if err == nil {
			t.Fatal("no error for a file whose keyframes could not be read")
		}
	case <-time.After(10 * time.Second):
		t.Fatal("GetMaster hung")
	}
}

// The case transcoding exists for: Hi10P, which Chromium will not decode, comes
// out as 8-bit H.264 in MPEG-TS that it will.
func TestTenBitSourceBecomesPlayableSegments(t *testing.T) {
	ffmpeg, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg is not on PATH")
	}
	ffprobe, lookErr := exec.LookPath("ffprobe")
	if lookErr != nil {
		t.Skip("ffprobe is not on PATH")
	}

	dir := t.TempDir()
	path := filepath.Join(dir, "hi10p.mkv")

	out, err := exec.CommandContext(t.Context(), ffmpeg, "-v", "error",
		"-f", "lavfi", "-i", "testsrc=size=320x240:rate=24:duration=6",
		"-f", "lavfi", "-i", "sine=frequency=440:duration=6",
		"-c:v", "libx264", "-profile:v", "high10", "-pix_fmt", "yuv420p10le", "-g", "48",
		"-c:a", "flac", "-shortest", path).CombinedOutput()
	if err != nil {
		t.Skipf("ffmpeg cannot make a 10-bit sample here: %v %s", err, out)
	}

	info, err := videofile.Prober{}.Info(t.Context(), path)
	if err != nil {
		t.Fatalf("probe: %v", err)
	}
	if info.MimeCodec != nil {
		t.Fatalf("a 10-bit file reads as direct-playable: %s", *info.MimeCodec)
	}

	logger := zerolog.Nop()
	c, err := New(&NewCassetteOptions{Logger: &logger, TempOutDir: filepath.Join(dir, "out"), FfmpegPath: ffmpeg, FfprobePath: ffprobe})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(c.Destroy)

	ctx, cancel := context.WithTimeout(t.Context(), time.Minute)
	defer cancel()

	if _, err = c.GetMaster(path, "sample", info, "desktop", "t"); err != nil {
		t.Fatalf("master: %v", err)
	}

	index, err := c.GetVideoIndex(path, "sample", info, Original, "t")
	if err != nil {
		t.Fatalf("video index: %v", err)
	}
	if !strings.Contains(index, "segment-0.ts?token=t") {
		t.Fatalf("variant playlist lists no first segment:\n%s", index)
	}

	video, err := c.GetVideoSegment(ctx, path, "sample", info, Original, 0, "desktop")
	if err != nil {
		t.Fatalf("video segment: %v", err)
	}

	audio, err := c.GetAudioSegment(ctx, path, "sample", info, 0, 0, "desktop")
	if err != nil {
		t.Fatalf("audio segment: %v", err)
	}

	assertStream(t, ffprobe, video, "h264", "yuv420p")
	assertStream(t, ffprobe, audio, "aac", "")
}

func assertStream(t *testing.T, ffprobe, path, codec, pixFmt string) {
	t.Helper()

	out, err := exec.CommandContext(t.Context(), ffprobe, "-v", "error", "-of", "json",
		"-show_entries", "stream=codec_name,pix_fmt", path).Output()
	if err != nil {
		t.Fatalf("probe %s: %v", path, err)
	}

	var probed struct {
		Streams []struct {
			CodecName string `json:"codec_name"`
			PixFmt    string `json:"pix_fmt"`
		} `json:"streams"`
	}
	if err := json.Unmarshal(out, &probed); err != nil || len(probed.Streams) == 0 {
		t.Fatalf("segment %s has no streams: %v %s", path, err, out)
	}

	got := probed.Streams[0]
	if got.CodecName != codec || (pixFmt != "" && got.PixFmt != pixFmt) {
		t.Errorf("segment %s is %s/%s, want %s/%s", filepath.Base(path), got.CodecName, got.PixFmt, codec, pixFmt)
	}
}
