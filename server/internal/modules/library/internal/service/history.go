package service

import (
	"context"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/library/internal/store"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

// How long the history write is given once a scan has already finished. It is a
// handful of local inserts, never a network call, so a generous ceiling only
// exists to keep a stuck write from leaking a goroutine forever.
const recordScanRunTimeout = 10 * time.Second

// recordScanRun writes a finished scan to history on its own context, detached
// from the scan's — a scan that ran into its own timeout must still get to write
// down what it managed before that happened, which the scan's own (by then
// expired) context could no longer allow.
func (s *Service) recordScanRun(status ScanStatus, outcome matchOutcome, startedAt, finishedAt time.Time, partial bool) {
	ctx, cancel := context.WithTimeout(context.Background(), recordScanRunTimeout)
	defer cancel()

	scanStatus := "completed"
	if partial {
		scanStatus = "partial"
	}

	roots := make([]store.ScanRunRoot, 0, len(status.Roots))
	for _, root := range status.Roots {
		rootID := root.RootID
		roots = append(roots, store.ScanRunRoot{
			RootID:   &rootID,
			RootPath: root.Path,
			Found:    root.Found,
			Added:    root.Added,
			Changed:  root.Changed,
			Reparsed: root.Reparsed,
			Missing:  root.Missing,
			Probed:   root.Probed,
			Error:    root.Error,
		})
	}

	groups := make([]store.ScanRunGroup, 0, len(outcome.Groups))
	for _, group := range outcome.Groups {
		groups = append(groups, store.ScanRunGroup{
			MediaRef:  group.MediaRef,
			FileCount: group.FileCount,
			Tracked:   group.Tracked,
		})
	}

	logs := make([]store.ScanRunFileLog, 0, len(outcome.FileLogs))
	for _, entry := range outcome.FileLogs {
		fileID := entry.FileID
		logs = append(logs, store.ScanRunFileLog{
			FileID:      &fileID,
			RelPath:     entry.RelPath,
			ParsedTitle: entry.ParsedTitle,
			Matched:     entry.Matched,
			MediaRef:    entry.MediaRef,
			Confidence:  entry.Confidence,
		})
	}

	_, err := s.store.RecordScanRun(ctx, store.NewScanRun{
		StartedAt:  startedAt,
		FinishedAt: finishedAt,
		Status:     scanStatus,

		RootsTotal: status.RootsTotal,
		Found:      status.Found,
		Added:      status.Added,
		Changed:    status.Changed,
		Reparsed:   status.Reparsed,
		Missing:    status.Missing,
		Probed:     status.Probed,
		Considered: status.Considered,
		Matched:    status.Matched,

		Roots:    roots,
		Groups:   groups,
		FileLogs: logs,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("record scan history")
	}
}

func (s *Service) ScanHistory(ctx context.Context, query ScanHistoryQuery) (*ScanHistoryPage, error) {
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

	rows, total, err := s.store.ScanRuns(ctx, store.ScanHistoryFilter{
		From:   query.From,
		To:     query.To,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read scan history")
	}

	items := make([]ScanRunSummary, 0, len(rows))
	for i := range rows {
		items = append(items, scanRunSummaryFrom(rows[i]))
	}

	return &ScanHistoryPage{Items: items, Total: total, Limit: limit, Offset: offset}, nil
}

func (s *Service) ScanRun(ctx context.Context, id int64) (*ScanRunDetail, error) {
	run, err := s.store.ScanRun(ctx, id)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read scan run")
	}
	if run == nil {
		return nil, apperr.New(apperr.KindNotFound, "scan run %d does not exist", id)
	}

	roots, err := s.store.ScanRunRoots(ctx, id)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read scan run roots")
	}

	groups, err := s.store.ScanRunGroups(ctx, id)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read scan run groups")
	}

	logs, err := s.store.ScanRunFileLogs(ctx, id)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read scan run file logs")
	}

	refs := make([]string, 0, len(groups))
	for _, group := range groups {
		refs = append(refs, group.MediaRef)
	}

	titles := s.describeRefs(ctx, refs)

	detail := &ScanRunDetail{
		ScanRunSummary: scanRunSummaryFrom(*run),
		Roots:          make([]ScanRunRootDetail, 0, len(roots)),
		Groups:         make([]ScanRunGroupDetail, 0, len(groups)),
		UnmatchedFiles: make([]ScanRunFileLogDetail, 0),
	}

	for _, root := range roots {
		detail.Roots = append(detail.Roots, ScanRunRootDetail{
			RootID:   root.RootID,
			RootPath: root.RootPath,
			Found:    root.Found,
			Added:    root.Added,
			Changed:  root.Changed,
			Reparsed: root.Reparsed,
			Missing:  root.Missing,
			Probed:   root.Probed,
			Error:    root.Error,
		})
	}

	// A matched file belongs under the title it went to, so the log of a title
	// reads as what happened to that title's files; the rest are the unmatched.
	matchedByRef := make(map[string][]ScanRunFileLogDetail, len(groups))

	for _, entry := range logs {
		logged := ScanRunFileLogDetail{
			FileID:      entry.FileID,
			RelPath:     entry.RelPath,
			ParsedTitle: entry.ParsedTitle,
			Confidence:  entry.Confidence,
		}

		if entry.Matched {
			matchedByRef[entry.MediaRef] = append(matchedByRef[entry.MediaRef], logged)

			continue
		}

		detail.UnmatchedFiles = append(detail.UnmatchedFiles, logged)
	}

	for _, group := range groups {
		files := matchedByRef[group.MediaRef]
		if files == nil {
			files = []ScanRunFileLogDetail{}
		}

		detail.Groups = append(detail.Groups, ScanRunGroupDetail{
			MediaRef:  group.MediaRef,
			FileCount: group.FileCount,
			Tracked:   group.Tracked,
			Title:     titles[group.MediaRef],
			Files:     files,
		})
	}

	return detail, nil
}

func scanRunSummaryFrom(run store.ScanRun) ScanRunSummary {
	return ScanRunSummary{
		ID:         run.ID,
		StartedAt:  run.StartedAt,
		FinishedAt: run.FinishedAt,
		Status:     run.Status,
		RootsTotal: run.RootsTotal,
		Found:      run.Found,
		Added:      run.Added,
		Changed:    run.Changed,
		Missing:    run.Missing,
		Considered: run.Considered,
		Matched:    run.Matched,
	}
}
