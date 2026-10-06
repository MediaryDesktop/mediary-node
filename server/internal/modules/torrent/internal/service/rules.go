package service

import (
	"context"
	"slices"
	"strings"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/modules/torrent/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// How often the rules look for new episodes, and how long after start the
// first look waits: the node has more urgent things to do while it starts.
const (
	defaultRuleInterval = 30 * time.Minute
	ruleStartDelay      = time.Minute
)

// TorrentRule makes the node download a title's new episodes by itself.
type TorrentRule struct {
	MediaRef    string     `json:"media_ref"`
	Title       string     `json:"title"`
	Query       string     `json:"query" doc:"Searched for instead of the title's names when not empty."`
	FromEpisode int        `json:"from_episode" doc:"Episodes before this one are never downloaded by the rule."`
	Enabled     bool       `json:"enabled"`
	LastChecked *time.Time `json:"last_checked,omitempty"`
	LastAdded   int        `json:"last_added" doc:"Downloads the last check added."`
	LastError   string     `json:"last_error,omitempty"`
}

type RuleInput struct {
	MediaRef string
	Title    string
	Query    string
	// Nil starts after the last episode the library has.
	FromEpisode *int
	Enabled     bool
}

// TorrentPlannedDownload is a download a rule makes, or would make: one
// episode's release, or a batch whose files for these episodes alone are taken.
type TorrentPlannedDownload struct {
	Episodes []int          `json:"episodes"`
	Release  TorrentRelease `json:"release"`
}

type TorrentRuleCheck struct {
	Planned []TorrentPlannedDownload `json:"planned"`
	Added   int                      `json:"added" doc:"How many of the planned downloads were added; always 0 for a preview."`
	Error   string                   `json:"error,omitempty"`
}

func ruleView(rule *store.Rule) TorrentRule {
	return TorrentRule{
		MediaRef:    rule.MediaRef,
		Title:       rule.Title,
		Query:       rule.Query,
		FromEpisode: rule.FromEpisode,
		Enabled:     rule.Enabled,
		LastChecked: rule.LastChecked,
		LastAdded:   rule.LastAdded,
		LastError:   rule.LastError,
	}
}

func (s *Service) Rules(ctx context.Context) ([]TorrentRule, error) {
	rows, err := s.store.Rules(ctx)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "list auto-download rules")
	}

	rules := make([]TorrentRule, 0, len(rows))
	for i := range rows {
		rules = append(rules, ruleView(&rows[i]))
	}

	return rules, nil
}

// Rule returns nil when the title has no rule.
func (s *Service) Rule(ctx context.Context, mediaRef string) (*TorrentRule, error) {
	row, err := s.store.Rule(ctx, mediaRef)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read the auto-download rule")
	}
	if row == nil {
		return nil, nil
	}

	rule := ruleView(row)

	return &rule, nil
}

func (s *Service) PutRule(ctx context.Context, in RuleInput) (*TorrentRule, error) {
	in.MediaRef = strings.TrimSpace(in.MediaRef)
	in.Title = strings.TrimSpace(in.Title)
	in.Query = strings.TrimSpace(in.Query)

	if in.MediaRef == "" {
		return nil, apperr.Invalid("media_ref", "a rule has to be for a title")
	}
	if in.Title == "" {
		return nil, apperr.Invalid("title", "a rule needs the title's name for its folder")
	}

	from := 1
	switch {
	case in.FromEpisode != nil && *in.FromEpisode < 1:
		return nil, apperr.Invalid("from_episode", "episodes start at 1")
	case in.FromEpisode != nil:
		from = *in.FromEpisode
	default:
		owned, err := s.library.Episodes(ctx, in.MediaRef)
		if err != nil {
			return nil, err
		}
		if len(owned) > 0 {
			from = slices.Max(owned) + 1
		}
	}

	row, err := s.store.PutRule(ctx, store.RuleInput{
		MediaRef:    in.MediaRef,
		Title:       in.Title,
		Query:       in.Query,
		FromEpisode: from,
		Enabled:     in.Enabled,
	}, s.opts.Now())
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "save the auto-download rule")
	}

	s.publish("rules", 0)

	rule := ruleView(row)

	return &rule, nil
}

func (s *Service) DeleteRule(ctx context.Context, mediaRef string) error {
	deleted, err := s.store.DeleteRule(ctx, mediaRef)
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "delete the auto-download rule")
	}
	if !deleted {
		return apperr.New(apperr.KindNotFound, "%s has no auto-download rule", mediaRef)
	}

	s.publish("rules", 0)

	return nil
}

// CheckRule looks for the rule's missing episodes now. A preview only says what
// it would download; otherwise the downloads are added.
func (s *Service) CheckRule(ctx context.Context, mediaRef string, preview bool) (*TorrentRuleCheck, error) {
	rule, err := s.store.Rule(ctx, mediaRef)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read the auto-download rule")
	}
	if rule == nil {
		return nil, apperr.New(apperr.KindNotFound, "%s has no auto-download rule", mediaRef)
	}

	return s.runRule(ctx, rule, preview)
}

func (s *Service) runRule(ctx context.Context, rule *store.Rule, preview bool) (*TorrentRuleCheck, error) {
	planned, err := s.plan(ctx, rule)
	if err != nil {
		if !preview {
			s.recordCheck(ctx, rule, 0, messageOf(err))
		}
		return nil, err
	}

	check := &TorrentRuleCheck{Planned: planned}
	if preview {
		return check, nil
	}

	for i := range planned {
		_, err := s.Add(ctx, AddRequest{
			MediaRef:  rule.MediaRef,
			Title:     rule.Title,
			ReleaseID: planned[i].Release.ID,
			Episodes:  planned[i].Episodes,
			// A batch is held until its file list arrives, and then only these
			// episodes' files are taken.
			ChooseFiles: planned[i].Release.Batch || len(planned[i].Episodes) > 1,
		})

		switch {
		case err == nil:
			check.Added++
		case apperr.KindOf(err) == apperr.KindConflict:
			// The same torrent is already downloading for something else.
		case check.Error == "":
			check.Error = messageOf(err)
		}
	}

	s.recordCheck(ctx, rule, check.Added, check.Error)

	return check, nil
}

func (s *Service) recordCheck(ctx context.Context, rule *store.Rule, added int, reason string) {
	if err := s.store.SetRuleChecked(ctx, rule.ID, added, reason, s.opts.Now()); err != nil {
		s.logger.Error().Err(err).Str("media_ref", rule.MediaRef).Msg("save auto-download check")
	}

	s.publish("rules", 0)
}

// plan picks, for every episode the title is missing, the best release that
// holds that episode alone. What no such release covers is taken from batches —
// the ones that cover most of it first — and only the missing episodes' files of
// a batch are downloaded. Some sites publish nothing else: AniLiberty keeps one
// torrent per season and grows its range as episodes come out.
func (s *Service) plan(ctx context.Context, rule *store.Rule) ([]TorrentPlannedDownload, error) {
	owned, err := s.library.Episodes(ctx, rule.MediaRef)
	if err != nil {
		return nil, err
	}

	queued, err := s.store.DownloadEpisodes(ctx, rule.MediaRef)
	if err != nil {
		s.logger.Error().Err(err).Str("media_ref", rule.MediaRef).Str("query", rule.Query).
			Msg("auto-download check: could not read the title's downloads")
		return nil, apperr.New(apperr.KindInternal, "could not read the title's downloads: details are in the log")
	}

	have := map[int]bool{}
	for _, episode := range append(owned, queued...) {
		have[episode] = true
	}

	var total *int
	if s.opts.Titles != nil {
		if total, err = s.opts.Titles.TotalEpisodes(ctx, rule.MediaRef); err != nil {
			return nil, err
		}
	}

	wanted := func(episode int) bool {
		return episode >= rule.FromEpisode && !have[episode] && (total == nil || *total <= 0 || episode <= *total)
	}

	names, err := s.ruleNames(ctx, rule)
	if err != nil {
		return nil, err
	}

	result, err := s.Search(ctx, SearchRequest{MediaRef: rule.MediaRef, Query: rule.Query})
	if err != nil {
		s.logger.Error().Err(err).Str("media_ref", rule.MediaRef).Str("query", rule.Query).
			Msg("auto-download check: search failed")
		return nil, err
	}

	singles := map[int]TorrentRelease{}
	var batches []TorrentRelease

	for i := range result.Releases {
		found := result.Releases[i]
		if found.Episodes == nil || !found.Eligible || !namesTitle(found.Title, names) {
			continue
		}

		if found.Episodes.From != found.Episodes.To {
			batches = append(batches, found)
			continue
		}

		episode := found.Episodes.From
		if !wanted(episode) {
			continue
		}
		if current, ok := singles[episode]; !ok || beats(found, current) {
			singles[episode] = found
		}
	}

	planned := make([]TorrentPlannedDownload, 0, len(singles))
	for episode := range singles {
		planned = append(planned, TorrentPlannedDownload{Episodes: []int{episode}, Release: singles[episode]})
	}

	missing := map[int]bool{}
	for i := range batches {
		for episode := batches[i].Episodes.From; episode <= batches[i].Episodes.To; episode++ {
			if _, single := singles[episode]; wanted(episode) && !single {
				missing[episode] = true
			}
		}
	}

	for len(missing) > 0 {
		pick, covered := -1, []int(nil)

		for i := range batches {
			var holds []int
			for episode := batches[i].Episodes.From; episode <= batches[i].Episodes.To; episode++ {
				if missing[episode] {
					holds = append(holds, episode)
				}
			}

			if len(holds) == 0 {
				continue
			}
			if pick < 0 || len(holds) > len(covered) || (len(holds) == len(covered) && beats(batches[i], batches[pick])) {
				pick, covered = i, holds
			}
		}

		if pick < 0 {
			break
		}

		for _, episode := range covered {
			delete(missing, episode)
		}
		planned = append(planned, TorrentPlannedDownload{Episodes: covered, Release: batches[pick]})
	}

	slices.SortFunc(planned, func(a, b TorrentPlannedDownload) int { return a.Episodes[0] - b.Episodes[0] })

	return planned, nil
}

// ruleNames are what a release has to be called to be the rule's title: the
// rule's own query and the title's names.
func (s *Service) ruleNames(ctx context.Context, rule *store.Rule) ([]string, error) {
	var names []string
	if rule.Query != "" {
		names = append(names, rule.Query)
	}

	if s.opts.Titles != nil {
		known, err := s.opts.Titles.Names(ctx, rule.MediaRef)
		if err != nil {
			return nil, err
		}
		names = append(names, known...)
	}

	if len(names) == 0 {
		return nil, apperr.New(apperr.KindPrecondition, "the node does not know this title's names yet; set what to search for")
	}

	return names, nil
}

// watchRules runs every enabled rule on an interval until ctx ends.
func (s *Service) watchRules(ctx context.Context) {
	timer := time.NewTimer(ruleStartDelay)
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
		}

		s.runRules(ctx)
		timer.Reset(s.opts.RuleInterval)
	}
}

func (s *Service) runRules(ctx context.Context) {
	rules, err := s.store.Rules(ctx)
	if err != nil {
		s.logger.Error().Err(err).Msg("list auto-download rules")
		return
	}

	for i := range rules {
		if !rules[i].Enabled {
			continue
		}

		if _, err := s.runRule(ctx, &rules[i], false); err != nil {
			s.logger.Debug().Err(err).Str("media_ref", rules[i].MediaRef).Msg("auto-download check failed")
		}
	}
}
