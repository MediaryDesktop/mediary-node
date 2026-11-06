package service

import (
	"archive/zip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/bodgit/sevenzip"

	"github.com/mediaryorg/mediary-node/server/internal/modules/tools/internal/manifest"
	"github.com/mediaryorg/mediary-node/server/internal/platform/childenv"
)

const (
	downloadDir = ".download"

	// How long a program has to print its version. A build that hangs on
	// --version would hang on every file too.
	checkTimeout = 15 * time.Second

	// No file the node takes out of an archive is this large; a bigger one is a
	// broken or hostile archive, not a program.
	maxFileSize = 1 << 30

	publishInterval = 500 * time.Millisecond
)

// install downloads, checks and unpacks one package, then switches the node to
// it. Until the last step the version in use stays as it was, and whatever goes
// wrong leaves nothing of the new one behind.
func (s *Service) install(ctx context.Context, pkg *manifest.Package, archive manifest.Archive, j *job) error {
	base := filepath.Join(s.opts.Dir, pkg.ID)

	downloads := filepath.Join(s.opts.Dir, downloadDir)
	if err := os.MkdirAll(downloads, 0o750); err != nil {
		return fmt.Errorf("create the download folder: %w", err)
	}

	part := filepath.Join(downloads, pkg.ID+"-"+pkg.Version+".part")
	defer func() { _ = os.Remove(part) }()

	if err := s.download(ctx, archive, part, j); err != nil {
		return err
	}

	s.stage(j, "extracting")

	staging := filepath.Join(base, pkg.Version+".tmp")
	if err := os.RemoveAll(staging); err != nil {
		return fmt.Errorf("clear %s: %w", staging, err)
	}
	defer func() { _ = os.RemoveAll(staging) }()

	if err := extract(archive, part, staging); err != nil {
		return err
	}

	if err := ctx.Err(); err != nil {
		return err
	}

	s.stage(j, "checking")

	for _, program := range pkg.Programs {
		if err := check(ctx, filepath.Join(staging, executable(program.Name, s.opts.Platform)), program); err != nil {
			return err
		}
	}

	target := filepath.Join(base, pkg.Version)
	if err := os.RemoveAll(target); err != nil {
		return fmt.Errorf("%s %s is in use: close it and try again: %w", pkg.Name, pkg.Version, err)
	}
	if err := os.Rename(staging, target); err != nil {
		return fmt.Errorf("move %s into place: %w", pkg.Name, err)
	}

	if err := writeCurrent(base, pkg.Version); err != nil {
		_ = os.RemoveAll(target)
		return err
	}

	s.mu.Lock()
	s.current[pkg.ID] = pkg.Version
	s.mu.Unlock()

	s.removeOthers(base, pkg.Version)

	return nil
}

func (s *Service) download(ctx context.Context, archive manifest.Archive, part string, j *job) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, archive.URL, http.NoBody)
	if err != nil {
		return fmt.Errorf("build the download request: %w", err)
	}

	resp, err := s.opts.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("download %s: %w", archive.URL, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download %s: the server answered %s", archive.URL, resp.Status)
	}

	if resp.ContentLength > 0 && resp.ContentLength != archive.Size {
		return fmt.Errorf("download %s: the server offers %d bytes, %d expected", archive.URL, resp.ContentLength, archive.Size)
	}

	file, err := os.Create(part) //nolint:gosec // the node's own download folder
	if err != nil {
		return fmt.Errorf("create %s: %w", part, err)
	}

	hash := sha256.New()
	counter := &progressWriter{service: s, job: j}

	// One byte past the size is enough to know the download is not the file the
	// manifest describes.
	written, err := io.Copy(io.MultiWriter(file, hash, counter), io.LimitReader(resp.Body, archive.Size+1))
	closeErr := file.Close()

	if err != nil {
		return fmt.Errorf("download %s: %w", archive.URL, err)
	}
	if closeErr != nil {
		return fmt.Errorf("write %s: %w", part, closeErr)
	}

	s.stage(j, "verifying")

	if written != archive.Size {
		return fmt.Errorf("download %s: got %d bytes, %d expected", archive.URL, written, archive.Size)
	}

	if sum := hex.EncodeToString(hash.Sum(nil)); !strings.EqualFold(sum, archive.SHA256) {
		return fmt.Errorf("the download does not match its checksum (%s, %s expected); nothing was installed", sum, archive.SHA256)
	}

	return nil
}

type progressWriter struct {
	service *Service
	job     *job
}

func (w *progressWriter) Write(p []byte) (int, error) {
	s := w.service
	now := s.opts.Now()

	s.mu.Lock()
	w.job.done += int64(len(p))
	due := now.Sub(w.job.publishedAt) >= publishInterval
	if due {
		w.job.publishedAt = now
	}
	s.mu.Unlock()

	if due {
		s.publish(w.job.id)
	}

	return len(p), nil
}

func (s *Service) stage(j *job, stage string) {
	s.mu.Lock()
	j.stage = stage
	s.mu.Unlock()

	s.publish(j.id)
}

// entry is one file of an archive, whichever format it came in.
type entry struct {
	name string
	open func() (io.ReadCloser, error)
}

// extract takes the archive's listed files, and only those, into dir. The paths
// written are the manifest's, never the archive's, so an entry named to climb
// out of the folder has nowhere to go.
func extract(archive manifest.Archive, file, dir string) error {
	want := make(map[string]string, len(archive.Files))
	for _, name := range archive.Files {
		want[path.Join(archive.Root, name)] = name
	}

	take := func(e entry) error {
		name, ok := want[strings.ReplaceAll(e.name, "\\", "/")]
		if !ok {
			return nil
		}
		delete(want, strings.ReplaceAll(e.name, "\\", "/"))

		return writeEntry(e, filepath.Join(dir, filepath.FromSlash(name)))
	}

	switch archive.Format {
	case "zip":
		reader, err := zip.OpenReader(file)
		if err != nil {
			return fmt.Errorf("open the archive: %w", err)
		}
		defer func() { _ = reader.Close() }()

		for _, f := range reader.File {
			if err := take(entry{name: f.Name, open: f.Open}); err != nil {
				return err
			}
		}
	case "7z":
		reader, err := sevenzip.OpenReader(file)
		if err != nil {
			return fmt.Errorf("open the archive: %w", err)
		}
		defer func() { _ = reader.Close() }()

		for _, f := range reader.File {
			if err := take(entry{name: f.Name, open: f.Open}); err != nil {
				return err
			}
		}
	default:
		return fmt.Errorf("the archive format %q is not one the node reads", archive.Format)
	}

	for _, name := range want {
		return fmt.Errorf("the archive has no %s", name)
	}

	return nil
}

func writeEntry(e entry, out string) error {
	if err := os.MkdirAll(filepath.Dir(out), 0o750); err != nil {
		return fmt.Errorf("create %s: %w", filepath.Dir(out), err)
	}

	src, err := e.open()
	if err != nil {
		return fmt.Errorf("read %s from the archive: %w", e.name, err)
	}
	defer func() { _ = src.Close() }()

	dst, err := os.OpenFile(out, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o755) //nolint:gosec // a program the node runs has to be executable
	if err != nil {
		return fmt.Errorf("create %s: %w", out, err)
	}

	written, err := io.Copy(dst, io.LimitReader(src, maxFileSize+1))
	closeErr := dst.Close()

	if err != nil {
		return fmt.Errorf("unpack %s: %w", e.name, err)
	}
	if written > maxFileSize {
		return fmt.Errorf("unpack %s: the file is larger than any program", e.name)
	}
	if closeErr != nil {
		return fmt.Errorf("write %s: %w", out, closeErr)
	}

	return nil
}

// check runs the program the way the node will, to prove the files work on this
// machine before anything switches to them.
func check(ctx context.Context, binary string, program manifest.Program) error {
	ctx, cancel := context.WithTimeout(ctx, checkTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, binary, program.VersionFlag) //nolint:gosec // a binary the node just verified against its checksum
	hideWindow(cmd)
	childenv.Apply(cmd)

	output, err := cmd.CombinedOutput()
	if ctxErr := ctx.Err(); errors.Is(ctxErr, context.Canceled) {
		return ctxErr
	}
	if err != nil {
		return fmt.Errorf("%s does not run on this machine: %w: %s", program.Name, err, firstLine(output))
	}

	return nil
}

func firstLine(output []byte) string {
	line, _, _ := strings.Cut(strings.TrimSpace(string(output)), "\n")
	return strings.TrimSpace(line)
}

// writeCurrent switches the package to version in one rename, so the marker is
// never half written.
func writeCurrent(base, version string) error {
	tmp := filepath.Join(base, currentFile+".tmp")
	if err := os.WriteFile(tmp, []byte(version+"\n"), 0o600); err != nil {
		return fmt.Errorf("save the installed version: %w", err)
	}

	if err := os.Rename(tmp, filepath.Join(base, currentFile)); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("save the installed version: %w", err)
	}

	return nil
}

// removeOthers deletes every version of a package but keep. One still running
// stays, and goes on the next start.
func (s *Service) removeOthers(base, keep string) {
	entries, err := os.ReadDir(base)
	if err != nil {
		return
	}

	for _, e := range entries {
		if e.Name() == keep || e.Name() == currentFile {
			continue
		}

		if err := os.RemoveAll(filepath.Join(base, e.Name())); err != nil {
			s.logger.Debug().Err(err).Str("path", e.Name()).Msg("an old version stays until the next start")
		}
	}
}
