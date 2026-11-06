package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/db/sqlc"
)

// Rule makes the node download a title's new episodes by itself.
type Rule struct {
	ID          int64
	MediaRef    string
	Title       string
	Query       string
	FromEpisode int
	Enabled     bool
	LastChecked *time.Time
	LastAdded   int
	LastError   string
}

type RuleInput struct {
	MediaRef    string
	Title       string
	Query       string
	FromEpisode int
	Enabled     bool
}

func (s *Store) Rules(ctx context.Context) ([]Rule, error) {
	rows, err := sqlc.New(s.db).ListTorrentRules(ctx)
	if err != nil {
		return nil, fmt.Errorf("list torrent rules: %w", err)
	}

	rules := make([]Rule, 0, len(rows))
	for i := range rows {
		rules = append(rules, ruleFrom(rows[i]))
	}

	return rules, nil
}

// Rule returns nil when the title has no rule.
func (s *Store) Rule(ctx context.Context, mediaRef string) (*Rule, error) {
	row, err := sqlc.New(s.db).GetTorrentRuleByMedia(ctx, mediaRef)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read torrent rule: %w", err)
	}

	rule := ruleFrom(row)

	return &rule, nil
}

func (s *Store) PutRule(ctx context.Context, in RuleInput, now time.Time) (*Rule, error) {
	stamp := stampOf(now)

	row, err := sqlc.New(s.db).UpsertTorrentRule(ctx, sqlc.UpsertTorrentRuleParams{
		MediaRef:    in.MediaRef,
		Title:       in.Title,
		Query:       in.Query,
		FromEpisode: int64(in.FromEpisode),
		Enabled:     boolInt(in.Enabled),
		CreatedAt:   stamp,
		UpdatedAt:   stamp,
	})
	if err != nil {
		return nil, fmt.Errorf("save torrent rule: %w", err)
	}

	rule := ruleFrom(row)

	return &rule, nil
}

func (s *Store) SetRuleChecked(ctx context.Context, id int64, added int, reason string, now time.Time) error {
	err := sqlc.New(s.db).SetTorrentRuleChecked(ctx, sqlc.SetTorrentRuleCheckedParams{
		LastCheckedAt: stampOf(now),
		LastAdded:     int64(added),
		LastError:     reason,
		ID:            id,
	})
	if err != nil {
		return fmt.Errorf("save torrent rule check: %w", err)
	}

	return nil
}

// DeleteRule reports false when the title had no rule.
func (s *Store) DeleteRule(ctx context.Context, mediaRef string) (bool, error) {
	rows, err := sqlc.New(s.db).DeleteTorrentRule(ctx, mediaRef)
	if err != nil {
		return false, fmt.Errorf("delete torrent rule: %w", err)
	}

	return rows > 0, nil
}

func ruleFrom(row sqlc.TorrentRule) Rule {
	rule := Rule{
		ID:          row.ID,
		MediaRef:    row.MediaRef,
		Title:       row.Title,
		Query:       row.Query,
		FromEpisode: int(row.FromEpisode),
		Enabled:     row.Enabled != 0,
		LastAdded:   int(row.LastAdded),
		LastError:   row.LastError,
	}

	if checked, err := time.Parse(time.RFC3339, row.LastCheckedAt); err == nil {
		rule.LastChecked = &checked
	}

	return rule
}
