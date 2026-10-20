package playback

import (
	"context"
	"sync"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/playback/internal/cassette"
	"github.com/mediaryorg/mediary-node/server/internal/modules/playback/internal/videofile"
)

// lazyTranscoder makes the transcoder on the first file that needs it, and again
// when ffmpeg or ffprobe moved — installed, updated or removed while the node
// runs. Made at start, a node without FFmpeg would stay without transcoding until
// restarted, and the hardware encoder would be probed on a binary that is not
// there.
type lazyTranscoder struct {
	tools   Tools
	logger  zerolog.Logger
	hwAccel string
	dir     string

	mu      sync.Mutex
	current *cassette.Cassette
	ffmpeg  string
	ffprobe string
}

func (l *lazyTranscoder) get() (*cassette.Cassette, error) {
	ffmpeg, err := l.tools.Path("ffmpeg")
	if err != nil {
		return nil, err
	}

	ffprobe, err := l.tools.Path("ffprobe")
	if err != nil {
		return nil, err
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	if l.current != nil && l.ffmpeg == ffmpeg && l.ffprobe == ffprobe {
		return l.current, nil
	}

	// The encoders under way run the old binary, which may be gone; the player
	// asks again and gets the new one.
	if l.current != nil {
		l.current.Destroy()
		l.current = nil
	}

	logger := l.logger
	c, err := cassette.New(&cassette.NewCassetteOptions{
		Logger:      &logger,
		HwAccelKind: l.hwAccel,
		TempOutDir:  l.dir,
		FfmpegPath:  ffmpeg,
		FfprobePath: ffprobe,
	})
	if err != nil {
		return nil, err
	}

	l.current, l.ffmpeg, l.ffprobe = c, ffmpeg, ffprobe

	return c, nil
}

func (l *lazyTranscoder) GetMaster(path, key string, info *videofile.MediaInfo, client, token string) (string, error) {
	c, err := l.get()
	if err != nil {
		return "", err
	}

	return c.GetMaster(path, key, info, client, token)
}

func (l *lazyTranscoder) GetVideoIndex(path, key string, info *videofile.MediaInfo, quality videofile.Quality, token string) (string, error) {
	c, err := l.get()
	if err != nil {
		return "", err
	}

	return c.GetVideoIndex(path, key, info, quality, token)
}

func (l *lazyTranscoder) GetAudioIndex(path, key string, info *videofile.MediaInfo, audio int32, token string) (string, error) {
	c, err := l.get()
	if err != nil {
		return "", err
	}

	return c.GetAudioIndex(path, key, info, audio, token)
}

func (l *lazyTranscoder) GetVideoSegment(ctx context.Context, path, key string, info *videofile.MediaInfo, quality videofile.Quality, segment int32, client string) (string, error) {
	c, err := l.get() //nolint:contextcheck // the transcoder outlives the request that made it
	if err != nil {
		return "", err
	}

	return c.GetVideoSegment(ctx, path, key, info, quality, segment, client)
}

func (l *lazyTranscoder) GetAudioSegment(ctx context.Context, path, key string, info *videofile.MediaInfo, audio, segment int32, client string) (string, error) {
	c, err := l.get() //nolint:contextcheck // the transcoder outlives the request that made it
	if err != nil {
		return "", err
	}

	return c.GetAudioSegment(ctx, path, key, info, audio, segment, client)
}

// Stop ends a file's encoders. With no transcoder made yet there are none.
func (l *lazyTranscoder) Stop(path string) {
	l.mu.Lock()
	c := l.current
	l.mu.Unlock()

	if c != nil {
		c.Stop(path)
	}
}

func (l *lazyTranscoder) close() {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.current != nil {
		l.current.Destroy()
		l.current = nil
	}
}
