package service

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

const (
	defaultPageSize = 100
	maxPageSize     = 500
)

type Options struct {
	// FollowSymlinks is off by default, see scanner.Options.
	FollowSymlinks bool

	// Titles supplies the candidates a file could belong to. Without it the
	// library still scans and still takes matches from the user; it just makes no
	// guesses of its own.
	Titles TitleSource

	Now func() time.Time
}

type Service struct {
	store  *store.Store
	logger zerolog.Logger
	hub    *events.Hub
	opts   Options

	mu   sync.Mutex
	scan ScanStatus
}

func New(st *store.Store, logger zerolog.Logger, hub *events.Hub, opts Options) *Service {
	if opts.Now == nil {
		opts.Now = time.Now
	}

	return &Service{store: st, logger: logger, hub: hub, opts: opts}
}

func (s *Service) Roots(ctx context.Context) ([]Root, error) {
	rows, err := s.store.Roots(ctx)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read library roots")
	}

	roots := make([]Root, 0, len(rows))
	for _, row := range rows {
		roots = append(roots, Root{
			ID:             row.ID,
			Path:           row.Path,
			AddedAt:        row.AddedAt,
			LastScanAt:     row.LastScanAt,
			FileCount:      row.FileCount,
			MissingCount:   row.MissingCount,
			UnmatchedCount: row.UnmatchedCount,
		})
	}

	return roots, nil
}

func (s *Service) AddRoot(ctx context.Context, path string) (*Root, error) {
	cleaned, err := s.validateRootPath(path)
	if err != nil {
		return nil, err
	}

	existing, err := s.store.Roots(ctx)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read library roots")
	}

	for _, root := range existing {
		switch {
		case samePath(root.Path, cleaned):
			return nil, apperr.New(apperr.KindConflict, "%s is already a library root", cleaned)

		// Nested roots would record the same file twice, under two ids, and every
		// count and match would then exist in two places.
		case isUnder(cleaned, root.Path):
			return nil, apperr.New(apperr.KindConflict, "%s is already covered by the root %s", cleaned, root.Path)
		case isUnder(root.Path, cleaned):
			return nil, apperr.New(apperr.KindConflict, "%s contains the root %s — remove that one first", cleaned, root.Path)
		}
	}

	root, err := s.store.AddRoot(ctx, cleaned, s.opts.Now())
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "add library root")
	}

	s.hub.Publish(events.TopicLibraryUpdate, map[string]any{
		"reason": "root_added",
		"path":   cleaned,
	})

	return &Root{ID: root.ID, Path: root.Path, AddedAt: root.AddedAt}, nil
}

func (s *Service) DeleteRoot(ctx context.Context, id int64) error {
	deleted, err := s.store.DeleteRoot(ctx, id)
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "remove library root")
	}
	if !deleted {
		return apperr.New(apperr.KindNotFound, "library root %d does not exist", id)
	}

	s.hub.Publish(events.TopicLibraryUpdate, map[string]any{"reason": "root_removed"})

	return nil
}

func (s *Service) validateRootPath(path string) (string, error) {
	trimmed := strings.TrimSpace(path)
	if trimmed == "" {
		return "", apperr.Invalid("path", "a library root needs a path")
	}

	absolute, err := filepath.Abs(trimmed)
	if err != nil {
		return "", apperr.Invalid("path", "%s is not a usable path", trimmed)
	}

	info, err := os.Stat(absolute)
	if err != nil {
		if os.IsNotExist(err) {
			return "", apperr.Invalid("path", "%s does not exist", absolute)
		}
		return "", apperr.Invalid("path", "%s cannot be read: %v", absolute, err)
	}
	if !info.IsDir() {
		return "", apperr.Invalid("path", "%s is a file, not a folder", absolute)
	}

	return filepath.Clean(absolute), nil
}

type FileQuery struct {
	RootID        int64
	Kind          string
	MediaForm     string
	UnmatchedOnly bool
	IgnoredOnly   bool
	Limit         int
	Offset        int
}

func (s *Service) Files(ctx context.Context, query FileQuery) (*FilePage, error) {
	limit := query.Limit
	if limit <= 0 {
		limit = defaultPageSize
	}
	if limit > maxPageSize {
		limit = maxPageSize
	}

	offset := query.Offset
	if offset < 0 {
		offset = 0
	}

	rows, total, err := s.store.Files(ctx, store.FileFilter{
		RootID:        query.RootID,
		Kind:          query.Kind,
		MediaForm:     query.MediaForm,
		UnmatchedOnly: query.UnmatchedOnly,
		IgnoredOnly:   query.IgnoredOnly,
		Limit:         limit,
		Offset:        offset,
	})
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read library files")
	}

	items := make([]File, 0, len(rows))
	for i := range rows {
		items = append(items, fileFrom(rows[i]))
	}

	counts, err := s.store.Counts(ctx, store.FileFilter{
		RootID:    query.RootID,
		Kind:      query.Kind,
		MediaForm: query.MediaForm,
	})
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "count library files")
	}

	return &FilePage{
		Items:  items,
		Total:  total,
		Limit:  limit,
		Offset: offset,
		Counts: Counts{
			Total:     counts.Total,
			Unmatched: counts.Unmatched,
			Missing:   counts.Missing,
			Ignored:   counts.Ignored,
		},
		Titles: s.describeTitles(ctx, items),
	}, nil
}

// describeTitles names the titles this page's files were matched to. It asks
// only what the node already holds, so a page of a matched library still shows
// its posters with the network down — and a source that cannot answer costs the
// list its covers, never its files.
func (s *Service) describeTitles(ctx context.Context, files []File) []MatchedTitle {
	if s.opts.Titles == nil {
		return []MatchedTitle{}
	}

	refs := make([]string, 0, len(files))
	seen := make(map[string]struct{}, len(files))

	for i := range files {
		if files[i].Match == nil {
			continue
		}

		ref := files[i].Match.MediaRef
		if _, known := seen[ref]; known {
			continue
		}

		seen[ref] = struct{}{}
		refs = append(refs, ref)
	}

	if len(refs) == 0 {
		return []MatchedTitle{}
	}

	described, err := s.opts.Titles.Describe(ctx, refs)
	if err != nil {
		s.logger.Warn().Err(err).Msg("describe matched titles")

		return []MatchedTitle{}
	}

	titles := make([]MatchedTitle, 0, len(described))
	for i := range described {
		titles = append(titles, MatchedTitle(described[i]))
	}

	return titles
}

// describeRefs names titles by reference, for the callers that hold media_refs
// rather than files. It asks only what the node already holds, so an unreachable
// source costs a poster, never the entry it belongs to.
func (s *Service) describeRefs(ctx context.Context, refs []string) map[string]*MatchedTitle {
	result := make(map[string]*MatchedTitle, len(refs))
	if s.opts.Titles == nil || len(refs) == 0 {
		return result
	}

	described, err := s.opts.Titles.Describe(ctx, refs)
	if err != nil {
		s.logger.Warn().Err(err).Msg("describe titles")

		return result
	}

	for i := range described {
		title := MatchedTitle(described[i])
		result[title.MediaRef] = &title
	}

	return result
}

// AllFiles is every file the library holds, with the titles they are matched to.
// The explorer draws a tree of the whole library, which is one read of
// everything rather than a page at a time.
func (s *Service) AllFiles(ctx context.Context) (*FilePage, error) {
	rows, err := s.store.AllFiles(ctx)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read library files")
	}

	items := make([]File, 0, len(rows))
	for i := range rows {
		items = append(items, fileFrom(rows[i]))
	}

	counts, err := s.store.Counts(ctx, store.FileFilter{})
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "count library files")
	}

	return &FilePage{
		Items:  items,
		Total:  len(items),
		Limit:  len(items),
		Offset: 0,
		Counts: Counts{
			Total:     counts.Total,
			Unmatched: counts.Unmatched,
			Missing:   counts.Missing,
			Ignored:   counts.Ignored,
		},
		Titles: s.describeTitles(ctx, items),
	}, nil
}

// Collection reads the library as titles rather than as files. The grid of
// posters would otherwise have to pull every file in the library and group them
// itself, which is a page of work for a number the database already knows.
func (s *Service) Collection(ctx context.Context) (*LibraryCollection, error) {
	rows, err := s.store.CollectionEntries(ctx)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read library collection")
	}

	counts, err := s.store.Counts(ctx, store.FileFilter{})
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "count library files")
	}

	refs := make([]string, 0, len(rows))
	for _, row := range rows {
		refs = append(refs, row.MediaRef)
	}

	titles := s.describeRefs(ctx, refs)

	entries := make([]LibraryCollectionEntry, 0, len(rows))
	for _, row := range rows {
		entries = append(entries, LibraryCollectionEntry{
			MediaRef:     row.MediaRef,
			FileCount:    row.FileCount,
			MissingCount: row.MissingCount,
			Title:        titles[row.MediaRef],
		})
	}

	// By name, so the shelf reads like a shelf. A title the source could not name
	// sorts under its reference rather than disappearing to the end.
	slices.SortFunc(entries, func(left, right LibraryCollectionEntry) int {
		return strings.Compare(collectionSortKey(left), collectionSortKey(right))
	})

	return &LibraryCollection{
		Entries:   entries,
		Files:     counts.Total,
		Unmatched: counts.Unmatched,
		Missing:   counts.Missing,
	}, nil
}

func collectionSortKey(entry LibraryCollectionEntry) string {
	if entry.Title != nil && entry.Title.Title != "" {
		return strings.ToLower(entry.Title.Title)
	}

	return strings.ToLower(entry.MediaRef)
}

func (s *Service) SetMatch(ctx context.Context, fileID int64, mediaRef string, season, episode *int) (*File, error) {
	ref, err := normalizeMediaRef(mediaRef)
	if err != nil {
		return nil, err
	}

	if season != nil && *season < 0 {
		return nil, apperr.Invalid("season", "a season number cannot be negative")
	}
	if episode != nil && *episode < 0 {
		return nil, apperr.Invalid("episode", "an episode number cannot be negative")
	}

	file, err := s.store.File(ctx, fileID)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read library file")
	}
	if file == nil {
		return nil, apperr.New(apperr.KindNotFound, "library file %d does not exist", fileID)
	}

	match := store.Match{MediaRef: ref, Season: season, Episode: episode, Source: "manual", Confidence: 1}
	if saveErr := s.store.SetManualMatch(ctx, fileID, match, s.opts.Now()); saveErr != nil {
		return nil, apperr.Wrap(saveErr, apperr.KindInternal, "save match")
	}

	s.publishMatchChange(ref)

	updated, err := s.store.File(ctx, fileID)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read library file")
	}

	result := fileFrom(*updated)

	return &result, nil
}

func (s *Service) DeleteMatch(ctx context.Context, fileID int64) error {
	file, err := s.store.File(ctx, fileID)
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "read library file")
	}
	if file == nil {
		return apperr.New(apperr.KindNotFound, "library file %d does not exist", fileID)
	}
	if file.Match == nil {
		return nil
	}

	if _, err := s.store.DeleteMatch(ctx, fileID); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "remove match")
	}

	s.publishMatchChange(file.Match.MediaRef)

	return nil
}

func (s *Service) publishMatchChange(mediaRef string) {
	s.hub.Publish(events.TopicLibraryUpdate, map[string]any{
		"reason":    "match_changed",
		"media_ref": mediaRef,
	})
}

// normalizeMediaRef checks the shape only. Which providers exist is the business
// of the modules that own titles, not of the one that owns files.
func normalizeMediaRef(mediaRef string) (string, error) {
	trimmed := strings.TrimSpace(mediaRef)

	provider, id, found := strings.Cut(trimmed, ":")
	if !found || provider == "" || id == "" {
		return "", apperr.Invalid("media_ref", "a media reference looks like provider:id, got %q", mediaRef)
	}

	return trimmed, nil
}

func fileFrom(row store.File) File {
	file := File{
		ID:         row.ID,
		RootID:     row.RootID,
		Path:       filepath.Join(row.RootPath, filepath.FromSlash(row.RelPath)),
		RelPath:    row.RelPath,
		Kind:       row.Kind,
		SizeBytes:  row.Size,
		ModifiedAt: row.Mtime,
		Missing:    row.MissingSince != nil,
		Ignored:    row.IgnoredSince != nil,
		Parsed: Parsed{
			Form:    row.Parsed.Form,
			Title:   row.Parsed.Title,
			Year:    row.Parsed.Year,
			Season:  row.Parsed.Season,
			Episode: row.Parsed.Episode,
			Chapter: row.Parsed.Chapter,
			Volume:  row.Parsed.Volume,
		},
	}

	if row.Duration != nil {
		seconds := int(row.Duration.Seconds())
		file.DurationSeconds = &seconds
	}

	if row.Match != nil {
		file.Match = &Match{
			MediaRef:   row.Match.MediaRef,
			Season:     row.Match.Season,
			Episode:    row.Match.Episode,
			Confidence: row.Match.Confidence,
			Source:     row.Match.Source,
		}
	}

	return file
}

func comparablePath(path string) string {
	cleaned := filepath.Clean(path)
	if runtime.GOOS == "windows" {
		return strings.ToLower(cleaned)
	}

	return cleaned
}

func samePath(a, b string) bool {
	return comparablePath(a) == comparablePath(b)
}

// isUnder reports whether child sits inside parent.
func isUnder(child, parent string) bool {
	rel, err := filepath.Rel(comparablePath(parent), comparablePath(child))
	if err != nil {
		return false
	}

	return rel != "." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)) && rel != ".."
}
