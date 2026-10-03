// Adapted from Seanime (github.com/5rahim/seanime, internal/mediastream/videofile),
// GPL-3.0.
package videofile

import (
	"cmp"
	"context"
	"fmt"
	"mime"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"golang.org/x/text/language"
	"gopkg.in/vansante/go-ffprobe.v2"
)

type MediaInfo struct {
	Path      string  `json:"path" doc:"Absolute path of the file."`
	Extension string  `json:"extension" doc:"File extension without the dot."`
	MimeCodec *string `json:"mime_codec,omitempty" doc:"RFC 6381 type with codecs, for canPlayType. Absent when a stream has a codec the node cannot describe — such a file is not a direct-play candidate."`
	Size      uint64  `json:"size" doc:"Size in bytes."`
	Duration  float32 `json:"duration" doc:"Length in seconds."`
	Container *string `json:"container,omitempty" doc:"Container format as ffprobe names it."`

	Video     *Video     `json:"video,omitempty" doc:"The first video stream."`
	Videos    []Video    `json:"videos"`
	Audios    []Audio    `json:"audios"`
	Subtitles []Subtitle `json:"subtitles"`
	Fonts     []Font     `json:"fonts" doc:"Fonts attached to the file, needed to render its ASS subtitles as authored."`
	Chapters  []Chapter  `json:"chapters"`
}

type Video struct {
	Codec          string  `json:"codec"`
	MimeCodec      *string `json:"mime_codec,omitempty"`
	Language       *string `json:"language,omitempty"`
	Quality        Quality `json:"quality"`
	Width          uint32  `json:"width"`
	Height         uint32  `json:"height"`
	Bitrate        uint32  `json:"bitrate"`
	PixFmt         string  `json:"pix_fmt"`
	ColorSpace     string  `json:"color_space"`
	ColorTransfer  string  `json:"color_transfer"`
	ColorPrimaries string  `json:"color_primaries"`
}

type Audio struct {
	Index     uint32  `json:"index"`
	Title     *string `json:"title,omitempty"`
	Language  *string `json:"language,omitempty"`
	Codec     string  `json:"codec"`
	MimeCodec *string `json:"mime_codec,omitempty"`
	IsDefault bool    `json:"is_default"`
	IsForced  bool    `json:"is_forced"`
	Channels  uint32  `json:"channels"`
}

type Subtitle struct {
	Index     uint32  `json:"index"`
	Title     *string `json:"title,omitempty"`
	Language  *string `json:"language,omitempty"`
	Codec     string  `json:"codec"`
	Extension string  `json:"extension"`
	IsDefault bool    `json:"is_default"`
	IsForced  bool    `json:"is_forced"`
}

type Font struct {
	// Index counts attachment streams, fonts or not, because that is what
	// ffmpeg's t:N specifier addresses.
	Index uint32 `json:"index"`
	Name  string `json:"name"`
}

type Chapter struct {
	StartTime float32 `json:"start_time"`
	EndTime   float32 `json:"end_time"`
	Name      string  `json:"name"`
}

// go-ffprobe keeps the binary path in a package global, so it is set once.
var ffprobeOnce sync.Once

func probe(ctx context.Context, ffprobePath, path string) (*MediaInfo, error) {
	if ffprobePath != "" {
		ffprobeOnce.Do(func() { ffprobe.SetFFProbeBinPath(ffprobePath) })
	}

	data, err := ffprobe.ProbeURL(ctx, path)
	if err != nil {
		return nil, err
	}

	size, _ := strconv.ParseUint(data.Format.Size, 10, 64)

	mi := &MediaInfo{
		Path:      path,
		Extension: strings.TrimPrefix(filepath.Ext(path), "."),
		Size:      size,
		Duration:  float32(data.Format.DurationSeconds),
		Container: nullIfZero(data.Format.FormatName),
	}

	mi.Videos = streamsOf(data.Streams, ffprobe.StreamVideo, func(stream *ffprobe.Stream, _ uint32) Video {
		lang, _ := language.Parse(stream.Tags.Language)
		// Matroska rarely carries a per-stream bitrate; the container's is too high
		// but better than nothing.
		bitrate, _ := strconv.ParseUint(cmp.Or(stream.BitRate, data.Format.BitRate), 10, 32)

		return Video{
			Codec:          stream.CodecName,
			MimeCodec:      streamToMimeCodec(stream),
			Language:       nullIfZero(lang.String()),
			Quality:        heightToQuality(uint32(stream.Height)),
			Width:          uint32(stream.Width),
			Height:         uint32(stream.Height),
			Bitrate:        uint32(bitrate),
			PixFmt:         stream.PixFmt,
			ColorSpace:     stream.ColorSpace,
			ColorTransfer:  stream.ColorTransfer,
			ColorPrimaries: stream.ColorPrimaries,
		}
	})

	mi.Audios = streamsOf(data.Streams, ffprobe.StreamAudio, func(stream *ffprobe.Stream, i uint32) Audio {
		lang, _ := language.Parse(stream.Tags.Language)

		return Audio{
			Index:     i,
			Title:     nullIfZero(stream.Tags.Title),
			Language:  nullIfZero(lang.String()),
			Codec:     stream.CodecName,
			MimeCodec: streamToMimeCodec(stream),
			IsDefault: stream.Disposition.Default != 0,
			IsForced:  stream.Disposition.Forced != 0,
			Channels:  channelCount(stream),
		}
	})

	subtitleExtensions := map[string]string{"subrip": "srt", "ass": "ass", "ssa": "ssa", "webvtt": "vtt"}

	// Image subtitles (PGS, VobSub) are left out: the player cannot render them
	// from a text track.
	for _, sub := range streamsOf(data.Streams, ffprobe.StreamSubtitle, func(stream *ffprobe.Stream, i uint32) Subtitle {
		lang, _ := language.Parse(stream.Tags.Language)

		return Subtitle{
			Index:     i,
			Title:     nullIfZero(stream.Tags.Title),
			Language:  nullIfZero(lang.String()),
			Codec:     stream.CodecName,
			Extension: subtitleExtensions[stream.CodecName],
			IsDefault: stream.Disposition.Default != 0,
			IsForced:  stream.Disposition.Forced != 0,
		}
	}) {
		if sub.Extension != "" {
			mi.Subtitles = append(mi.Subtitles, sub)
		}
	}

	for _, chapter := range data.Chapters {
		mi.Chapters = append(mi.Chapters, Chapter{
			StartTime: float32(chapter.StartTimeSeconds),
			EndTime:   float32(chapter.EndTimeSeconds),
			Name:      chapter.Title(),
		})
	}

	mi.Fonts = []Font{}
	for i, attachment := range streamsOf(data.Streams, ffprobe.StreamAttachment, func(stream *ffprobe.Stream, _ uint32) *ffprobe.Stream {
		return stream
	}) {
		name, _ := attachment.TagList.GetString("filename")
		mimetype, _ := attachment.TagList.GetString("mimetype")

		if isFont(name, mimetype) {
			mi.Fonts = append(mi.Fonts, Font{Index: uint32(i), Name: name})
		}
	}

	mi.MimeCodec = mediaMimeCodec(mi.Extension, mi.Videos, mi.Audios)

	if len(mi.Videos) > 0 {
		mi.Video = &mi.Videos[0]
	}

	if mi.Subtitles == nil {
		mi.Subtitles = []Subtitle{}
	}
	if mi.Chapters == nil {
		mi.Chapters = []Chapter{}
	}

	return mi, nil
}

func isFont(name, mimetype string) bool {
	mimetype = strings.ToLower(mimetype)
	if strings.Contains(mimetype, "font") || strings.Contains(mimetype, "opentype") {
		return true
	}

	switch strings.ToLower(filepath.Ext(name)) {
	case ".ttf", ".otf", ".ttc", ".woff", ".woff2":
		return true
	default:
		return false
	}
}

func channelCount(stream *ffprobe.Stream) uint32 {
	if stream.Channels > 0 {
		return uint32(stream.Channels)
	}

	switch {
	case strings.Contains(stream.ChannelLayout, "7.1"):
		return 8
	case strings.Contains(stream.ChannelLayout, "5.1"):
		return 6
	case strings.Contains(stream.ChannelLayout, "mono"):
		return 1
	default:
		return 2
	}
}

func nullIfZero[T comparable](v T) *T {
	var zero T
	if v == zero {
		return nil
	}

	return &v
}

func streamsOf[T any](streams []*ffprobe.Stream, kind ffprobe.StreamType, mapper func(*ffprobe.Stream, uint32) T) []T {
	ret := []T{}

	i := uint32(0)
	for _, stream := range streams {
		if stream.CodecType == string(kind) {
			ret = append(ret, mapper(stream, i))
			i++
		}
	}

	return ret
}

func ptr(s string) *string {
	return &s
}

func streamToMimeCodec(stream *ffprobe.Stream) *string {
	switch strings.ToLower(stream.CodecName) {
	case "h264":
		var profile string
		switch strings.ToLower(stream.Profile) {
		case "high":
			profile = "6400"
		case "main":
			profile = "4D40"
		case "baseline":
			profile = "4200"
		case "constrained baseline":
			profile = "42E0"
		default:
			// High 10 lands here, which is the point: Chromium cannot decode it.
			return nil
		}

		if stream.Level <= 0 || stream.Level > 255 {
			return nil
		}

		return ptr(fmt.Sprintf("avc1.%s%02X", profile, stream.Level))

	case "h265", "hevc":
		var profile string
		switch strings.ToLower(stream.Profile) {
		case "main":
			profile = "1.6"
		case "main 10":
			profile = "2.4"
		default:
			return nil
		}

		if stream.Level <= 0 || stream.Level > 255 {
			return nil
		}

		return ptr(fmt.Sprintf("hvc1.%s.L%d.B0", profile, stream.Level))

	case "av1":
		var profile string
		switch strings.ToLower(stream.Profile) {
		case "main":
			profile = "0"
		case "high":
			profile = "1"
		case "professional":
			profile = "2"
		default:
			return nil
		}

		if stream.Level < 0 || stream.Level > 23 {
			return nil
		}

		bitDepth, ok := videoBitDepth(stream)
		if !ok {
			return nil
		}

		return ptr(fmt.Sprintf("av01.%s.%02dM.%02d", profile, stream.Level, bitDepth))

	case "vp9":
		var profile string
		var bitDepth uint64
		switch strings.ToLower(stream.Profile) {
		case "profile 0":
			profile, bitDepth = "00", 8
		case "profile 1":
			profile, bitDepth = "01", 8
		case "profile 2":
			profile = "02"
		case "profile 3":
			profile = "03"
		default:
			return nil
		}

		if !isVP9Level(stream.Level) {
			return nil
		}

		if profile == "02" || profile == "03" {
			var ok bool
			bitDepth, ok = videoBitDepth(stream)
			if !ok || (bitDepth != 10 && bitDepth != 12) {
				return nil
			}
		}

		return ptr(fmt.Sprintf("vp09.%s.%02d.%02d", profile, stream.Level, bitDepth))

	case "vp8":
		return ptr("vp8")

	case "aac":
		switch strings.ToLower(stream.Profile) {
		case "lc":
			return ptr("mp4a.40.2")
		case "he", "he-aac":
			return ptr("mp4a.40.5")
		case "he-aacv2", "he-aac v2", "he v2":
			return ptr("mp4a.40.29")
		default:
			return nil
		}

	case "opus":
		return ptr("opus")
	case "mp3":
		return ptr("mp3")
	case "vorbis":
		return ptr("vorbis")
	case "ac3":
		return ptr("ac-3")
	case "eac3":
		return ptr("ec-3")
	case "flac":
		return ptr("fLaC")
	case "alac":
		return ptr("alac")
	default:
		return nil
	}
}

// mediaMimeCodec describes what a direct play would have to decode: the first
// video stream and the audio stream the player starts with.
func mediaMimeCodec(extension string, videos []Video, audios []Audio) *string {
	container := ContainerMimeType(extension)
	if container == "" {
		return nil
	}

	codecs := make([]string, 0, 2)
	if len(videos) > 0 {
		if videos[0].MimeCodec == nil || *videos[0].MimeCodec == "" {
			return nil
		}
		codecs = append(codecs, *videos[0].MimeCodec)
	}

	if len(audios) > 0 {
		audio := &audios[0]
		for i := range audios {
			if audios[i].IsDefault {
				audio = &audios[i]
				break
			}
		}
		if audio.MimeCodec == nil || *audio.MimeCodec == "" {
			return nil
		}
		codecs = append(codecs, *audio.MimeCodec)
	}

	if len(codecs) == 0 {
		return nil
	}

	return ptr(fmt.Sprintf("%s; codecs=\"%s\"", container, strings.Join(codecs, ", ")))
}

func ContainerMimeType(extension string) string {
	extension = strings.ToLower(strings.TrimPrefix(extension, "."))

	switch extension {
	case "mkv":
		return "video/matroska"
	case "mka":
		return "audio/matroska"
	case "mk3d":
		return "video/matroska-3d"
	case "mp4", "m4v":
		return "video/mp4"
	case "webm":
		return "video/webm"
	case "mov":
		return "video/quicktime"
	case "avi":
		return "video/x-msvideo"
	case "":
		return ""
	default:
		return mime.TypeByExtension("." + extension)
	}
}

func videoBitDepth(stream *ffprobe.Stream) (uint64, bool) {
	bitDepth, err := strconv.ParseUint(stream.BitsPerRawSample, 10, 32)
	if err == nil && (bitDepth == 8 || bitDepth == 10 || bitDepth == 12) {
		return bitDepth, true
	}

	pixFmt := strings.ToLower(stream.PixFmt)
	switch {
	case strings.Contains(pixFmt, "12"):
		return 12, true
	case strings.Contains(pixFmt, "10"):
		return 10, true
	case pixFmt != "" && !strings.Contains(pixFmt, "16"):
		return 8, true
	default:
		return 0, false
	}
}

func isVP9Level(level int) bool {
	switch level {
	case 10, 11, 20, 21, 30, 31, 40, 41, 50, 51, 52, 60, 61, 62:
		return true
	default:
		return false
	}
}

func heightToQuality(height uint32) Quality {
	for _, quality := range Qualities {
		if quality.Height() >= height {
			return quality
		}
	}

	return P240
}
