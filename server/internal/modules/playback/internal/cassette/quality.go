// Adapted from Seanime (github.com/5rahim/seanime, internal/mediastream/cassette),
// GPL-3.0.
package cassette

import (
	"fmt"
	"math"
	"strings"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/playback/internal/videofile"
)

// Quality is the video resolution tier; Original keeps the source's own.
type Quality = videofile.Quality

const (
	P240     = videofile.P240
	P360     = videofile.P360
	P480     = videofile.P480
	P720     = videofile.P720
	P1080    = videofile.P1080
	P1440    = videofile.P1440
	P4k      = videofile.P4k
	P8k      = videofile.P8k
	Original = videofile.Original
)

var Qualities = videofile.Qualities

func QualityFromString(s string) (Quality, error) {
	return videofile.QualityFromString(s)
}

// dynamic quality ladder

// QualityLadderEntry is one rung in a dynamic quality ladder built from
// the source file's actual properties
type QualityLadderEntry struct {
	Quality Quality
	Width   int32
	Height  int32
	// Whether this quality tier requires transcoding (vs transmux/copy).
	NeedsTranscode bool
	// Whether the source's codec already matches the output codec so the
	// original tier can transmux (copy) the video stream.
	OriginalCanTransmux bool
}

// BuildQualityLadder generates a quality ladder for the source file.
//   - Never offers tiers above the source resolution (useless upscale)
//   - Marks the original tier as transmux-capable when the source is h264
//     at a compatible profile (avoids an entire re-encode)
//   - Computes actual output dimensions preserving aspect ratio
//   - Skips tiers whose bitrate would exceed the source's native bitrate (wasteful to transcode to a "lower quality" at higher bitrate)
func BuildQualityLadder(info *videofile.MediaInfo) []QualityLadderEntry {
	if info.Video == nil {
		return nil
	}

	srcHeight := info.Video.Height
	srcWidth := info.Video.Width
	srcBitrate := info.Video.Bitrate
	aspectRatio := float64(srcWidth) / float64(srcHeight)

	// whether the source can be transmuxed (copied) as the "original"
	// h264 baseline/main/high at standard levels is universally playable
	canTransmux := isTransmuxableVideo(info.Video)

	var ladder []QualityLadderEntry

	// include the "original" tier first
	ladder = append(ladder, QualityLadderEntry{
		Quality:             Original,
		Width:               clamp32(srcWidth),
		Height:              clamp32(srcHeight),
		NeedsTranscode:      !canTransmux,
		OriginalCanTransmux: canTransmux,
	})

	// add downscale tiers that make sense
	for _, q := range Qualities {
		h := q.Height()

		// skip tiers above source resolution, upscaling is pointless
		if h > srcHeight {
			continue
		}

		// skip tiers whose average bitrate exceeds the source bitrate
		// e.g. skip a 720p tier at 2.4 Mbps when the source is a low bitrate 1080p at 1.5 Mbps
		if srcBitrate > 0 && q.AverageBitrate() >= srcBitrate {
			continue
		}

		w := closestEven(int32(float64(h) * aspectRatio))

		ladder = append(ladder, QualityLadderEntry{
			Quality:        q,
			Width:          w,
			Height:         clamp32(h),
			NeedsTranscode: true,
		})
	}

	return ladder
}

// isTransmuxableVideo returns true if the codec can be directly copied
// into an HLS mpegts container without re-encoding and be playable in browsers.
func isTransmuxableVideo(video *videofile.Video) bool {
	if video.MimeCodec == nil {
		return false
	}
	// chrome/safari support h.264 baseline/main/high profiles (8-bit). The
	// profile is hex, and videofile writes it upper-case.
	codec := strings.ToLower(*video.MimeCodec)
	return strings.HasPrefix(codec, "avc1.42") ||
		strings.HasPrefix(codec, "avc1.4d") ||
		strings.HasPrefix(codec, "avc1.64")
}

// audio codec awareness

// AudioTranscodeDecision describes how an audio track should be handled
type AudioTranscodeDecision struct {
	// Copy is true when the source codec is HLS-compatible and can be
	// transmitted without re-encoding.
	Copy bool
	// Codec is the output codec flag (e.g. "aac", "copy").
	Codec string
	// Bitrate is the output bitrate flag (e.g. "128k", "384k"). Empty when
	// Copy is true.
	Bitrate string
	// Channels is the output channel count as a string.
	Channels string
}

// DecideAudioTranscode
// - If the source is already AAC: copy it
// - If the source has ≤ 2 channels: encode to AAC stereo @ 128k
// - If the source has > 2 channels: encode to AAC preserving layout @ 384k
func DecideAudioTranscode(audio *videofile.Audio) AudioTranscodeDecision {
	// just copy aac
	if audio.Codec == "aac" {
		channels := "2"
		if audio.Channels > 2 {
			channels = fmt.Sprintf("%d", audio.Channels)
		}
		return AudioTranscodeDecision{
			Copy:     true,
			Codec:    "copy",
			Channels: channels,
		}
	}

	// everything else needs re-encoding to AAC
	channels := "2"
	bitrate := "128k"
	if audio.Channels > 2 {
		channels = fmt.Sprintf("%d", audio.Channels)
		bitrate = "384k"
	}

	return AudioTranscodeDecision{
		Copy:     false,
		Codec:    "aac",
		Bitrate:  bitrate,
		Channels: channels,
	}
}

// EffectiveBitrate returns the bitrate to advertize in the master playlist
func EffectiveBitrate(q Quality, srcBitrate uint32) (avg, peak uint32) {
	if q == Original {
		return srcBitrate, srcBitrate
	}
	avg = q.AverageBitrate()
	peak = q.MaxBitrate()
	if srcBitrate > 0 {
		avg = uint32(math.Min(float64(avg), float64(srcBitrate)*0.8))
		peak = uint32(math.Min(float64(peak), float64(srcBitrate)))
	}
	return avg, peak
}
