package service

import (
	"context"
	"fmt"
	"os/exec"
	"testing"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/playback/internal/videofile"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

type fakeProber struct {
	info *videofile.MediaInfo
	err  error
}

func (f fakeProber) Info(context.Context, string) (*videofile.MediaInfo, error) {
	return f.info, f.err
}

func newStreamService(file *PlayableFile, prober Prober) *Service {
	return New(zerolog.Nop(), events.NewHub(8), Options{Library: fakeLibrary{file: file}, Prober: prober})
}

func TestStreamDescribesTheFileAndWhereToFetchIt(t *testing.T) {
	codec := `video/matroska; codecs="avc1.640028, mp4a.40.2"`
	file := &PlayableFile{ID: 7, Path: "/library/Show - 01.mkv", Title: "Show", MediaRef: "anilist:1", Episode: episodeOf(1)}

	stream, err := newStreamService(file, fakeProber{info: &videofile.MediaInfo{MimeCodec: &codec}}).
		Stream(context.Background(), 7)
	if err != nil {
		t.Fatalf("stream: %v", err)
	}

	if stream.DirectURL != "/v1/playback/files/7/direct" {
		t.Errorf("direct url = %q", stream.DirectURL)
	}
	if stream.Info.MimeCodec == nil || *stream.Info.MimeCodec != codec {
		t.Errorf("info = %+v", stream.Info)
	}
	if stream.MediaRef != "anilist:1" || stream.Episode == nil || *stream.Episode != 1 {
		t.Errorf("stream lost the match: %+v", stream)
	}
}

// Without ffprobe the user has something to install, not a bug to report.
func TestStreamSaysWhatToInstallWhenFFprobeIsMissing(t *testing.T) {
	file := &PlayableFile{ID: 7, Path: "/library/Show - 01.mkv"}
	missing := fmt.Errorf("probe: %w", exec.ErrNotFound)

	_, err := newStreamService(file, fakeProber{err: missing}).Stream(context.Background(), 7)

	if apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("error kind = %v (%v), want precondition", apperr.KindOf(err), err)
	}
}

func TestDirectRefusesAFileTheScanLost(t *testing.T) {
	file := &PlayableFile{ID: 7, Path: "/library/Show - 01.mkv", Missing: true}

	_, err := newStreamService(file, nil).DirectPath(context.Background(), 7)

	if apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("error kind = %v, want precondition", apperr.KindOf(err))
	}
}
