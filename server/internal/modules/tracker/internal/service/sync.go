package service

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/modules/tracker/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anilist"
)

const (
	defaultFlushDelay = 1500 * time.Millisecond
	flushTimeout      = 2 * time.Minute
	maxFlushAttempts  = 5
	maxNotesLength    = 10000
)

var entryStatuses = map[string]bool{
	"CURRENT":   true,
	"PLANNING":  true,
	"COMPLETED": true,
	"DROPPED":   true,
	"PAUSED":    true,
	"REPEATING": true,
}

type EntryPatch struct {
	Status          *string   `json:"status,omitempty"`
	Score           *int      `json:"score,omitempty"`
	Progress        *int      `json:"progress,omitempty"`
	ProgressVolumes *int      `json:"progress_volumes,omitempty"`
	Repeat          *int      `json:"repeat,omitempty"`
	Notes           *string   `json:"notes,omitempty"`
	StartedAt       *Date     `json:"started_at,omitempty"`
	CompletedAt     *Date     `json:"completed_at,omitempty"`
	CustomLists     *[]string `json:"custom_lists,omitempty"`
}

func (p EntryPatch) empty() bool {
	return p.Status == nil && p.Score == nil && p.Progress == nil && p.ProgressVolumes == nil &&
		p.Repeat == nil && p.Notes == nil && p.StartedAt == nil && p.CompletedAt == nil && p.CustomLists == nil
}

func (p EntryPatch) validate() error {
	if p.empty() {
		return apperr.New(apperr.KindInvalid, "nothing to change")
	}

	if p.Status != nil && !entryStatuses[*p.Status] {
		return apperr.Invalid("status", "unknown status %q", *p.Status)
	}

	if p.Score != nil && (*p.Score < 0 || *p.Score > 100) {
		return apperr.Invalid("score", "score must be between 0 and 100")
	}

	for field, value := range map[string]*int{
		"progress":         p.Progress,
		"progress_volumes": p.ProgressVolumes,
		"repeat":           p.Repeat,
	} {
		if value != nil && *value < 0 {
			return apperr.Invalid(field, "%s cannot be negative", field)
		}
	}

	if p.Notes != nil && len([]rune(*p.Notes)) > maxNotesLength {
		return apperr.Invalid("notes", "notes are at most %d characters", maxNotesLength)
	}

	for field, value := range map[string]*Date{
		"started_at":   p.StartedAt,
		"completed_at": p.CompletedAt,
	} {
		if value == nil {
			continue
		}

		if err := value.validate(field); err != nil {
			return err
		}
	}

	if p.CustomLists != nil {
		seen := map[string]bool{}

		for _, name := range *p.CustomLists {
			if strings.TrimSpace(name) == "" {
				return apperr.Invalid("custom_lists", "a list name cannot be empty")
			}

			if seen[name] {
				return apperr.Invalid("custom_lists", "list %q is listed twice", name)
			}

			seen[name] = true
		}
	}

	return nil
}

func (p EntryPatch) merge(next EntryPatch) EntryPatch {
	if next.Status != nil {
		p.Status = next.Status
	}
	if next.Score != nil {
		p.Score = next.Score
	}
	if next.Progress != nil {
		p.Progress = next.Progress
	}
	if next.ProgressVolumes != nil {
		p.ProgressVolumes = next.ProgressVolumes
	}
	if next.Repeat != nil {
		p.Repeat = next.Repeat
	}
	if next.Notes != nil {
		p.Notes = next.Notes
	}
	if next.StartedAt != nil {
		p.StartedAt = next.StartedAt
	}
	if next.CompletedAt != nil {
		p.CompletedAt = next.CompletedAt
	}
	if next.CustomLists != nil {
		p.CustomLists = next.CustomLists
	}

	return p
}

func (p EntryPatch) apply(entry *Entry) {
	if p.Status != nil {
		entry.Status = *p.Status
	}
	if p.Score != nil {
		entry.Score = *p.Score
	}
	if p.Progress != nil {
		entry.Progress = *p.Progress
	}
	if p.ProgressVolumes != nil {
		volumes := *p.ProgressVolumes
		entry.ProgressVolumes = &volumes
	}
	if p.Repeat != nil {
		entry.Repeat = *p.Repeat
	}
	if p.Notes != nil {
		entry.Notes = *p.Notes
	}
	if p.StartedAt != nil {
		entry.StartedAt = *p.StartedAt
	}
	if p.CompletedAt != nil {
		entry.CompletedAt = *p.CompletedAt
	}
	if p.CustomLists != nil {
		entry.CustomLists = append([]string{}, *p.CustomLists...)
	}
}

func (p EntryPatch) change(mediaID int) anilist.EntryChange {
	change := anilist.EntryChange{
		MediaID:         mediaID,
		Status:          p.Status,
		ScoreRaw:        p.Score,
		Progress:        p.Progress,
		ProgressVolumes: p.ProgressVolumes,
		Repeat:          p.Repeat,
		Notes:           p.Notes,
	}

	if p.StartedAt != nil {
		change.StartedAt = p.StartedAt.aniList()
	}

	if p.CompletedAt != nil {
		change.CompletedAt = p.CompletedAt.aniList()
	}

	if p.CustomLists != nil {
		change.CustomLists = append([]string{}, *p.CustomLists...)
	}

	return change
}

func parseMediaRef(mediaRef string) (int, error) {
	provider, id, found := strings.Cut(mediaRef, ":")
	if !found || provider != ProviderAniList {
		return 0, apperr.Invalid("media_ref", "only anilist titles can be tracked for now")
	}

	mediaID, err := strconv.Atoi(id)
	if err != nil || mediaID <= 0 {
		return 0, apperr.Invalid("media_ref", "malformed media reference %q", mediaRef)
	}

	return mediaID, nil
}

func (s *Service) UpdateEntry(ctx context.Context, mediaRef string, patch EntryPatch) (*Entry, error) {
	if err := patch.validate(); err != nil {
		return nil, err
	}

	mediaID, err := parseMediaRef(mediaRef)
	if err != nil {
		return nil, err
	}

	connected, err := s.connected()
	if err != nil {
		return nil, err
	}
	if !connected {
		return nil, apperr.New(apperr.KindPrecondition, "anilist account is not connected")
	}

	account, err := s.account(ctx)
	if err != nil {
		return nil, err
	}

	mediaType, mirrored, err := s.findMirroredEntry(ctx, mediaRef)
	if err != nil {
		return nil, err
	}
	if mirrored == nil {
		return s.createEntry(ctx, mediaID, patch)
	}

	if err := s.checkCustomLists(ctx, mediaType, patch); err != nil {
		return nil, err
	}

	existing, err := s.store.OutboxEntry(ctx, account.ID, mediaID)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read pending anilist change")
	}

	merged := patch
	if existing != nil {
		var previous EntryPatch
		if decodeErr := json.Unmarshal(existing.Patch, &previous); decodeErr == nil {
			merged = previous.merge(patch)
		}
	}

	payload, err := json.Marshal(merged)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "encode anilist change")
	}

	now := s.opts.Now()

	err = s.store.PutOutboxEntry(ctx, store.OutboxEntry{
		AccountID:     account.ID,
		MediaID:       mediaID,
		MediaType:     string(mediaType),
		Patch:         payload,
		AllowDecrease: decreasesProgress(merged, mirrored),
	}, now)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "queue anilist change")
	}

	view := *mirrored
	merged.apply(&view)
	view.UpdatedAt = now.UTC()
	view.SyncPending = true

	s.hub.Publish(events.TopicTracker, map[string]any{
		"media_type": string(mediaType),
		"reason":     "updated",
	})

	s.scheduleFlush(ctx)

	return &view, nil
}

// createEntry adds a title that is not in the user's lists yet. Unlike an edit it
// is not queued: the mirror has nothing about the title to show until AniList
// answers with it, so an offline add would look saved and then be missing.
func (s *Service) createEntry(ctx context.Context, mediaID int, patch EntryPatch) (*Entry, error) {
	if patch.Status == nil {
		patch.Status = strPointer("PLANNING")
	}

	declared, err := s.declaredCustomLists(ctx)
	if err != nil {
		return nil, err
	}

	if patch.CustomLists != nil {
		for _, name := range *patch.CustomLists {
			if !declared[MediaTypeAnime][name] && !declared[MediaTypeManga][name] {
				return nil, apperr.Invalid("custom_lists", "no list named %q", name)
			}
		}
	}

	saved, err := s.opts.AniList.SaveEntry(ctx, patch.change(mediaID))
	if err != nil {
		if anilist.IsTokenRejected(err) {
			return nil, s.handleRejected(ctx, err)
		}
		return nil, err
	}

	mediaType := MediaType(strings.ToLower(saved.Media.Type))
	if mediaType != MediaTypeAnime && mediaType != MediaTypeManga {
		return nil, apperr.New(apperr.KindUpstream, "anilist returned media %d with type %q", mediaID, saved.Media.Type)
	}

	// A name is only declared for one media type, and AniList silently drops a
	// list of the other type — so the mirror keeps only the ones that took.
	lists := []string{}
	if patch.CustomLists != nil {
		for _, name := range *patch.CustomLists {
			if declared[mediaType][name] {
				lists = append(lists, name)
			}
		}
	}

	entry, err := s.replaceMirroredEntry(ctx, mediaType, saved, lists)
	if err != nil {
		return nil, err
	}

	s.hub.Publish(events.TopicTracker, map[string]any{
		"media_type": string(mediaType),
		"reason":     "updated",
	})

	return entry, nil
}

func (s *Service) declaredCustomLists(ctx context.Context) (map[MediaType]map[string]bool, error) {
	declared := map[MediaType]map[string]bool{}

	for _, mediaType := range []MediaType{MediaTypeAnime, MediaTypeManga} {
		declared[mediaType] = map[string]bool{}

		collection, err := s.mirroredCollection(ctx, mediaType)
		if err != nil {
			return nil, err
		}
		if collection == nil {
			continue
		}

		for _, list := range collection.Lists {
			if list.Custom {
				declared[mediaType][list.Name] = true
			}
		}
	}

	return declared, nil
}

func strPointer(value string) *string { return &value }

// checkCustomLists rejects a list AniList does not know about. The mutation
// takes list names and silently drops the ones the account has not declared, so
// a typo would look saved until the next refresh took it away again.
func (s *Service) checkCustomLists(ctx context.Context, mediaType MediaType, patch EntryPatch) error {
	if patch.CustomLists == nil || len(*patch.CustomLists) == 0 {
		return nil
	}

	collection, err := s.mirroredCollection(ctx, mediaType)
	if err != nil {
		return err
	}

	if collection == nil {
		return nil
	}

	declared := map[string]bool{}

	for _, list := range collection.Lists {
		if list.Custom {
			declared[list.Name] = true
		}
	}

	for _, name := range *patch.CustomLists {
		if !declared[name] {
			return apperr.Invalid("custom_lists", "no %s list named %q", mediaType, name)
		}
	}

	return nil
}

func decreasesProgress(patch EntryPatch, mirrored *Entry) bool {
	if patch.Progress != nil && *patch.Progress < mirrored.Progress {
		return true
	}

	if patch.ProgressVolumes != nil && mirrored.ProgressVolumes != nil && *patch.ProgressVolumes < *mirrored.ProgressVolumes {
		return true
	}

	return false
}

func (s *Service) findMirroredEntry(ctx context.Context, mediaRef string) (MediaType, *Entry, error) {
	for _, mediaType := range []MediaType{MediaTypeAnime, MediaTypeManga} {
		collection, err := s.mirroredCollection(ctx, mediaType)
		if err != nil {
			return "", nil, err
		}
		if collection == nil {
			continue
		}

		for i := range collection.Entries {
			if collection.Entries[i].MediaRef == mediaRef {
				entry := collection.Entries[i]
				return mediaType, &entry, nil
			}
		}
	}

	return "", nil, nil
}

func (s *Service) applyPending(ctx context.Context, collection *Collection) (bool, error) {
	account, err := s.account(ctx)
	if err != nil {
		if apperr.KindOf(err) == apperr.KindUnavailable {
			return false, nil
		}
		return false, err
	}

	pending, err := s.store.Outbox(ctx, account.ID)
	if err != nil {
		return false, apperr.Wrap(err, apperr.KindInternal, "list pending anilist changes")
	}

	if len(pending) == 0 {
		return false, nil
	}

	positions := make(map[string]int, len(collection.Entries))
	for i := range collection.Entries {
		positions[collection.Entries[i].MediaRef] = i
	}

	for _, change := range pending {
		if change.MediaType != string(collection.MediaType) {
			continue
		}

		position, found := positions[aniListMediaRef(change.MediaID)]
		if !found {
			continue
		}

		var patch EntryPatch
		if err := json.Unmarshal(change.Patch, &patch); err != nil {
			continue
		}

		entry := &collection.Entries[position]
		patch.apply(entry)
		entry.SyncPending = true
	}

	return true, nil
}

func (s *Service) scheduleFlush(ctx context.Context) {
	detached := context.WithoutCancel(ctx)

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.flushTimer != nil {
		s.flushTimer.Stop()
	}

	s.flushTimer = time.AfterFunc(s.opts.FlushDelay, func() {
		s.flush(detached)
	})
}

func (s *Service) flush(ctx context.Context) {
	s.flushMu.Lock()
	defer s.flushMu.Unlock()

	ctx, cancel := context.WithTimeout(ctx, flushTimeout)
	defer cancel()

	connected, err := s.connected()
	if err != nil || !connected {
		return
	}

	account, err := s.account(ctx)
	if err != nil {
		return
	}

	pending, err := s.store.Outbox(ctx, account.ID)
	if err != nil {
		s.logger.Error().Err(err).Msg("list pending anilist changes")
		return
	}

	synced := make(map[string]bool)

	for _, change := range pending {
		err := s.deliver(ctx, account, change)
		if err == nil {
			synced[change.MediaType] = true
			continue
		}

		if anilist.IsTokenRejected(err) {
			_ = s.handleRejected(ctx, err)
			break
		}

		if apperr.KindOf(err) == apperr.KindUnavailable {
			s.logger.Debug().Err(err).Msg("anilist unreachable, keeping pending changes")
			break
		}

		s.logger.Warn().Err(err).Int("media_id", change.MediaID).Int("attempt", change.Attempts+1).Msg("anilist rejected a pending change")

		if change.Attempts+1 >= maxFlushAttempts {
			if _, dropErr := s.store.CompleteOutboxEntry(ctx, change); dropErr != nil {
				s.logger.Error().Err(dropErr).Msg("drop undeliverable anilist change")
			}
			synced[change.MediaType] = true
			continue
		}

		if failErr := s.store.FailOutboxEntry(ctx, change, err.Error()); failErr != nil {
			s.logger.Error().Err(failErr).Msg("record failed anilist change")
		}
	}

	for mediaType := range synced {
		s.hub.Publish(events.TopicTracker, map[string]any{
			"media_type": mediaType,
			"reason":     "synced",
		})
	}
}

func (s *Service) deliver(ctx context.Context, account *Account, change store.OutboxEntry) error {
	var patch EntryPatch
	if err := json.Unmarshal(change.Patch, &patch); err != nil {
		_, dropErr := s.store.CompleteOutboxEntry(ctx, change)
		return dropErr
	}

	if !change.AllowDecrease && (patch.Progress != nil || patch.ProgressVolumes != nil) {
		remote, err := s.opts.AniList.RemoteProgress(ctx, account.ID, change.MediaID)
		if err != nil {
			return err
		}
		keepHigherRemoteProgress(&patch, remote)
	}

	if patch.empty() {
		_, err := s.store.CompleteOutboxEntry(ctx, change)
		return err
	}

	saved, err := s.opts.AniList.SaveEntry(ctx, patch.change(change.MediaID))
	if err != nil {
		return err
	}

	var lists []string
	if patch.CustomLists != nil {
		lists = *patch.CustomLists
	}

	if _, replaceErr := s.replaceMirroredEntry(ctx, MediaType(change.MediaType), saved, lists); replaceErr != nil {
		return replaceErr
	}

	_, err = s.store.CompleteOutboxEntry(ctx, change)

	return err
}

func keepHigherRemoteProgress(patch *EntryPatch, remote *anilist.RemoteProgress) {
	if remote == nil {
		return
	}

	if patch.Progress != nil && remote.Progress != nil && *remote.Progress > *patch.Progress {
		patch.Progress = nil
	}

	if patch.ProgressVolumes != nil && remote.ProgressVolumes != nil && *remote.ProgressVolumes > *patch.ProgressVolumes {
		patch.ProgressVolumes = nil
	}
}

// replaceMirroredEntry writes what AniList saved into the mirror. The mutation's
// answer carries no custom lists, so lists is what the change set them to, and
// nil keeps the ones the mirror already has.
func (s *Service) replaceMirroredEntry(
	ctx context.Context,
	mediaType MediaType,
	saved *anilist.ListEntry,
	lists []string,
) (*Entry, error) {
	updated := entryFromAniList(saved, mediaType)
	if lists != nil {
		updated.CustomLists = append([]string{}, lists...)
	}

	collection, err := s.mirroredCollection(ctx, mediaType)
	if err != nil {
		return nil, err
	}
	if collection == nil {
		return &updated, nil
	}

	found := false

	for i := range collection.Entries {
		if collection.Entries[i].MediaRef == updated.MediaRef {
			if lists == nil {
				updated.CustomLists = collection.Entries[i].CustomLists
			}
			collection.Entries[i] = updated
			found = true
			break
		}
	}

	if !found {
		collection.Entries = append(collection.Entries, updated)
	}

	recountStatusLists(collection)

	payload, err := json.Marshal(collection)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "encode anilist collection")
	}

	if err := s.store.PutMirror(ctx, string(mediaType), payload, collection.FetchedAt); err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "store anilist collection")
	}

	return &updated, nil
}

func recountStatusLists(collection *Collection) {
	counts := make(map[string]int)
	for i := range collection.Entries {
		counts[collection.Entries[i].Status]++
	}

	for i := range collection.Lists {
		if collection.Lists[i].Custom || collection.Lists[i].Status == nil {
			continue
		}
		collection.Lists[i].Count = counts[*collection.Lists[i].Status]
	}
}
