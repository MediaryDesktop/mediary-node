package service

import (
	"context"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/modules/tracker/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

const (
	MediaTypeMovie  MediaType = "movie"
	MediaTypeSeries MediaType = "series"
	MediaTypeDorama MediaType = "dorama"
	MediaTypeBook   MediaType = "book"
)

const ProviderLocal = "local"

// The status lists a local collection reports, in AniList's order.
var localStatuses = []string{"CURRENT", "PLANNING", "COMPLETED", "PAUSED", "DROPPED", "REPEATING"}

// local reports whether the node itself keeps the list for this media type.
func (t MediaType) local() bool {
	return t == MediaTypeMovie || t == MediaTypeSeries || t == MediaTypeDorama || t == MediaTypeBook
}

var localRef = regexp.MustCompile(`^(tmdb:(movie|tv):[1-9]\d*|openlibrary:OL[1-9]\d*W)$`)

// isLocalRef is a title from a source whose list the node keeps: TMDB's movies
// and shows, Open Library's books.
func isLocalRef(mediaRef string) bool {
	return strings.HasPrefix(mediaRef, "tmdb:") || strings.HasPrefix(mediaRef, "openlibrary:")
}

func validateLocalRef(mediaRef string) error {
	if !localRef.MatchString(mediaRef) {
		return apperr.Invalid("media_ref", "malformed media reference %q", mediaRef)
	}

	return nil
}

// LocalTitle is what the tracker shows of a title it does not describe itself.
type LocalTitle struct {
	MediaType MediaType
	Media     Media
}

// TitleInfo names and pictures the titles on a local list. The tracker keeps only
// the user's own data; the rest comes from whoever caches the source.
type TitleInfo interface {
	// Describe answers from what the node already holds and never goes to the
	// network; a title it has nothing for is left out.
	Describe(ctx context.Context, mediaRefs []string) map[string]LocalTitle

	// Lookup asks the source when the node holds nothing.
	Lookup(ctx context.Context, mediaRef string) (*LocalTitle, error)
}

func (s *Service) localCollection(ctx context.Context, mediaType MediaType) (*Collection, error) {
	rows, err := s.store.LocalEntries(ctx, string(mediaType))
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read %s list", mediaType)
	}

	membership, err := s.store.ListMembership(ctx, string(mediaType))
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read %s lists", mediaType)
	}

	refs := make([]string, 0, len(rows))
	for i := range rows {
		refs = append(refs, rows[i].MediaRef)
	}

	titles := s.localTitles(ctx, refs)
	listsOf := map[string][]string{}

	for _, member := range membership {
		listsOf[member.MediaRef] = append(listsOf[member.MediaRef], member.Name)
	}

	collection := &Collection{
		MediaType: mediaType,
		Entries:   make([]Entry, 0, len(rows)),
		FetchedAt: s.opts.Now().UTC(),
	}

	counts := map[string]int{}

	for i := range rows {
		collection.Entries = append(collection.Entries, localEntry(&rows[i], titles[rows[i].MediaRef].Media, listsOf[rows[i].MediaRef]))
		counts[rows[i].Status]++
	}

	collection.Lists, err = s.localLists(ctx, mediaType, counts, membership)
	if err != nil {
		return nil, err
	}

	return collection, nil
}

// localTitles describes the titles on a list from the cache, and asks the source
// for the few it has nothing for — a title added months ago whose details aged
// out. One failure to reach the source ends the asking: offline, every further
// title would only wait for the same answer.
func (s *Service) localTitles(ctx context.Context, refs []string) map[string]LocalTitle {
	if s.opts.Titles == nil || len(refs) == 0 {
		return map[string]LocalTitle{}
	}

	titles := s.opts.Titles.Describe(ctx, refs)

	for _, ref := range refs {
		if _, ok := titles[ref]; ok {
			continue
		}

		title, err := s.opts.Titles.Lookup(ctx, ref)
		if err != nil {
			s.logger.Debug().Err(err).Str("media_ref", ref).Msg("title on a local list is not described")

			if apperr.KindOf(err) == apperr.KindUnavailable || apperr.KindOf(err) == apperr.KindPrecondition {
				break
			}

			continue
		}

		titles[ref] = *title
	}

	return titles
}

func (s *Service) localLists(ctx context.Context, mediaType MediaType, counts map[string]int, membership []store.Membership) ([]List, error) {
	lists := []List{}

	for _, status := range localStatuses {
		if counts[status] == 0 {
			continue
		}

		value := status
		lists = append(lists, List{Name: status, Status: &value, Count: counts[status]})
	}

	declared, err := s.store.CustomLists(ctx)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read custom lists")
	}

	sizes := map[int64]int{}
	for _, member := range membership {
		sizes[member.ListID]++
	}

	for _, list := range declared {
		if list.MediaType == string(mediaType) {
			lists = append(lists, List{Name: list.Name, Custom: true, Count: sizes[list.ID]})
		}
	}

	return lists, nil
}

func (s *Service) updateLocalEntry(ctx context.Context, mediaRef string, patch EntryPatch) (*Entry, error) {
	if err := validateLocalRef(mediaRef); err != nil {
		return nil, err
	}

	now := s.opts.Now()

	existing, err := s.store.LocalEntry(ctx, mediaRef)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read entry")
	}

	title, err := s.localTitle(ctx, mediaRef, existing == nil)
	if err != nil {
		return nil, err
	}

	entry := existing
	if entry == nil {
		entry = &store.LocalEntry{
			MediaRef:  mediaRef,
			MediaType: string(title.MediaType),
			Status:    "PLANNING",
			CreatedAt: now,
		}
	}

	applyLocalPatch(entry, patch, title.Media.length(MediaType(entry.MediaType)), now)
	entry.UpdatedAt = now

	var listIDs []int64
	if patch.CustomLists != nil {
		listIDs, err = s.localListIDs(ctx, MediaType(entry.MediaType), *patch.CustomLists)
		if err != nil {
			return nil, err
		}
	}

	if err = s.store.SaveLocalEntry(ctx, entry, listIDs); err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "save entry")
	}

	lists, err := s.localListsOf(ctx, MediaType(entry.MediaType), mediaRef)
	if err != nil {
		return nil, err
	}

	s.hub.Publish(events.TopicTracker, map[string]any{"media_type": entry.MediaType, "reason": "updated"})

	saved := localEntry(entry, title.Media, lists)

	return &saved, nil
}

// localTitle describes the title being edited. Adding one needs its media type,
// so a title the node has never seen is looked up; an edit of a listed one goes
// on offline with whatever the cache holds.
func (s *Service) localTitle(ctx context.Context, mediaRef string, adding bool) (*LocalTitle, error) {
	if s.opts.Titles == nil {
		return nil, apperr.New(apperr.KindPrecondition, "this node cannot describe %q", mediaRef)
	}

	title := &LocalTitle{}

	if described, ok := s.opts.Titles.Describe(ctx, []string{mediaRef})[mediaRef]; ok {
		title = &described
	} else {
		looked, err := s.opts.Titles.Lookup(ctx, mediaRef)
		if err != nil && adding {
			return nil, err
		}

		if err == nil {
			title = looked
		}
	}

	if adding && !title.MediaType.local() {
		return nil, apperr.Invalid("media_ref", "%q is tracked on AniList, not on this node", mediaRef)
	}

	return title, nil
}

// length is what progress counts up to: episodes, or pages for a book.
func (m *Media) length(mediaType MediaType) *int {
	if mediaType == MediaTypeBook {
		return m.Pages
	}

	return m.Episodes
}

// applyLocalPatch applies the change and does what AniList's own site does around
// progress: the first episode — or page — starts the title, the last one
// completes it, and each sets its date when the user has not.
func applyLocalPatch(entry *store.LocalEntry, patch EntryPatch, episodes *int, now time.Time) {
	if patch.Status != nil {
		entry.Status = *patch.Status
	}
	if patch.Score != nil {
		entry.Score = *patch.Score
	}
	if patch.Progress != nil {
		entry.Progress = *patch.Progress
	}
	if patch.Repeat != nil {
		entry.Repeat = *patch.Repeat
	}
	if patch.Notes != nil {
		entry.Notes = *patch.Notes
	}
	if patch.StartedAt != nil {
		entry.Started = dateParts(*patch.StartedAt)
	}
	if patch.CompletedAt != nil {
		entry.Completed = dateParts(*patch.CompletedAt)
	}

	if patch.Progress == nil || patch.Status != nil || entry.Progress == 0 {
		return
	}

	today := dateParts(Date{Year: intPointer(now.Year()), Month: intPointer(int(now.Month())), Day: intPointer(now.Day())})

	if entry.Status == "PLANNING" {
		entry.Status = "CURRENT"
	}

	if patch.StartedAt == nil && entry.Started.Year == nil {
		entry.Started = today
	}

	if episodes != nil && *episodes > 0 && entry.Progress >= *episodes && entry.Status != "COMPLETED" {
		entry.Status = "COMPLETED"

		if patch.CompletedAt == nil && entry.Completed.Year == nil {
			entry.Completed = today
		}
	}
}

func (s *Service) localListIDs(ctx context.Context, mediaType MediaType, names []string) ([]int64, error) {
	declared, err := s.store.CustomLists(ctx)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read custom lists")
	}

	ids := make([]int64, 0, len(names))

	for _, name := range names {
		at := slices.IndexFunc(declared, func(list store.CustomList) bool {
			return list.MediaType == string(mediaType) && list.Name == name
		})
		if at < 0 {
			return nil, apperr.Invalid("custom_lists", "no %s list named %q", mediaType, name)
		}

		ids = append(ids, declared[at].ID)
	}

	return ids, nil
}

func (s *Service) localListsOf(ctx context.Context, mediaType MediaType, mediaRef string) ([]string, error) {
	membership, err := s.store.ListMembership(ctx, string(mediaType))
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read lists")
	}

	names := []string{}
	for _, member := range membership {
		if member.MediaRef == mediaRef {
			names = append(names, member.Name)
		}
	}

	return names, nil
}

// DeleteEntry takes a title off the user's list. Only the node's own lists can be
// edited this way for now; AniList's are edited on AniList.
func (s *Service) DeleteEntry(ctx context.Context, mediaRef string) error {
	if !isLocalRef(mediaRef) {
		return apperr.New(apperr.KindPrecondition, "removing an AniList entry is not supported yet")
	}

	if err := validateLocalRef(mediaRef); err != nil {
		return err
	}

	existing, err := s.store.LocalEntry(ctx, mediaRef)
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "read entry")
	}

	deleted, err := s.store.DeleteLocalEntry(ctx, mediaRef)
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "delete entry")
	}

	if !deleted || existing == nil {
		return apperr.New(apperr.KindNotFound, "%q is not on the list", mediaRef)
	}

	s.hub.Publish(events.TopicTracker, map[string]any{"media_type": existing.MediaType, "reason": "removed"})

	return nil
}

// raiseLocalProgress is the player's and the reader's way in: it never lowers
// progress the user already has, as AniList's queue never does.
func (s *Service) raiseLocalProgress(ctx context.Context, mediaRef string, progress int) error {
	existing, err := s.store.LocalEntry(ctx, mediaRef)
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "read entry")
	}

	if existing != nil && existing.Progress >= progress {
		return nil
	}

	_, err = s.updateLocalEntry(ctx, mediaRef, EntryPatch{Progress: &progress})

	return err
}

// localListCovers is up to four posters per local list, from the cache only: a
// page of list thumbnails must not become a request per title.
func (s *Service) localListCovers(ctx context.Context) (map[int64][]string, error) {
	covers := map[int64][]string{}

	if s.opts.Titles == nil {
		return covers, nil
	}

	for _, mediaType := range []MediaType{MediaTypeMovie, MediaTypeSeries, MediaTypeDorama, MediaTypeBook} {
		membership, err := s.store.ListMembership(ctx, string(mediaType))
		if err != nil {
			return nil, apperr.Wrap(err, apperr.KindInternal, "read %s lists", mediaType)
		}

		refs := make([]string, 0, len(membership))
		for _, member := range membership {
			refs = append(refs, member.MediaRef)
		}

		titles := s.opts.Titles.Describe(ctx, refs)

		for _, member := range membership {
			cover := titles[member.MediaRef].Media.CoverImage
			if cover != nil && len(covers[member.ListID]) < listCoverCount {
				covers[member.ListID] = append(covers[member.ListID], *cover)
			}
		}
	}

	return covers, nil
}

func localEntry(row *store.LocalEntry, media Media, lists []string) Entry {
	if lists == nil {
		lists = []string{}
	}
	if media.Genres == nil {
		media.Genres = []string{}
	}

	return Entry{
		MediaRef:    row.MediaRef,
		Provider:    ProviderLocal,
		MediaType:   MediaType(row.MediaType),
		Status:      row.Status,
		Score:       row.Score,
		Progress:    row.Progress,
		Repeat:      row.Repeat,
		Private:     row.Private,
		Notes:       row.Notes,
		StartedAt:   Date{Year: row.Started.Year, Month: row.Started.Month, Day: row.Started.Day},
		CompletedAt: Date{Year: row.Completed.Year, Month: row.Completed.Month, Day: row.Completed.Day},
		UpdatedAt:   row.UpdatedAt.UTC(),
		CustomLists: lists,
		Media:       media,
	}
}

func dateParts(date Date) store.DateParts {
	return store.DateParts{Year: date.Year, Month: date.Month, Day: date.Day}
}

func intPointer(value int) *int { return &value }
