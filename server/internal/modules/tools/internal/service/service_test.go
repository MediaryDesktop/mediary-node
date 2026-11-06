package service

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/tools/internal/manifest"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

// The test binary stands in for ffmpeg and ffprobe: asked for its version, it
// answers and exits.
const fakeProgramEnv = "TOOLS_FAKE_PROGRAM"

func TestMain(m *testing.M) {
	if os.Getenv(fakeProgramEnv) == "1" {
		_, _ = os.Stdout.WriteString("ffmpeg version 9.0.2\n")
		os.Exit(0)
	}

	os.Exit(m.Run())
}

const root = "ffmpeg-9.0.2/bin"

type fixture struct {
	dir      string
	server   *httptest.Server
	manifest *manifest.Manifest
	archive  []byte
}

// newFixture serves a zip with the programs in files, under root, and a
// manifest that points at it.
func newFixture(t *testing.T, files map[string][]byte) *fixture {
	t.Helper()

	var buf bytes.Buffer
	w := zip.NewWriter(&buf)
	for name, body := range files {
		f, err := w.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err = f.Write(body); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}

	fx := &fixture{dir: filepath.Join(t.TempDir(), "tools"), archive: buf.Bytes()}
	fx.server = httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, _ *http.Request) {
		_, _ = rw.Write(fx.archive)
	}))
	t.Cleanup(fx.server.Close)

	sum := sha256.Sum256(fx.archive)
	platform := manifest.Platform()
	fx.manifest = &manifest.Manifest{Packages: []manifest.Package{{
		ID:      "ffmpeg",
		Name:    "FFmpeg",
		Version: "9.0.2",
		Programs: []manifest.Program{
			{Name: "ffmpeg", VersionFlag: "-version"},
			{Name: "ffprobe", VersionFlag: "-version"},
		},
		Archives: map[string]manifest.Archive{platform: {
			URL:    fx.server.URL + "/ffmpeg.zip",
			SHA256: hex.EncodeToString(sum[:]),
			Size:   int64(len(fx.archive)),
			Format: "zip",
			Root:   root,
			Files:  []string{executable("ffmpeg", platform), executable("ffprobe", platform)},
		}},
	}}}

	return fx
}

func (fx *fixture) service(t *testing.T, configured map[string]string) *Service {
	t.Helper()

	s := New(zerolog.Nop(), nil, Options{
		Dir:        fx.dir,
		Manifest:   fx.manifest,
		Configured: configured,
		LookPath:   func(string) (string, error) { return "", exec.ErrNotFound },
	})
	t.Cleanup(s.Close)

	return s
}

// programs is a working ffmpeg and ffprobe — the test binary — under root.
func programs(t *testing.T) map[string][]byte {
	t.Helper()

	self, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	body, err := os.ReadFile(self)
	if err != nil {
		t.Fatal(err)
	}

	t.Setenv(fakeProgramEnv, "1")

	platform := manifest.Platform()

	return map[string][]byte{
		root + "/" + executable("ffmpeg", platform):  body,
		root + "/" + executable("ffprobe", platform): body,
		root + "/../../escape.txt":                   []byte("never written"),
		"ffmpeg-9.0.2/doc/readme.txt":                []byte("not taken"),
	}
}

func waitInstalled(t *testing.T, s *Service) Tool {
	t.Helper()

	deadline := time.Now().Add(30 * time.Second)
	for time.Now().Before(deadline) {
		tool, err := s.Tool("ffmpeg")
		if err != nil {
			t.Fatal(err)
		}
		if tool.State != "installing" {
			return *tool
		}
		time.Sleep(20 * time.Millisecond)
	}

	t.Fatal("the install did not finish")

	return Tool{}
}

func TestInstallPutsTheProgramsInUse(t *testing.T) {
	fx := newFixture(t, programs(t))
	s := fx.service(t, nil)

	if _, err := s.Path("ffmpeg"); !errors.Is(err, exec.ErrNotFound) {
		t.Fatalf("before the install: %v, want not found", err)
	}

	if _, err := s.Install("ffmpeg"); err != nil {
		t.Fatal(err)
	}

	tool := waitInstalled(t, s)
	if tool.State != "installed" || tool.Version != "9.0.2" || tool.Error != "" || tool.Update {
		t.Fatalf("after the install: %+v", tool)
	}

	path, err := s.Path("ffprobe")
	if err != nil {
		t.Fatal(err)
	}
	if want := filepath.Join(fx.dir, "ffmpeg", "9.0.2", executable("ffprobe", manifest.Platform())); path != want {
		t.Fatalf("ffprobe is at %s, want %s", path, want)
	}

	// Only the listed files are taken out; nothing lands beside the folder.
	entries, err := os.ReadDir(filepath.Join(fx.dir, "ffmpeg", "9.0.2"))
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 2 {
		t.Fatalf("the install holds %d files, want 2", len(entries))
	}
	if _, err := os.Stat(filepath.Join(filepath.Dir(fx.dir), "escape.txt")); err == nil {
		t.Fatal("an entry outside the root was written")
	}
	if _, err := os.Stat(filepath.Join(fx.dir, downloadDir, "ffmpeg-9.0.2.part")); err == nil {
		t.Fatal("the download was left behind")
	}

	// A restart finds the install again.
	again := fx.service(t, nil)
	if tool, _ := again.Tool("ffmpeg"); tool.State != "installed" || tool.Version != "9.0.2" {
		t.Fatalf("after a restart: %+v", tool)
	}
}

func TestChecksumMismatchInstallsNothing(t *testing.T) {
	fx := newFixture(t, programs(t))
	pkg := &fx.manifest.Packages[0]
	archive := pkg.Archives[manifest.Platform()]
	archive.SHA256 = strings.Repeat("0", 64)
	pkg.Archives[manifest.Platform()] = archive

	s := fx.service(t, nil)
	if _, err := s.Install("ffmpeg"); err != nil {
		t.Fatal(err)
	}

	tool := waitInstalled(t, s)
	if tool.State != "missing" || !strings.Contains(tool.Error, "checksum") {
		t.Fatalf("after a bad download: %+v", tool)
	}

	entries, _ := os.ReadDir(filepath.Join(fx.dir, "ffmpeg"))
	if len(entries) != 0 {
		t.Fatalf("a bad download left %d entries", len(entries))
	}
}

func TestProgramThatDoesNotRunIsRefused(t *testing.T) {
	platform := manifest.Platform()
	fx := newFixture(t, map[string][]byte{
		root + "/" + executable("ffmpeg", platform):  []byte("not a program"),
		root + "/" + executable("ffprobe", platform): []byte("not a program"),
	})
	s := fx.service(t, nil)

	if _, err := s.Install("ffmpeg"); err != nil {
		t.Fatal(err)
	}

	tool := waitInstalled(t, s)
	if tool.State != "missing" || !strings.Contains(tool.Error, "does not run") {
		t.Fatalf("after a broken build: %+v", tool)
	}
	if _, err := os.Stat(filepath.Join(fx.dir, "ffmpeg", "9.0.2")); err == nil {
		t.Fatal("a broken build was put in place")
	}
}

func TestArchiveWithoutAProgramIsRefused(t *testing.T) {
	platform := manifest.Platform()
	fx := newFixture(t, map[string][]byte{
		root + "/" + executable("ffmpeg", platform): []byte("only one"),
	})
	s := fx.service(t, nil)

	if _, err := s.Install("ffmpeg"); err != nil {
		t.Fatal(err)
	}

	if tool := waitInstalled(t, s); !strings.Contains(tool.Error, "has no "+executable("ffprobe", platform)) {
		t.Fatalf("after an archive without ffprobe: %+v", tool)
	}
}

func TestCancelLeavesNothing(t *testing.T) {
	fx := newFixture(t, programs(t))

	// The server sends a little and then holds the download open.
	release := make(chan struct{})
	fx.server.Config.Handler = http.HandlerFunc(func(rw http.ResponseWriter, _ *http.Request) {
		rw.Header().Set("Content-Length", "")
		_, _ = rw.Write(fx.archive[:1024])
		rw.(http.Flusher).Flush()
		<-release
	})
	t.Cleanup(func() { close(release) })

	s := fx.service(t, nil)
	if _, err := s.Install("ffmpeg"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Install("ffmpeg"); apperr.KindOf(err) != apperr.KindConflict {
		t.Fatalf("a second install: %v, want a conflict", err)
	}

	if _, err := s.Cancel("ffmpeg"); err != nil {
		t.Fatal(err)
	}

	tool := waitInstalled(t, s)
	if tool.State != "missing" || tool.Error != "" {
		t.Fatalf("after cancelling: %+v", tool)
	}

	if entries, _ := os.ReadDir(filepath.Join(fx.dir, downloadDir)); len(entries) != 0 {
		t.Fatalf("cancelling left %d downloads", len(entries))
	}
}

func TestStartClearsWhatAnInstallLeft(t *testing.T) {
	fx := newFixture(t, programs(t))
	base := filepath.Join(fx.dir, "ffmpeg")
	program := executable("ffmpeg", manifest.Platform())

	for _, dir := range []string{"9.0.1", "9.0.2.tmp", "8.0"} {
		if err := os.MkdirAll(filepath.Join(base, dir), 0o750); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(base, "9.0.1", program), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(base, currentFile), []byte("9.0.1\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(fx.dir, downloadDir), 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(fx.dir, downloadDir, "ffmpeg-9.0.2.part"), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}

	s := fx.service(t, nil)

	entries, _ := os.ReadDir(base)
	if len(entries) != 2 {
		t.Fatalf("after the start the package folder holds %d entries, want the version and its marker", len(entries))
	}
	if _, err := os.Stat(filepath.Join(fx.dir, downloadDir)); err == nil {
		t.Fatal("the downloads folder survived the start")
	}

	tool, _ := s.Tool("ffmpeg")
	if tool.State != "installed" || tool.Version != "9.0.1" || !tool.Update {
		t.Fatalf("an older install: %+v", tool)
	}
}

func TestRemoveFallsBackToPath(t *testing.T) {
	fx := newFixture(t, programs(t))
	s := fx.service(t, nil)

	if _, err := s.Install("ffmpeg"); err != nil {
		t.Fatal(err)
	}
	waitInstalled(t, s)

	tool, err := s.Remove("ffmpeg")
	if err != nil {
		t.Fatal(err)
	}
	if tool.State != "missing" {
		t.Fatalf("after removing: %+v", tool)
	}
	if _, err := os.Stat(filepath.Join(fx.dir, "ffmpeg", "9.0.2")); err == nil {
		t.Fatal("the files stayed")
	}

	if _, err := s.Remove("ffmpeg"); apperr.KindOf(err) != apperr.KindNotFound {
		t.Fatalf("removing twice: %v, want not found", err)
	}
}

func TestConfiguredPathWins(t *testing.T) {
	fx := newFixture(t, programs(t))
	configured := filepath.Join(t.TempDir(), "my-ffmpeg")
	if err := os.WriteFile(configured, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}

	s := fx.service(t, map[string]string{"ffmpeg": configured})

	if path, err := s.Path("ffmpeg"); err != nil || path != configured {
		t.Fatalf("ffmpeg: %s, %v; want the configured path", path, err)
	}

	tool, _ := s.Tool("ffmpeg")
	if tool.State != "custom" {
		t.Fatalf("with a path set by hand: %+v", tool)
	}

	if _, err := s.Install("ffmpeg"); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("install with a path set by hand: %v, want refused", err)
	}

	// A path set by hand that is not there is said so, not passed over for PATH.
	broken := fx.service(t, map[string]string{"ffmpeg": filepath.Join(t.TempDir(), "gone")})
	_, err := broken.Path("ffmpeg")

	var missing *MissingError
	if !errors.As(err, &missing) || !strings.Contains(err.Error(), "NODE_FFMPEG_PATH") {
		t.Fatalf("a configured path that is gone: %v", err)
	}
}

func TestMissingProgramSaysWhereToInstallIt(t *testing.T) {
	fx := newFixture(t, programs(t))
	s := fx.service(t, nil)

	_, err := s.Path("ffprobe")
	if !errors.Is(err, exec.ErrNotFound) {
		t.Fatalf("%v, want not found", err)
	}
	if !strings.Contains(err.Error(), "install FFmpeg on the Extensions page") {
		t.Fatalf("the message does not say what to do: %v", err)
	}
}
