package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/tools/internal/manifest"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

// The node's own settings that point at a program by hand. They win over what
// the node installed, because whoever set one meant that build.
var envOf = map[string]string{
	"mpv":     "NODE_MPV_PATH",
	"ffmpeg":  "NODE_FFMPEG_PATH",
	"ffprobe": "NODE_FFPROBE_PATH",
}

// currentFile names the installed version inside a package's folder. Writing it
// is the last step of an install, so a folder without it is never used.
const currentFile = "current"

type Options struct {
	// Dir holds a folder per package, a folder per version in it, and the
	// downloads under way. Empty leaves the disk alone: only configured paths and
	// PATH are looked at.
	Dir string

	Manifest *manifest.Manifest
	Platform string

	// Configured are the paths set by hand, by program.
	Configured map[string]string

	HTTP     *http.Client
	LookPath func(file string) (string, error)
	Now      func() time.Time
}

type Service struct {
	logger zerolog.Logger
	hub    *events.Hub
	opts   Options

	mu sync.Mutex
	// The installed version of each package, by id.
	current map[string]string
	jobs    map[string]*job
	// Why the last install of a package failed, until the next one starts.
	failed map[string]string
	closed bool
	wg     sync.WaitGroup
}

type job struct {
	id     string
	cancel context.CancelFunc

	stage       string
	done, total int64
	publishedAt time.Time
}

// Tool is one package as the user sees it: whether its programs are there, and
// what the node can do about it.
type Tool struct {
	ID       string   `json:"id" enum:"mpv,ffmpeg"`
	Name     string   `json:"name"`
	Author   string   `json:"author" doc:"Whose build the node installs."`
	Programs []string `json:"programs" doc:"What the package gives the node; FFmpeg's has ffprobe too."`
	State    string   `json:"state" enum:"missing,system,installed,custom,installing" doc:"custom: a path is set by hand, which wins; installed: the node's own copy; system: found on PATH."`
	Version  string   `json:"version,omitempty" doc:"The version the node installed."`
	Path     string   `json:"path,omitempty" doc:"Where the node finds the first program now."`
	Env      []string `json:"env" doc:"The settings that point the node at the programs by hand."`

	Supported bool   `json:"supported" doc:"Whether the node can install the package on this system."`
	Available string `json:"available,omitempty" doc:"The version the node would install."`
	Update    bool   `json:"update" doc:"The node's copy is older than the one it would install."`
	Size      int64  `json:"size,omitempty" doc:"Size of the download in bytes."`
	Hint      string `json:"hint,omitempty" doc:"The command that installs it by hand, where the node cannot."`

	Progress *ToolProgress `json:"progress,omitempty"`
	Error    string        `json:"error,omitempty" doc:"Why the last install failed."`
}

type ToolProgress struct {
	Stage string `json:"stage" enum:"downloading,verifying,extracting,checking"`
	Done  int64  `json:"done" doc:"Bytes downloaded."`
	Total int64  `json:"total" doc:"Bytes to download."`
}

func New(logger zerolog.Logger, hub *events.Hub, opts Options) *Service {
	if opts.Platform == "" {
		opts.Platform = manifest.Platform()
	}
	if opts.HTTP == nil {
		opts.HTTP = &http.Client{}
	}
	if opts.LookPath == nil {
		opts.LookPath = exec.LookPath
	}
	if opts.Now == nil {
		opts.Now = time.Now
	}

	s := &Service{
		logger:  logger,
		hub:     hub,
		opts:    opts,
		current: map[string]string{},
		jobs:    map[string]*job{},
		failed:  map[string]string{},
	}

	if opts.Dir != "" {
		s.load()
	}

	return s
}

// load reads which versions are installed and clears what an install cut short,
// or an old version a running program kept from being removed, left behind.
func (s *Service) load() {
	_ = os.RemoveAll(filepath.Join(s.opts.Dir, downloadDir))

	for _, pkg := range s.opts.Manifest.Packages {
		base := filepath.Join(s.opts.Dir, pkg.ID)

		raw, err := os.ReadFile(filepath.Join(base, currentFile)) //nolint:gosec // the node's own tools folder
		version := strings.TrimSpace(string(raw))
		if err == nil && version != "" && isDir(filepath.Join(base, version)) {
			s.current[pkg.ID] = version
		} else {
			version = ""
		}

		s.removeOthers(base, version)
	}
}

// MissingError is a program the node has nowhere to run from. Its message is
// what the user has to do, so whoever shows it shows it as it is.
type MissingError struct {
	Program    string
	Package    string
	Env        string
	Configured string
}

func (e *MissingError) Error() string {
	if e.Configured != "" {
		return fmt.Sprintf("%s was not found at %s, the path %s sets", e.Program, e.Configured, e.Env)
	}

	if e.Package != "" {
		return fmt.Sprintf("%s was not found: install %s on the Extensions page, under Dependencies, or set %s", e.Program, e.Package, e.Env)
	}

	return fmt.Sprintf("%s was not found: install it or set %s", e.Program, e.Env)
}

// MissingProgram lets a module that cannot import this one tell the error apart.
func (e *MissingError) MissingProgram() string { return e.Program }

func (e *MissingError) Unwrap() error { return exec.ErrNotFound }

// Path is where a program runs from now: the path set by hand, else the node's
// own copy, else PATH. It is asked on every use, so a program installed while
// the node runs is used at once.
func (s *Service) Path(program string) (string, error) {
	pkg := s.packageOf(program)

	if configured := s.opts.Configured[program]; configured != "" {
		if isFile(configured) {
			return configured, nil
		}

		return "", &MissingError{Program: program, Env: envOf[program], Configured: configured}
	}

	if path := s.installedPath(pkg, program); path != "" {
		return path, nil
	}

	if path, err := s.opts.LookPath(program); err == nil {
		return path, nil
	}

	missing := &MissingError{Program: program, Env: envOf[program]}
	if pkg != nil {
		missing.Package = pkg.Name
	}

	return "", missing
}

func (s *Service) installedPath(pkg *manifest.Package, program string) string {
	if pkg == nil || s.opts.Dir == "" {
		return ""
	}

	s.mu.Lock()
	version := s.current[pkg.ID]
	s.mu.Unlock()

	if version == "" {
		return ""
	}

	path := filepath.Join(s.opts.Dir, pkg.ID, version, executable(program, s.opts.Platform))
	if !isFile(path) {
		return ""
	}

	return path
}

func (s *Service) packageOf(program string) *manifest.Package {
	for i := range s.opts.Manifest.Packages {
		for _, p := range s.opts.Manifest.Packages[i].Programs {
			if p.Name == program {
				return &s.opts.Manifest.Packages[i]
			}
		}
	}

	return nil
}

func (s *Service) List() []Tool {
	out := make([]Tool, 0, len(s.opts.Manifest.Packages))
	for i := range s.opts.Manifest.Packages {
		out = append(out, s.view(&s.opts.Manifest.Packages[i]))
	}

	return out
}

func (s *Service) Tool(id string) (*Tool, error) {
	pkg, ok := s.opts.Manifest.Package(id)
	if !ok {
		return nil, apperr.New(apperr.KindNotFound, "the node has no tool %q", id)
	}

	tool := s.view(pkg)

	return &tool, nil
}

func (s *Service) view(pkg *manifest.Package) Tool {
	tool := Tool{ID: pkg.ID, Name: pkg.Name, Author: pkg.Author, Env: []string{}}

	for _, p := range pkg.Programs {
		tool.Programs = append(tool.Programs, p.Name)
		tool.Env = append(tool.Env, envOf[p.Name])
	}

	if archive, ok := pkg.Archives[s.opts.Platform]; ok && s.opts.Dir != "" {
		tool.Supported, tool.Available, tool.Size = true, pkg.Version, archive.Size
	} else {
		tool.Hint = pkg.Hints[runtime.GOOS]
	}

	s.mu.Lock()
	tool.Version = s.current[pkg.ID]
	tool.Error = s.failed[pkg.ID]
	if j := s.jobs[pkg.ID]; j != nil {
		tool.Progress = &ToolProgress{Stage: j.stage, Done: j.done, Total: j.total}
	}
	s.mu.Unlock()

	first := pkg.Programs[0].Name
	tool.Path, _ = s.Path(first)

	switch {
	case tool.Progress != nil:
		tool.State = "installing"
	case s.configured(pkg):
		tool.State = "custom"
	case tool.Version != "" && s.installedPath(pkg, first) != "":
		tool.State = "installed"
	case tool.Path != "":
		tool.State = "system"
	default:
		tool.State = "missing"
	}

	tool.Update = tool.State == "installed" && tool.Supported && tool.Version != tool.Available

	return tool
}

func (s *Service) configured(pkg *manifest.Package) bool {
	for _, p := range pkg.Programs {
		if s.opts.Configured[p.Name] != "" {
			return true
		}
	}

	return false
}

// Install downloads the package's archive for this system and sets its programs
// up in the node's folder. It returns at once; the progress is in the tool's
// state and in the tools events.
func (s *Service) Install(id string) (*Tool, error) {
	pkg, ok := s.opts.Manifest.Package(id)
	if !ok {
		return nil, apperr.New(apperr.KindNotFound, "the node has no tool %q", id)
	}

	archive, ok := pkg.Archives[s.opts.Platform]
	if !ok || s.opts.Dir == "" {
		return nil, apperr.New(apperr.KindPrecondition, "the node cannot install %s on this system", pkg.Name)
	}

	if s.configured(pkg) {
		return nil, apperr.New(apperr.KindPrecondition, "%s is set by hand in %s; unset it for the node to install its own",
			pkg.Name, strings.Join(s.view(pkg).Env, " or "))
	}

	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return nil, apperr.New(apperr.KindUnavailable, "the node is shutting down")
	}
	if s.jobs[id] != nil {
		s.mu.Unlock()
		return nil, apperr.New(apperr.KindConflict, "%s is already being installed", pkg.Name)
	}

	ctx, cancel := context.WithCancel(context.Background())
	j := &job{id: id, cancel: cancel, stage: "downloading", total: archive.Size}
	s.jobs[id] = j
	delete(s.failed, id)
	s.wg.Add(1)
	s.mu.Unlock()

	go s.run(ctx, pkg, archive, j)

	s.publish(id)

	return s.Tool(id)
}

func (s *Service) run(ctx context.Context, pkg *manifest.Package, archive manifest.Archive, j *job) {
	defer s.wg.Done()
	defer j.cancel()

	err := s.install(ctx, pkg, archive, j)

	s.mu.Lock()
	delete(s.jobs, pkg.ID)
	// Cancelled by the user is not a failure to show.
	if err != nil && !errors.Is(err, context.Canceled) {
		s.failed[pkg.ID] = err.Error()
	}
	s.mu.Unlock()

	switch {
	case err == nil:
		s.logger.Info().Str("tool", pkg.ID).Str("version", pkg.Version).Msg("installed")
	case errors.Is(err, context.Canceled):
		s.logger.Info().Str("tool", pkg.ID).Msg("install cancelled")
	default:
		s.logger.Warn().Err(err).Str("tool", pkg.ID).Msg("install failed")
	}

	s.publish(pkg.ID)
}

// Cancel stops the package's install under way; nothing of it stays on disk.
func (s *Service) Cancel(id string) (*Tool, error) {
	if _, ok := s.opts.Manifest.Package(id); !ok {
		return nil, apperr.New(apperr.KindNotFound, "the node has no tool %q", id)
	}

	s.mu.Lock()
	j := s.jobs[id]
	s.mu.Unlock()

	if j == nil {
		return nil, apperr.New(apperr.KindConflict, "%s is not being installed", id)
	}

	j.cancel()

	return s.Tool(id)
}

// Remove deletes the node's copy of the package; its programs come from PATH
// again, if they are there.
func (s *Service) Remove(id string) (*Tool, error) {
	pkg, ok := s.opts.Manifest.Package(id)
	if !ok {
		return nil, apperr.New(apperr.KindNotFound, "the node has no tool %q", id)
	}

	s.mu.Lock()
	if s.jobs[id] != nil {
		s.mu.Unlock()
		return nil, apperr.New(apperr.KindConflict, "%s is being installed; cancel that first", pkg.Name)
	}
	version := s.current[id]
	delete(s.current, id)
	delete(s.failed, id)
	s.mu.Unlock()

	if version == "" {
		return nil, apperr.New(apperr.KindNotFound, "the node has not installed %s", pkg.Name)
	}

	base := filepath.Join(s.opts.Dir, id)
	if err := os.Remove(filepath.Join(base, currentFile)); err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, apperr.Wrap(err, apperr.KindInternal, "could not remove %s", pkg.Name)
	}

	// The marker is gone, so the folder is no longer used. A program still running
	// from it can keep it on Windows; the next start clears it then.
	if err := os.RemoveAll(filepath.Join(base, version)); err != nil {
		s.logger.Warn().Err(err).Str("tool", id).Msg("the old files stay until the node restarts")
	}

	s.logger.Info().Str("tool", id).Str("version", version).Msg("removed")
	s.publish(id)

	return s.Tool(id)
}

// Close stops every install and waits for it to clean up.
func (s *Service) Close() {
	s.mu.Lock()
	s.closed = true
	for _, j := range s.jobs {
		j.cancel()
	}
	s.mu.Unlock()

	s.wg.Wait()
}

func (s *Service) publish(id string) {
	if s.hub == nil {
		return
	}

	payload := map[string]any{"id": id}

	s.mu.Lock()
	if j := s.jobs[id]; j != nil {
		payload["stage"], payload["done"], payload["total"] = j.stage, j.done, j.total
	}
	s.mu.Unlock()

	s.hub.Publish(events.TopicTools, payload)
}

func executable(program, platform string) string {
	if strings.HasPrefix(platform, "windows/") {
		return program + ".exe"
	}

	return program
}

func isFile(path string) bool {
	info, err := os.Stat(path) //nolint:gosec // a path set by hand or in the node's own folder, only looked at
	return err == nil && !info.IsDir()
}

func isDir(path string) bool {
	info, err := os.Stat(path) //nolint:gosec // inside the node's own folder
	return err == nil && info.IsDir()
}
