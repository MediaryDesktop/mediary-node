package service

import (
	"context"
	"path/filepath"
	"slices"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/parser"
	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/prober"
	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/scanner"
	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

const (
	// A scan outlives the request that asked for it, so it needs its own ceiling:
	// without one, a scan wedged on an unresponsive network share would keep the
	// single scan slot busy until the node restarts.
	scanTimeout = 6 * time.Hour

	// One progress event per interval, however fast the walk goes. The UI cannot
	// use more, and the event bus drops what a slow subscriber does not read.
	progressInterval = 300 * time.Millisecond
)

func (s *Service) ScanState() ScanStatus {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.snapshotLocked()
}

// StartScan walks one root, or every root when rootID is 0, in the background and
// returns the status the scan started with. Progress arrives as library.scan
// events; the walk of a large library takes minutes, and a request cannot wait
// that long.
func (s *Service) StartScan(ctx context.Context, rootID int64) (*ScanStatus, error) {
	roots, err := s.scanTargets(ctx, rootID)
	if err != nil {
		return nil, err
	}

	s.mu.Lock()
	if s.scan.Running {
		s.mu.Unlock()
		return nil, apperr.New(apperr.KindConflict, "a scan is already running")
	}

	startedAt := s.opts.Now()
	s.scan = ScanStatus{
		Running:    true,
		StartedAt:  &startedAt,
		RootsTotal: len(roots),
		Roots:      make([]ScanRootResult, 0, len(roots)),
	}
	for _, root := range roots {
		s.scan.Roots = append(s.scan.Roots, ScanRootResult{RootID: root.ID, Path: root.Path})
	}
	status := s.snapshotLocked()
	s.mu.Unlock()

	detached, cancel := context.WithTimeout(context.WithoutCancel(ctx), scanTimeout)

	go func() {
		defer cancel()
		s.runScan(detached, roots)
	}()

	return &status, nil
}

func (s *Service) scanTargets(ctx context.Context, rootID int64) ([]store.Root, error) {
	if rootID != 0 {
		root, err := s.store.Root(ctx, rootID)
		if err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "read library root")
		}
		if root == nil {
			return nil, apperr.New(apperr.KindNotFound, "library root %d does not exist", rootID)
		}

		return []store.Root{*root}, nil
	}

	roots, err := s.store.Roots(ctx)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read library roots")
	}
	if len(roots) == 0 {
		return nil, apperr.New(apperr.KindPrecondition, "add a library folder before scanning")
	}

	return roots, nil
}

func (s *Service) runScan(ctx context.Context, roots []store.Root) {
	s.publishScan("started", map[string]any{"roots_total": len(roots), "roots_done": 0})

	changed := false

	for i, root := range roots {
		result := s.scanRoot(ctx, root, i, len(roots))

		s.mu.Lock()
		s.scan.Roots[i] = result
		s.scan.RootsDone = i + 1
		s.scan.Found += result.Found
		s.scan.Added += result.Added
		s.scan.Changed += result.Changed
		s.scan.Reparsed += result.Reparsed
		s.scan.Missing += result.Missing
		s.scan.Probed += result.Probed
		s.mu.Unlock()

		s.publishScan("root", map[string]any{
			"root_id":     result.RootID,
			"path":        result.Path,
			"error":       result.Error,
			"roots_total": len(roots),
			"roots_done":  i + 1,
		})

		if result.Added+result.Changed+result.Reparsed+result.Missing > 0 {
			changed = true
		}

		if ctx.Err() != nil {
			break
		}
	}

	// Matching runs after every root is walked, and over everything still
	// unmatched — not only over what this scan added. A file the source could not
	// explain while the network was down gets another chance on the next scan.
	outcome := s.matchFiles(ctx)

	finishedAt := s.opts.Now()

	s.mu.Lock()
	s.scan.Running = false
	s.scan.FinishedAt = &finishedAt
	s.scan.Considered = outcome.Considered
	s.scan.Matched = outcome.Matched
	status := s.snapshotLocked()
	s.mu.Unlock()

	s.publishScan("finished", map[string]any{
		"roots_total": status.RootsTotal,
		"roots_done":  status.RootsDone,
		"found":       status.Found,
		"added":       status.Added,
		"changed":     status.Changed,
		"reparsed":    status.Reparsed,
		"missing":     status.Missing,
		"matched":     status.Matched,
	})

	s.publishMatched(outcome)

	// The rows only changed if something on disk did, and a client that
	// refetches its library on every scan of an unchanged folder pays for
	// nothing.
	if changed {
		s.hub.Publish(events.TopicLibraryUpdate, map[string]any{"reason": "scanned"})
	}
}

func (s *Service) scanRoot(ctx context.Context, root store.Root, index, total int) ScanRootResult {
	result := ScanRootResult{RootID: root.ID, Path: root.Path}

	known, err := s.store.FileStates(ctx, root.ID)
	if err != nil {
		s.logger.Error().Err(err).Int64("root_id", root.ID).Msg("read known files")
		result.Error = err.Error()

		return result
	}

	lastProgress := time.Time{}

	found, err := scanner.Walk(ctx, root.Path, scanner.Options{
		FollowSymlinks: s.opts.FollowSymlinks,
		OnFile: func(count int) {
			now := s.opts.Now()
			if now.Sub(lastProgress) < progressInterval {
				return
			}
			lastProgress = now

			s.publishScan("progress", map[string]any{
				"root_id":     root.ID,
				"path":        root.Path,
				"found":       count,
				"roots_total": total,
				"roots_done":  index,
			})
		},
	})
	if err != nil {
		// A root that cannot be walked right now — an unplugged drive, a share
		// that is down — is left exactly as the last scan left it. Applying a
		// partial listing would mark the whole library missing.
		s.logger.Warn().Err(err).Str("path", root.Path).Msg("skip library root")
		result.Error = err.Error()

		return result
	}

	changes := diffFiles(known, found)

	result.Probed = s.probeDurations(ctx, root.Path, known, found, &changes, index, total)

	if err := s.store.ApplyScan(ctx, root.ID, changes, s.opts.Now()); err != nil {
		s.logger.Error().Err(err).Int64("root_id", root.ID).Msg("apply library scan")
		result.Error = err.Error()

		return result
	}

	result.Found = len(found)
	result.Added = len(changes.Added)
	result.Changed = len(changes.Changed)
	result.Reparsed = len(changes.Reparsed)
	result.Missing = len(changes.Missing)

	return result
}

// probeDurations reads how long every new, changed or never-probed video file
// runs. It happens here rather than in diffFiles because it touches the disk, and
// because a scan that reports nothing while it opens thousands of files looks
// wedged.
func (s *Service) probeDurations(
	ctx context.Context,
	rootPath string,
	known []store.FileState,
	found []scanner.File,
	changes *store.ScanChanges,
	index, total int,
) int {
	stale := staleProbes(known, found, changes)

	work := len(changes.Added) + len(changes.Changed) + len(stale)
	if work == 0 {
		return 0
	}

	done := 0
	lastProgress := time.Time{}

	report := func() {
		done++

		now := s.opts.Now()
		if now.Sub(lastProgress) < progressInterval && done < work {
			return
		}
		lastProgress = now

		s.publishScan("probing", map[string]any{
			"root_id":     rootPath,
			"path":        rootPath,
			"probed":      done,
			"total":       work,
			"roots_total": total,
			"roots_done":  index,
		})
	}

	for i := range changes.Added {
		if ctx.Err() != nil {
			return done
		}

		changes.Added[i].Probe = s.probe(rootPath, changes.Added[i].RelPath, changes.Added[i].Kind)
		report()
	}

	for i := range changes.Changed {
		if ctx.Err() != nil {
			return done
		}

		changes.Changed[i].Probe = s.probe(rootPath, changes.Changed[i].RelPath, changes.Changed[i].Kind)
		report()
	}

	for _, file := range stale {
		if ctx.Err() != nil {
			return done
		}

		changes.Probed = append(changes.Probed, store.Probed{
			ID:    file.ID,
			Probe: s.probe(rootPath, file.RelPath, file.Kind),
		})
		report()
	}

	return done
}

func (s *Service) probe(rootPath, relPath, kind string) store.Probe {
	probe := store.Probe{Version: prober.Version}

	if kind != string(scanner.KindVideo) {
		return probe
	}

	if duration, ok := prober.Duration(filepath.Join(rootPath, filepath.FromSlash(relPath))); ok {
		probe.Duration = &duration
	}

	return probe
}

// staleProbes are the files on disk that this scan is not rewriting anyway and
// that a newer prober has not looked at yet.
func staleProbes(known []store.FileState, found []scanner.File, changes *store.ScanChanges) []store.FileState {
	rewritten := make(map[int64]struct{}, len(changes.Changed))
	for i := range changes.Changed {
		rewritten[changes.Changed[i].ID] = struct{}{}
	}

	onDisk := make(map[string]struct{}, len(found))
	for _, file := range found {
		onDisk[file.RelPath] = struct{}{}
	}

	stale := make([]store.FileState, 0)

	for _, state := range known {
		_, present := onDisk[state.RelPath]
		_, rewriting := rewritten[state.ID]

		if present && !rewriting && state.ProbeVersion < prober.Version {
			stale = append(stale, state)
		}
	}

	return stale
}

// diffFiles compares what the previous scan recorded against what is on disk
// now. A file is only rewritten when its size, modification time or kind moved,
// so a rescan of an unchanged library writes nothing but the root's timestamp —
// except for rows a newer parser reads differently, which are re-parsed without
// the file being read again.
func diffFiles(known []store.FileState, found []scanner.File) store.ScanChanges {
	byRelPath := make(map[string]store.FileState, len(known))
	for _, state := range known {
		byRelPath[state.RelPath] = state
	}

	changes := store.ScanChanges{}

	for _, file := range found {
		state, existed := byRelPath[file.RelPath]
		if !existed {
			changes.Added = append(changes.Added, store.Added{
				RelPath: file.RelPath,
				Kind:    string(file.Kind),
				Size:    file.Size,
				Mtime:   file.ModTime,
				Parsed:  parseFile(file),
			})

			continue
		}

		delete(byRelPath, file.RelPath)

		switch {
		case state.Size != file.Size ||
			state.Mtime.UnixMilli() != file.ModTime.UnixMilli() ||
			state.Kind != string(file.Kind):
			changes.Changed = append(changes.Changed, store.Changed{
				ID:      state.ID,
				RelPath: file.RelPath,
				Kind:    string(file.Kind),
				Size:    file.Size,
				Mtime:   file.ModTime,
				Parsed:  parseFile(file),
			})

		case state.Missing:
			changes.Returned = append(changes.Returned, state.ID)

		case state.ParserVersion != parser.Version:
			changes.Reparsed = append(changes.Reparsed, store.Reparsed{
				ID:     state.ID,
				Parsed: parseFile(file),
			})
		}
	}

	for _, state := range byRelPath {
		if !state.Missing {
			changes.Missing = append(changes.Missing, state.ID)
		}
	}

	// The map hands them over in random order; a stable one keeps the SQL
	// statements, and the tests over them, reproducible.
	slices.Sort(changes.Missing)

	return changes
}

func parseFile(file scanner.File) store.Parsed {
	parsed := parser.Parse(file.RelPath, file.Kind)

	return store.Parsed{
		Form:    string(parsed.Form),
		Title:   parsed.Title,
		Year:    parsed.Year,
		Season:  parsed.Season,
		Episode: parsed.Episode,
		Chapter: parsed.Chapter,
		Volume:  parsed.Volume,
		Version: parser.Version,
	}
}

func (s *Service) snapshotLocked() ScanStatus {
	status := s.scan
	status.Roots = slices.Clone(s.scan.Roots)
	if status.Roots == nil {
		status.Roots = []ScanRootResult{}
	}

	return status
}

func (s *Service) publishScan(phase string, payload map[string]any) {
	if payload == nil {
		payload = map[string]any{}
	}
	payload["phase"] = phase

	s.hub.Publish(events.TopicLibraryScan, payload)
}
