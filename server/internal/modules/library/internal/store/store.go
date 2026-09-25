package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/db/sqlc"
)

type Store struct {
	db *sql.DB
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
}

type Root struct {
	ID         int64
	Path       string
	AddedAt    time.Time
	LastScanAt *time.Time

	FileCount    int
	MissingCount int
}

type FileState struct {
	ID            int64
	RelPath       string
	Kind          string
	Size          int64
	Mtime         time.Time
	Missing       bool
	ParserVersion int
}

// Parsed is what the file's name says, as the parser read it.
type Parsed struct {
	Form  string
	Title string

	Year    *int
	Season  *int
	Episode *int
	Chapter *int
	Volume  *int

	Version int
}

type File struct {
	ID        int64
	RootID    int64
	RootPath  string
	RelPath   string
	Kind      string
	Size      int64
	Mtime     time.Time
	ScannedAt time.Time

	MissingSince *time.Time
	Parsed       Parsed
	Match        *Match
}

type Match struct {
	MediaRef   string
	Season     *int
	Episode    *int
	Confidence float64
	Source     string
}

func (s *Store) Roots(ctx context.Context) ([]Root, error) {
	rows, err := sqlc.New(s.db).ListLibraryRoots(ctx)
	if err != nil {
		return nil, fmt.Errorf("list library roots: %w", err)
	}

	roots := make([]Root, 0, len(rows))
	for _, row := range rows {
		roots = append(roots, Root{
			ID:           row.ID,
			Path:         row.Path,
			AddedAt:      time.Unix(row.AddedAt, 0).UTC(),
			LastScanAt:   optionalTime(row.LastScanAt),
			FileCount:    int(row.FileCount),
			MissingCount: int(row.MissingCount),
		})
	}

	return roots, nil
}

func (s *Store) Root(ctx context.Context, id int64) (*Root, error) {
	row, err := sqlc.New(s.db).GetLibraryRoot(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read library root %d: %w", id, err)
	}

	return &Root{
		ID:         row.ID,
		Path:       row.Path,
		AddedAt:    time.Unix(row.AddedAt, 0).UTC(),
		LastScanAt: optionalTime(row.LastScanAt),
	}, nil
}

func (s *Store) AddRoot(ctx context.Context, path string, now time.Time) (*Root, error) {
	row, err := sqlc.New(s.db).InsertLibraryRoot(ctx, sqlc.InsertLibraryRootParams{
		Path:    path,
		AddedAt: now.Unix(),
	})
	if err != nil {
		return nil, fmt.Errorf("add library root %s: %w", path, err)
	}

	return &Root{
		ID:      row.ID,
		Path:    row.Path,
		AddedAt: time.Unix(row.AddedAt, 0).UTC(),
	}, nil
}

func (s *Store) DeleteRoot(ctx context.Context, id int64) (bool, error) {
	deleted, err := sqlc.New(s.db).DeleteLibraryRoot(ctx, id)
	if err != nil {
		return false, fmt.Errorf("delete library root %d: %w", id, err)
	}

	return deleted > 0, nil
}

// FileStates returns what the previous scan recorded for a root, so the next one
// can compare against the filesystem in memory instead of querying per file.
func (s *Store) FileStates(ctx context.Context, rootID int64) ([]FileState, error) {
	rows, err := sqlc.New(s.db).ListLibraryFileStates(ctx, rootID)
	if err != nil {
		return nil, fmt.Errorf("list known files of root %d: %w", rootID, err)
	}

	states := make([]FileState, 0, len(rows))
	for _, row := range rows {
		states = append(states, FileState{
			ID:            row.ID,
			RelPath:       row.RelPath,
			Kind:          row.Kind,
			Size:          row.SizeBytes,
			Mtime:         time.UnixMilli(row.Mtime).UTC(),
			Missing:       row.MissingSince.Valid,
			ParserVersion: int(row.ParserVersion),
		})
	}

	return states, nil
}

// Added is a file the scan saw for the first time.
type Added struct {
	RelPath string
	Kind    string
	Size    int64
	Mtime   time.Time
	Parsed  Parsed
}

// Changed is a known file whose size or modification time moved.
type Changed struct {
	ID     int64
	Kind   string
	Size   int64
	Mtime  time.Time
	Parsed Parsed
}

// Reparsed is an untouched file whose name a newer parser reads differently.
type Reparsed struct {
	ID     int64
	Parsed Parsed
}

// ScanChanges is the whole difference between a root's rows and its filesystem.
// It is applied in one transaction so that a scan interrupted halfway leaves the
// previous state intact rather than a half-updated library.
type ScanChanges struct {
	Added    []Added
	Changed  []Changed
	Reparsed []Reparsed
	Returned []int64
	Missing  []int64
}

func (c ScanChanges) Empty() bool {
	return len(c.Added) == 0 && len(c.Changed) == 0 && len(c.Reparsed) == 0 &&
		len(c.Returned) == 0 && len(c.Missing) == 0
}

func (s *Store) ApplyScan(ctx context.Context, rootID int64, changes ScanChanges, now time.Time) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin library scan: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	queries := sqlc.New(s.db).WithTx(tx)

	for i := range changes.Added {
		file := &changes.Added[i]
		parsed := parsedParams(file.Parsed)

		_, err = queries.InsertLibraryFile(ctx, sqlc.InsertLibraryFileParams{
			RootID:    rootID,
			RelPath:   file.RelPath,
			Kind:      file.Kind,
			SizeBytes: file.Size,
			Mtime:     file.Mtime.UnixMilli(),
			ScannedAt: now.Unix(),

			MediaForm:     parsed.MediaForm,
			ParsedTitle:   parsed.ParsedTitle,
			ParsedYear:    parsed.ParsedYear,
			ParsedSeason:  parsed.ParsedSeason,
			ParsedEpisode: parsed.ParsedEpisode,
			ParsedChapter: parsed.ParsedChapter,
			ParsedVolume:  parsed.ParsedVolume,
			ParserVersion: parsed.ParserVersion,
		})
		if err != nil {
			return fmt.Errorf("record new file %s: %w", file.RelPath, err)
		}
	}

	for i := range changes.Changed {
		file := &changes.Changed[i]
		parsed := parsedParams(file.Parsed)

		err = queries.UpdateLibraryFile(ctx, sqlc.UpdateLibraryFileParams{
			ID:        file.ID,
			Kind:      file.Kind,
			SizeBytes: file.Size,
			Mtime:     file.Mtime.UnixMilli(),
			ScannedAt: now.Unix(),

			MediaForm:     parsed.MediaForm,
			ParsedTitle:   parsed.ParsedTitle,
			ParsedYear:    parsed.ParsedYear,
			ParsedSeason:  parsed.ParsedSeason,
			ParsedEpisode: parsed.ParsedEpisode,
			ParsedChapter: parsed.ParsedChapter,
			ParsedVolume:  parsed.ParsedVolume,
			ParserVersion: parsed.ParserVersion,
		})
		if err != nil {
			return fmt.Errorf("update changed file %d: %w", file.ID, err)
		}
	}

	for _, file := range changes.Reparsed {
		parsed := parsedParams(file.Parsed)
		parsed.ID = file.ID

		if err = queries.UpdateLibraryFileParse(ctx, parsed); err != nil {
			return fmt.Errorf("re-parse file %d: %w", file.ID, err)
		}
	}

	for _, id := range changes.Returned {
		err = queries.ClearLibraryFileMissing(ctx, sqlc.ClearLibraryFileMissingParams{
			ID:        id,
			ScannedAt: now.Unix(),
		})
		if err != nil {
			return fmt.Errorf("mark file %d present again: %w", id, err)
		}
	}

	for _, id := range changes.Missing {
		err = queries.MarkLibraryFileMissing(ctx, sqlc.MarkLibraryFileMissingParams{
			ID:           id,
			MissingSince: sql.NullInt64{Int64: now.Unix(), Valid: true},
		})
		if err != nil {
			return fmt.Errorf("mark file %d missing: %w", id, err)
		}
	}

	err = queries.TouchLibraryRoot(ctx, sqlc.TouchLibraryRootParams{
		ID:         rootID,
		LastScanAt: sql.NullInt64{Int64: now.Unix(), Valid: true},
	})
	if err != nil {
		return fmt.Errorf("record scan of root %d: %w", rootID, err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit library scan: %w", err)
	}

	return nil
}

type FileFilter struct {
	RootID        int64
	Kind          string
	MediaForm     string
	UnmatchedOnly bool
	Limit         int
	Offset        int
}

func (s *Store) Files(ctx context.Context, filter FileFilter) ([]File, int, error) {
	queries := sqlc.New(s.db)

	unmatchedOnly := int64(0)
	if filter.UnmatchedOnly {
		unmatchedOnly = 1
	}

	total, err := queries.CountLibraryFiles(ctx, sqlc.CountLibraryFilesParams{
		RootID:        filter.RootID,
		Kind:          filter.Kind,
		MediaForm:     filter.MediaForm,
		UnmatchedOnly: unmatchedOnly,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("count library files: %w", err)
	}

	rows, err := queries.ListLibraryFiles(ctx, sqlc.ListLibraryFilesParams{
		RootID:        filter.RootID,
		Kind:          filter.Kind,
		MediaForm:     filter.MediaForm,
		UnmatchedOnly: unmatchedOnly,
		PageLimit:     int64(filter.Limit),
		PageOffset:    int64(filter.Offset),
	})
	if err != nil {
		return nil, 0, fmt.Errorf("list library files: %w", err)
	}

	files := make([]File, 0, len(rows))
	for i := range rows {
		row := &rows[i]

		files = append(files, File{
			ID:           row.ID,
			RootID:       row.RootID,
			RootPath:     row.RootPath,
			RelPath:      row.RelPath,
			Kind:         row.Kind,
			Size:         row.SizeBytes,
			Mtime:        time.UnixMilli(row.Mtime).UTC(),
			ScannedAt:    time.Unix(row.ScannedAt, 0).UTC(),
			MissingSince: optionalTime(row.MissingSince),
			Parsed: parsedFrom(row.MediaForm, row.ParsedTitle, row.ParsedYear,
				row.ParsedSeason, row.ParsedEpisode, row.ParsedChapter, row.ParsedVolume),
			Match: matchFrom(row.MediaRef, row.Season, row.Episode, row.Confidence, row.MatchSource),
		})
	}

	return files, int(total), nil
}

func (s *Store) File(ctx context.Context, id int64) (*File, error) {
	row, err := sqlc.New(s.db).GetLibraryFile(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read library file %d: %w", id, err)
	}

	return &File{
		ID:           row.ID,
		RootID:       row.RootID,
		RootPath:     row.RootPath,
		RelPath:      row.RelPath,
		Kind:         row.Kind,
		Size:         row.SizeBytes,
		Mtime:        time.UnixMilli(row.Mtime).UTC(),
		ScannedAt:    time.Unix(row.ScannedAt, 0).UTC(),
		MissingSince: optionalTime(row.MissingSince),
		Parsed: parsedFrom(row.MediaForm, row.ParsedTitle, row.ParsedYear,
			row.ParsedSeason, row.ParsedEpisode, row.ParsedChapter, row.ParsedVolume),
		Match: matchFrom(row.MediaRef, row.Season, row.Episode, row.Confidence, row.MatchSource),
	}, nil
}

// Unmatched is a file waiting for the matcher, with everything the matcher needs
// and nothing else.
type Unmatched struct {
	ID     int64
	Kind   string
	Parsed Parsed
}

func (s *Store) UnmatchedFiles(ctx context.Context, limit int) ([]Unmatched, error) {
	rows, err := sqlc.New(s.db).ListUnmatchedFiles(ctx, int64(limit))
	if err != nil {
		return nil, fmt.Errorf("list unmatched files: %w", err)
	}

	files := make([]Unmatched, 0, len(rows))
	for i := range rows {
		row := &rows[i]

		files = append(files, Unmatched{
			ID:   row.ID,
			Kind: row.Kind,
			Parsed: parsedFrom(row.MediaForm, row.ParsedTitle, row.ParsedYear,
				row.ParsedSeason, row.ParsedEpisode, row.ParsedChapter, row.ParsedVolume),
		})
	}

	return files, nil
}

// SetAutoMatch never touches a match the user made by hand; the statement itself
// enforces that, so a scan cannot undo a correction even by mistake.
func (s *Store) SetAutoMatch(ctx context.Context, fileID int64, match Match, now time.Time) error {
	err := sqlc.New(s.db).UpsertAutoFileMatch(ctx, sqlc.UpsertAutoFileMatchParams{
		FileID:     fileID,
		MediaRef:   match.MediaRef,
		Season:     optionalInt64(match.Season),
		Episode:    optionalInt64(match.Episode),
		Confidence: match.Confidence,
		MatchedAt:  now.Unix(),
	})
	if err != nil {
		return fmt.Errorf("set automatic match for file %d: %w", fileID, err)
	}

	return nil
}

func (s *Store) SetManualMatch(ctx context.Context, fileID int64, match Match, now time.Time) error {
	err := sqlc.New(s.db).UpsertManualFileMatch(ctx, sqlc.UpsertManualFileMatchParams{
		FileID:    fileID,
		MediaRef:  match.MediaRef,
		Season:    optionalInt64(match.Season),
		Episode:   optionalInt64(match.Episode),
		MatchedAt: now.Unix(),
	})
	if err != nil {
		return fmt.Errorf("set manual match for file %d: %w", fileID, err)
	}

	return nil
}

func (s *Store) DeleteMatch(ctx context.Context, fileID int64) (bool, error) {
	deleted, err := sqlc.New(s.db).DeleteFileMatch(ctx, fileID)
	if err != nil {
		return false, fmt.Errorf("delete match of file %d: %w", fileID, err)
	}

	return deleted > 0, nil
}

// parsedParams carries the parsed columns for every statement that writes them.
// UpdateLibraryFileParseParams happens to be exactly that set plus the id.
func parsedParams(parsed Parsed) sqlc.UpdateLibraryFileParseParams {
	params := sqlc.UpdateLibraryFileParseParams{ParserVersion: int64(parsed.Version)}

	if parsed.Form != "" {
		params.MediaForm = sql.NullString{String: parsed.Form, Valid: true}
	}
	if parsed.Title != "" {
		params.ParsedTitle = sql.NullString{String: parsed.Title, Valid: true}
	}

	params.ParsedYear = optionalInt64(parsed.Year)
	params.ParsedSeason = optionalInt64(parsed.Season)
	params.ParsedEpisode = optionalInt64(parsed.Episode)
	params.ParsedChapter = optionalInt64(parsed.Chapter)
	params.ParsedVolume = optionalInt64(parsed.Volume)

	return params
}

func parsedFrom(
	form, title sql.NullString,
	year, season, episode, chapter, volume sql.NullInt64,
) Parsed {
	return Parsed{
		Form:    form.String,
		Title:   title.String,
		Year:    optionalInt(year),
		Season:  optionalInt(season),
		Episode: optionalInt(episode),
		Chapter: optionalInt(chapter),
		Volume:  optionalInt(volume),
	}
}

func matchFrom(
	mediaRef sql.NullString,
	season, episode sql.NullInt64,
	confidence sql.NullFloat64,
	source sql.NullString,
) *Match {
	if !mediaRef.Valid {
		return nil
	}

	match := &Match{
		MediaRef:   mediaRef.String,
		Confidence: confidence.Float64,
		Source:     source.String,
	}

	if season.Valid {
		value := int(season.Int64)
		match.Season = &value
	}
	if episode.Valid {
		value := int(episode.Int64)
		match.Episode = &value
	}

	return match
}

func optionalTime(value sql.NullInt64) *time.Time {
	if !value.Valid {
		return nil
	}

	at := time.Unix(value.Int64, 0).UTC()

	return &at
}

func optionalInt(value sql.NullInt64) *int {
	if !value.Valid {
		return nil
	}

	number := int(value.Int64)

	return &number
}

func optionalInt64(value *int) sql.NullInt64 {
	if value == nil {
		return sql.NullInt64{}
	}

	return sql.NullInt64{Int64: int64(*value), Valid: true}
}
