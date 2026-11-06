package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/db/sqlc"
)

// How many past scans a local database bothers to keep. Nobody comes back to
// read a scan from months ago, and a library rescanned daily would otherwise
// grow this table forever for no reason.
const scanHistoryRetention = 50

type ScanRun struct {
	ID         int64
	StartedAt  time.Time
	FinishedAt time.Time
	Status     string

	RootsTotal int
	Found      int
	Added      int
	Changed    int
	Reparsed   int
	Missing    int
	Probed     int
	Considered int
	Matched    int
}

type ScanRunRoot struct {
	RootID   *int64
	RootPath string

	Found    int
	Added    int
	Changed  int
	Reparsed int
	Missing  int
	Probed   int

	Error string
}

type ScanRunGroup struct {
	MediaRef  string
	FileCount int
	Tracked   bool
}

type ScanRunFileLog struct {
	FileID      *int64
	RelPath     string
	ParsedTitle string

	Matched  bool
	MediaRef string

	Confidence *float64
}

// NewScanRun is everything one finished scan writes to history in one
// transaction: the run itself, its roots, the titles it settled on and what it
// made of every file it looked at.
type NewScanRun struct {
	StartedAt  time.Time
	FinishedAt time.Time
	Status     string

	RootsTotal int
	Found      int
	Added      int
	Changed    int
	Reparsed   int
	Missing    int
	Probed     int
	Considered int
	Matched    int

	Roots    []ScanRunRoot
	Groups   []ScanRunGroup
	FileLogs []ScanRunFileLog
}

// RecordScanRun writes a finished scan to history and prunes anything past the
// retention window, in one transaction — a scan interrupted while this runs
// should not leave a run with some of its roots or file logs missing.
func (s *Store) RecordScanRun(ctx context.Context, run NewScanRun) (int64, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("begin scan history: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	queries := sqlc.New(s.db).WithTx(tx)

	runID, err := queries.InsertScanRun(ctx, sqlc.InsertScanRunParams{
		StartedAt:  run.StartedAt.Unix(),
		FinishedAt: run.FinishedAt.Unix(),
		Status:     run.Status,
		RootsTotal: int64(run.RootsTotal),
		Found:      int64(run.Found),
		Added:      int64(run.Added),
		Changed:    int64(run.Changed),
		Reparsed:   int64(run.Reparsed),
		Missing:    int64(run.Missing),
		Probed:     int64(run.Probed),
		Considered: int64(run.Considered),
		Matched:    int64(run.Matched),
	})
	if err != nil {
		return 0, fmt.Errorf("record scan run: %w", err)
	}

	for _, root := range run.Roots {
		err = queries.InsertScanRunRoot(ctx, sqlc.InsertScanRunRootParams{
			ScanRunID: runID,
			RootID:    nullInt64FromPtr(root.RootID),
			RootPath:  root.RootPath,
			Found:     int64(root.Found),
			Added:     int64(root.Added),
			Changed:   int64(root.Changed),
			Reparsed:  int64(root.Reparsed),
			Missing:   int64(root.Missing),
			Probed:    int64(root.Probed),
			Error:     optionalString(root.Error),
		})
		if err != nil {
			return 0, fmt.Errorf("record scan run root %s: %w", root.RootPath, err)
		}
	}

	for _, group := range run.Groups {
		tracked := int64(0)
		if group.Tracked {
			tracked = 1
		}

		err = queries.InsertScanRunGroup(ctx, sqlc.InsertScanRunGroupParams{
			ScanRunID: runID,
			MediaRef:  group.MediaRef,
			FileCount: int64(group.FileCount),
			Tracked:   tracked,
		})
		if err != nil {
			return 0, fmt.Errorf("record scan run group %s: %w", group.MediaRef, err)
		}
	}

	for _, entry := range run.FileLogs {
		outcome := "unmatched"
		if entry.Matched {
			outcome = "matched_auto"
		}

		err = queries.InsertScanRunFileLog(ctx, sqlc.InsertScanRunFileLogParams{
			ScanRunID:   runID,
			FileID:      nullInt64FromPtr(entry.FileID),
			RelPath:     entry.RelPath,
			ParsedTitle: optionalString(entry.ParsedTitle),
			Outcome:     outcome,
			MediaRef:    optionalString(entry.MediaRef),
			Confidence:  optionalFloat64(entry.Confidence),
		})
		if err != nil {
			return 0, fmt.Errorf("record scan run file log %s: %w", entry.RelPath, err)
		}
	}

	if err = queries.PruneScanRuns(ctx, scanHistoryRetention); err != nil {
		return 0, fmt.Errorf("prune scan history: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return 0, fmt.Errorf("commit scan history: %w", err)
	}

	return runID, nil
}

type ScanHistoryFilter struct {
	From *time.Time
	To   *time.Time

	Limit  int
	Offset int
}

func (s *Store) ScanRuns(ctx context.Context, filter ScanHistoryFilter) ([]ScanRun, int, error) {
	queries := sqlc.New(s.db)

	fromTs := unixOrZero(filter.From)
	toTs := unixOrZero(filter.To)

	total, err := queries.CountScanRuns(ctx, sqlc.CountScanRunsParams{FromTs: fromTs, ToTs: toTs})
	if err != nil {
		return nil, 0, fmt.Errorf("count scan runs: %w", err)
	}

	rows, err := queries.ListScanRuns(ctx, sqlc.ListScanRunsParams{
		FromTs:     fromTs,
		ToTs:       toTs,
		PageLimit:  int64(filter.Limit),
		PageOffset: int64(filter.Offset),
	})
	if err != nil {
		return nil, 0, fmt.Errorf("list scan runs: %w", err)
	}

	runs := make([]ScanRun, 0, len(rows))
	for i := range rows {
		runs = append(runs, scanRunFrom(rows[i]))
	}

	return runs, int(total), nil
}

func (s *Store) ScanRun(ctx context.Context, id int64) (*ScanRun, error) {
	row, err := sqlc.New(s.db).GetScanRun(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}

		return nil, fmt.Errorf("read scan run %d: %w", id, err)
	}

	run := scanRunFrom(row)

	return &run, nil
}

func (s *Store) ScanRunRoots(ctx context.Context, scanRunID int64) ([]ScanRunRoot, error) {
	rows, err := sqlc.New(s.db).ListScanRunRoots(ctx, scanRunID)
	if err != nil {
		return nil, fmt.Errorf("list roots of scan run %d: %w", scanRunID, err)
	}

	roots := make([]ScanRunRoot, 0, len(rows))
	for _, row := range rows {
		roots = append(roots, ScanRunRoot{
			RootID:   ptrFromOptionalInt64(row.RootID),
			RootPath: row.RootPath,
			Found:    int(row.Found),
			Added:    int(row.Added),
			Changed:  int(row.Changed),
			Reparsed: int(row.Reparsed),
			Missing:  int(row.Missing),
			Probed:   int(row.Probed),
			Error:    row.Error.String,
		})
	}

	return roots, nil
}

func (s *Store) ScanRunGroups(ctx context.Context, scanRunID int64) ([]ScanRunGroup, error) {
	rows, err := sqlc.New(s.db).ListScanRunGroups(ctx, scanRunID)
	if err != nil {
		return nil, fmt.Errorf("list groups of scan run %d: %w", scanRunID, err)
	}

	groups := make([]ScanRunGroup, 0, len(rows))
	for _, row := range rows {
		groups = append(groups, ScanRunGroup{
			MediaRef:  row.MediaRef,
			FileCount: int(row.FileCount),
			Tracked:   row.Tracked != 0,
		})
	}

	return groups, nil
}

func (s *Store) ScanRunFileLogs(ctx context.Context, scanRunID int64) ([]ScanRunFileLog, error) {
	rows, err := sqlc.New(s.db).ListScanRunFileLogs(ctx, scanRunID)
	if err != nil {
		return nil, fmt.Errorf("list file logs of scan run %d: %w", scanRunID, err)
	}

	logs := make([]ScanRunFileLog, 0, len(rows))
	for _, row := range rows {
		logs = append(logs, ScanRunFileLog{
			FileID:      ptrFromOptionalInt64(row.FileID),
			RelPath:     row.RelPath,
			ParsedTitle: row.ParsedTitle.String,
			Matched:     row.Outcome == "matched_auto",
			MediaRef:    row.MediaRef.String,
			Confidence:  optionalFloatPtr(row.Confidence),
		})
	}

	return logs, nil
}

func scanRunFrom(row sqlc.ScanRun) ScanRun {
	return ScanRun{
		ID:         row.ID,
		StartedAt:  time.Unix(row.StartedAt, 0).UTC(),
		FinishedAt: time.Unix(row.FinishedAt, 0).UTC(),
		Status:     row.Status,
		RootsTotal: int(row.RootsTotal),
		Found:      int(row.Found),
		Added:      int(row.Added),
		Changed:    int(row.Changed),
		Reparsed:   int(row.Reparsed),
		Missing:    int(row.Missing),
		Probed:     int(row.Probed),
		Considered: int(row.Considered),
		Matched:    int(row.Matched),
	}
}

func unixOrZero(at *time.Time) int64 {
	if at == nil {
		return 0
	}

	return at.Unix()
}

func nullInt64FromPtr(value *int64) sql.NullInt64 {
	if value == nil {
		return sql.NullInt64{}
	}

	return sql.NullInt64{Int64: *value, Valid: true}
}

func ptrFromOptionalInt64(value sql.NullInt64) *int64 {
	if !value.Valid {
		return nil
	}

	id := value.Int64

	return &id
}

func optionalString(value string) sql.NullString {
	if value == "" {
		return sql.NullString{}
	}

	return sql.NullString{String: value, Valid: true}
}

func optionalFloat64(value *float64) sql.NullFloat64 {
	if value == nil {
		return sql.NullFloat64{}
	}

	return sql.NullFloat64{Float64: *value, Valid: true}
}

func optionalFloatPtr(value sql.NullFloat64) *float64 {
	if !value.Valid {
		return nil
	}

	confidence := value.Float64

	return &confidence
}
