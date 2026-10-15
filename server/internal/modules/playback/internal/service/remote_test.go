package service

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/playback/internal/videofile"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

// The link a debrid service gave; nothing but the proxy may see it.
const serviceLink = "https://cdn.debrid.example/dl/abc?token=secret"

func remoteFile() *PlayableFile {
	return &PlayableFile{
		ID:       -3,
		Path:     serviceLink,
		Title:    "Show - 05.mkv",
		MediaRef: "anilist:1",
		Episode:  episodeOf(5),
		Remote:   true,
		Key:      "stream-abc-0",
	}
}

func localURL(fileID int64) string {
	return fmt.Sprintf("http://127.0.0.1:43711/v1/playback/files/%d/direct?token=t", fileID)
}

type countingProber struct {
	mu    sync.Mutex
	paths []string
}

func (p *countingProber) Info(_ context.Context, path string) (*videofile.MediaInfo, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.paths = append(p.paths, path)

	return &videofile.MediaInfo{Path: path, Extension: "mkv?token=t", Duration: 1440}, nil
}

func TestStreamIsProbedThroughTheNodeOnceAndKeepsItsName(t *testing.T) {
	prober := &countingProber{}
	svc := New(zerolog.Nop(), events.NewHub(8), Options{Library: fakeLibrary{file: remoteFile()}, Prober: prober, LocalURL: localURL})

	for range 2 {
		stream, err := svc.Stream(context.Background(), -3)
		if err != nil {
			t.Fatal(err)
		}
		if stream.DirectURL != "/v1/playback/files/-3/direct" || stream.Info.Extension != "mkv" {
			t.Errorf("stream = %+v, info %+v", stream, stream.Info)
		}
	}

	if len(prober.paths) != 1 || prober.paths[0] != localURL(-3) {
		t.Errorf("probed %v, want the node's own address once", prober.paths)
	}
}

func TestStreamPlaysInMPVThroughTheNode(t *testing.T) {
	launcher := &fakeLauncher{}
	svc := New(zerolog.Nop(), events.NewHub(8), Options{Launcher: launcher, Library: fakeLibrary{file: remoteFile()}, LocalURL: localURL})

	status, err := svc.Start(context.Background(), -3)
	if err != nil {
		t.Fatal(err)
	}
	defer svc.Stop()

	if len(launcher.paths) != 1 || launcher.paths[0] != localURL(-3) {
		t.Errorf("mpv got %v", launcher.paths)
	}
	if status.Session.Path != "Show - 05.mkv" {
		t.Errorf("session path = %q, want the name rather than the service's link", status.Session.Path)
	}
}

func TestStreamDirectSourceIsTheServiceLink(t *testing.T) {
	source, err := newStreamService(remoteFile(), nil).DirectSource(context.Background(), -3)
	if err != nil {
		t.Fatal(err)
	}
	if !source.Remote || source.Path != serviceLink || source.Name != "Show - 05.mkv" {
		t.Errorf("source = %+v", source)
	}
}

func TestStreamHasNoStill(t *testing.T) {
	svc := New(zerolog.Nop(), events.NewHub(8), Options{Library: fakeLibrary{file: remoteFile()}, Thumbnailer: &videofile.Thumbnailer{}})

	if _, err := svc.ThumbnailPath(context.Background(), -3); apperr.KindOf(err) != apperr.KindNotFound {
		t.Errorf("err = %v, want not found", err)
	}
}

func TestStreamWithoutALocalAddressIsRefused(t *testing.T) {
	svc := New(zerolog.Nop(), events.NewHub(8), Options{Launcher: &fakeLauncher{}, Library: fakeLibrary{file: remoteFile()}})

	if _, err := svc.Start(context.Background(), -3); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Errorf("err = %v, want precondition", err)
	}
}
