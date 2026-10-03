package videofile

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"gopkg.in/vansante/go-ffprobe.v2"
)

func TestStreamToMimeCodec(t *testing.T) {
	tests := []struct {
		name   string
		stream ffprobe.Stream
		want   string
	}{
		{"h264 high 4.0", ffprobe.Stream{CodecName: "h264", Profile: "High", Level: 40}, "avc1.640028"},
		{"h264 baseline 3.1", ffprobe.Stream{CodecName: "h264", Profile: "Baseline", Level: 31}, "avc1.42001F"},
		{"h264 constrained baseline", ffprobe.Stream{CodecName: "h264", Profile: "Constrained Baseline", Level: 31}, "avc1.42E01F"},
		{"h264 high 10 is not direct-playable", ffprobe.Stream{CodecName: "h264", Profile: "High 10", Level: 40}, ""},
		{"h264 unknown level", ffprobe.Stream{CodecName: "h264", Profile: "High", Level: 0}, ""},
		{"hevc main", ffprobe.Stream{CodecName: "hevc", Profile: "Main", Level: 120}, "hvc1.1.6.L120.B0"},
		{"hevc main 10", ffprobe.Stream{CodecName: "h265", Profile: "Main 10", Level: 153}, "hvc1.2.4.L153.B0"},
		{"hevc rext", ffprobe.Stream{CodecName: "hevc", Profile: "Rext", Level: 120}, ""},
		{"av1 8 bit", ffprobe.Stream{CodecName: "av1", Profile: "Main", Level: 8, BitsPerRawSample: "8"}, "av01.0.08M.08"},
		{"av1 bit depth from pix fmt", ffprobe.Stream{CodecName: "av1", Profile: "Main", Level: 13, PixFmt: "yuv420p10le"}, "av01.0.13M.10"},
		{"av1 reserved level", ffprobe.Stream{CodecName: "av1", Profile: "Main", Level: 24, BitsPerRawSample: "8"}, ""},
		{"av1 unknown bit depth", ffprobe.Stream{CodecName: "av1", Profile: "Main", Level: 8}, ""},
		{"vp9 profile 0", ffprobe.Stream{CodecName: "vp9", Profile: "Profile 0", Level: 40}, "vp09.00.40.08"},
		{"vp9 profile 2 10 bit", ffprobe.Stream{CodecName: "vp9", Profile: "Profile 2", Level: 40, BitsPerRawSample: "10"}, "vp09.02.40.10"},
		{"vp9 profile 3 from pix fmt", ffprobe.Stream{CodecName: "vp9", Profile: "Profile 3", Level: 41, PixFmt: "yuv444p12le"}, "vp09.03.41.12"},
		{"vp9 undefined level", ffprobe.Stream{CodecName: "vp9", Profile: "Profile 0", Level: 0}, ""},
		{"vp9 profile 2 unknown depth", ffprobe.Stream{CodecName: "vp9", Profile: "Profile 2", Level: 40}, ""},
		{"vp8", ffprobe.Stream{CodecName: "vp8"}, "vp8"},
		{"aac lc", ffprobe.Stream{CodecName: "aac", Profile: "LC"}, "mp4a.40.2"},
		{"aac he", ffprobe.Stream{CodecName: "aac", Profile: "HE-AAC"}, "mp4a.40.5"},
		{"aac he v2", ffprobe.Stream{CodecName: "aac", Profile: "HE-AACv2"}, "mp4a.40.29"},
		{"aac unknown", ffprobe.Stream{CodecName: "aac", Profile: "Unknown"}, ""},
		{"opus", ffprobe.Stream{CodecName: "opus"}, "opus"},
		{"flac", ffprobe.Stream{CodecName: "flac"}, "fLaC"},
		{"eac3", ffprobe.Stream{CodecName: "eac3"}, "ec-3"},
		{"dts", ffprobe.Stream{CodecName: "dts"}, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := streamToMimeCodec(&tt.stream)

			if tt.want == "" {
				if got != nil {
					t.Fatalf("got %q, want nil", *got)
				}
				return
			}

			if got == nil || *got != tt.want {
				t.Fatalf("got %v, want %q", got, tt.want)
			}
		})
	}
}

func TestMediaMimeCodec(t *testing.T) {
	avc, aac := "avc1.640028", "mp4a.40.2"

	tests := []struct {
		name      string
		extension string
		videos    []Video
		audios    []Audio
		want      string
	}{
		{"video and audio", "mkv", []Video{{MimeCodec: &avc}}, []Audio{{MimeCodec: &aac}}, `video/matroska; codecs="avc1.640028, mp4a.40.2"`},
		{"video only", "mp4", []Video{{MimeCodec: &avc}}, nil, `video/mp4; codecs="avc1.640028"`},
		{"default audio wins", "mkv", []Video{{MimeCodec: &avc}}, []Audio{{}, {MimeCodec: &aac, IsDefault: true}}, `video/matroska; codecs="avc1.640028, mp4a.40.2"`},
		{"unknown video codec", "mkv", []Video{{}}, []Audio{{MimeCodec: &aac}}, ""},
		{"unknown default audio", "mkv", []Video{{MimeCodec: &avc}}, []Audio{{MimeCodec: &aac}, {IsDefault: true}}, ""},
		{"no streams", "mkv", nil, nil, ""},
		{"unknown container", "not-a-real-container-867", []Video{{MimeCodec: &avc}}, nil, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := mediaMimeCodec(tt.extension, tt.videos, tt.audios)

			if tt.want == "" {
				if got != nil {
					t.Fatalf("got %q, want nil", *got)
				}
				return
			}

			if got == nil || *got != tt.want {
				t.Fatalf("got %v, want %q", got, tt.want)
			}
		})
	}
}

// A real probe of a real file, when the machine has ffmpeg: the codec strings
// above are only worth something if ffprobe reports what they assume.
func TestProberReadsARealFileAndCachesIt(t *testing.T) {
	ffmpeg, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg is not on PATH")
	}
	if _, lookErr := exec.LookPath("ffprobe"); lookErr != nil {
		t.Skip("ffprobe is not on PATH")
	}

	dir := t.TempDir()
	path := filepath.Join(dir, "sample.mkv")

	out, err := exec.CommandContext(t.Context(), ffmpeg, "-v", "error",
		"-f", "lavfi", "-i", "testsrc=size=320x240:rate=24:duration=1",
		"-f", "lavfi", "-i", "sine=frequency=440:duration=1",
		"-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
		"-c:a", "aac", "-shortest", path).CombinedOutput()
	if err != nil {
		t.Skipf("ffmpeg cannot make a sample here: %v %s", err, out)
	}

	prober := Prober{CacheDir: filepath.Join(dir, "cache")}

	info, err := prober.Info(context.Background(), path)
	if err != nil {
		t.Fatalf("probe: %v", err)
	}

	if info.MimeCodec == nil {
		t.Fatalf("no mime codec for an h264/aac mkv: %+v", info)
	}
	if want := `video/matroska; codecs="avc1.64000D, mp4a.40.2"`; *info.MimeCodec != want {
		t.Errorf("mime codec = %q, want %q", *info.MimeCodec, want)
	}
	if info.Duration < 0.9 || info.Duration > 1.2 {
		t.Errorf("duration = %v, want about a second", info.Duration)
	}

	entries, _ := os.ReadDir(prober.CacheDir)
	if len(entries) != 1 {
		t.Fatalf("cache holds %d entries, want 1", len(entries))
	}

	again, err := Prober{FFprobePath: filepath.Join(dir, "missing-ffprobe"), CacheDir: prober.CacheDir}.Info(context.Background(), path)
	if err != nil {
		t.Fatalf("second probe did not come from the cache: %v", err)
	}
	if *again.MimeCodec != *info.MimeCodec {
		t.Errorf("cached info differs: %q vs %q", *again.MimeCodec, *info.MimeCodec)
	}
}
