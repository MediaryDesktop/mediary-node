package service

import (
	"context"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

const (
	maxListNameLength = 100
	listCoverCount    = 4
)

type ListProvider string

const (
	ListProviderAniList ListProvider = "anilist"
	ListProviderLocal   ListProvider = "local"
)

type ListMediaType string

const (
	ListMediaTypeAnime  ListMediaType = "anime"
	ListMediaTypeManga  ListMediaType = "manga"
	ListMediaTypeMovie  ListMediaType = "movie"
	ListMediaTypeSeries ListMediaType = "series"
	ListMediaTypeDorama ListMediaType = "dorama"
	ListMediaTypeBook   ListMediaType = "book"
)

// CustomList is one user-made list. Anime and manga lists are the account's
// AniList custom lists; the rest live in this node's database.
type CustomList struct {
	ID        string        `json:"id" doc:"Opaque identifier; pass it back URL-encoded to rename or delete the list."`
	Provider  ListProvider  `json:"provider" enum:"anilist,local" doc:"Where the list lives: anilist or local."`
	MediaType ListMediaType `json:"media_type" enum:"anime,manga,movie,series,dorama,book" doc:"The one media type this list holds."`
	Name      string        `json:"name"`
	Count     int           `json:"count" doc:"How many titles are in the list."`
	Covers    []string      `json:"covers" doc:"Up to four cover images, for the list's thumbnail."`
	UpdatedAt *time.Time    `json:"updated_at,omitempty" doc:"When a title in the list last changed. Absent for an empty list."`
}

func (t ListMediaType) tracked() bool {
	return t == ListMediaTypeAnime || t == ListMediaTypeManga
}

func (t ListMediaType) trackerType() MediaType {
	if t == ListMediaTypeManga {
		return MediaTypeManga
	}

	return MediaTypeAnime
}

func aniListListID(mediaType MediaType, name string) string {
	return string(ListProviderAniList) + ":" + string(mediaType) + ":" + name
}

func localListID(id int64) string {
	return string(ListProviderLocal) + ":" + strconv.FormatInt(id, 10)
}

type listRef struct {
	provider  ListProvider
	mediaType ListMediaType
	name      string
	localID   int64
}

func parseListID(id string) (listRef, error) {
	invalid := apperr.Invalid("id", "not a list identifier")

	provider, rest, found := strings.Cut(id, ":")
	if !found || rest == "" {
		return listRef{}, invalid
	}

	switch ListProvider(provider) {
	case ListProviderLocal:
		localID, err := strconv.ParseInt(rest, 10, 64)
		if err != nil {
			return listRef{}, invalid
		}

		return listRef{provider: ListProviderLocal, localID: localID}, nil

	case ListProviderAniList:
		mediaType, name, found := strings.Cut(rest, ":")
		if !found || name == "" {
			return listRef{}, invalid
		}

		listType := ListMediaType(mediaType)
		if !listType.tracked() {
			return listRef{}, invalid
		}

		return listRef{provider: ListProviderAniList, mediaType: listType, name: name}, nil

	default:
		return listRef{}, invalid
	}
}

func normalizeListName(name string) (string, error) {
	trimmed := strings.TrimSpace(name)

	if trimmed == "" {
		return "", apperr.Invalid("name", "a list needs a name")
	}

	if len([]rune(trimmed)) > maxListNameLength {
		return "", apperr.Invalid("name", "a list name is at most %d characters", maxListNameLength)
	}

	return trimmed, nil
}

func (s *Service) Lists(ctx context.Context) ([]CustomList, error) {
	lists := []CustomList{}

	connected, err := s.connected()
	if err != nil {
		return nil, err
	}

	if connected {
		for _, mediaType := range []MediaType{MediaTypeAnime, MediaTypeManga} {
			collection, mirrorErr := s.mirroredCollection(ctx, mediaType)
			if mirrorErr != nil {
				return nil, mirrorErr
			}

			if collection == nil {
				s.refreshInBackground(ctx, mediaType)
				continue
			}

			lists = append(lists, aniListCustomLists(collection)...)
		}
	}

	rows, err := s.store.CustomLists(ctx)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read custom lists")
	}

	for _, row := range rows {
		lists = append(lists, CustomList{
			ID:        localListID(row.ID),
			Provider:  ListProviderLocal,
			MediaType: ListMediaType(row.MediaType),
			Name:      row.Name,
			Count:     row.Count,
			Covers:    []string{},
		})
	}

	return lists, nil
}

func (s *Service) CreateList(ctx context.Context, mediaType ListMediaType, name string) (*CustomList, error) {
	clean, err := normalizeListName(name)
	if err != nil {
		return nil, err
	}

	if !mediaType.tracked() {
		row, createErr := s.store.CreateCustomList(ctx, string(mediaType), clean, s.opts.Now())
		if createErr != nil {
			if isUniqueViolation(createErr) {
				return nil, apperr.New(apperr.KindConflict, "a %s list named %q already exists", mediaType, clean)
			}

			return nil, apperr.Wrap(createErr, apperr.KindInternal, "create custom list")
		}

		s.publishLists("created")

		return &CustomList{
			ID:        localListID(row.ID),
			Provider:  ListProviderLocal,
			MediaType: mediaType,
			Name:      row.Name,
			Covers:    []string{},
		}, nil
	}

	err = s.rewriteAniListCustomLists(ctx, mediaType, func(names []string) ([]string, error) {
		if slices.Contains(names, clean) {
			return nil, apperr.New(apperr.KindConflict, "a %s list named %q already exists", mediaType, clean)
		}

		return append(names, clean), nil
	})
	if err != nil {
		return nil, err
	}

	return &CustomList{
		ID:        aniListListID(mediaType.trackerType(), clean),
		Provider:  ListProviderAniList,
		MediaType: mediaType,
		Name:      clean,
		Covers:    []string{},
	}, nil
}

func (s *Service) RenameList(ctx context.Context, id, name string) (*CustomList, error) {
	ref, err := parseListID(id)
	if err != nil {
		return nil, err
	}

	clean, err := normalizeListName(name)
	if err != nil {
		return nil, err
	}

	if ref.provider == ListProviderLocal {
		list, readErr := s.store.CustomList(ctx, ref.localID)
		if readErr != nil {
			return nil, apperr.Wrap(readErr, apperr.KindInternal, "read custom list")
		}

		if list == nil {
			return nil, apperr.New(apperr.KindNotFound, "no such list")
		}

		renamed, renameErr := s.store.RenameCustomList(ctx, ref.localID, clean)
		if renameErr != nil {
			if isUniqueViolation(renameErr) {
				return nil, apperr.New(apperr.KindConflict, "a list named %q already exists", clean)
			}

			return nil, apperr.Wrap(renameErr, apperr.KindInternal, "rename custom list")
		}

		if !renamed {
			return nil, apperr.New(apperr.KindNotFound, "no such list")
		}

		s.publishLists("renamed")

		return &CustomList{
			ID:        localListID(ref.localID),
			Provider:  ListProviderLocal,
			MediaType: ListMediaType(list.MediaType),
			Name:      clean,
			Covers:    []string{},
		}, nil
	}

	err = s.rewriteAniListCustomLists(ctx, ref.mediaType, func(names []string) ([]string, error) {
		at := slices.Index(names, ref.name)
		if at < 0 {
			return nil, apperr.New(apperr.KindNotFound, "no such list")
		}

		if clean != ref.name && slices.Contains(names, clean) {
			return nil, apperr.New(apperr.KindConflict, "a list named %q already exists", clean)
		}

		renamed := slices.Clone(names)
		renamed[at] = clean

		return renamed, nil
	})
	if err != nil {
		return nil, err
	}

	return &CustomList{
		ID:        aniListListID(ref.mediaType.trackerType(), clean),
		Provider:  ListProviderAniList,
		MediaType: ref.mediaType,
		Name:      clean,
		Covers:    []string{},
	}, nil
}

func (s *Service) DeleteList(ctx context.Context, id string) error {
	ref, err := parseListID(id)
	if err != nil {
		return err
	}

	if ref.provider == ListProviderLocal {
		deleted, err := s.store.DeleteCustomList(ctx, ref.localID)
		if err != nil {
			return apperr.Wrap(err, apperr.KindInternal, "delete custom list")
		}

		if !deleted {
			return apperr.New(apperr.KindNotFound, "no such list")
		}

		s.publishLists("deleted")

		return nil
	}

	return s.rewriteAniListCustomLists(ctx, ref.mediaType, func(names []string) ([]string, error) {
		at := slices.Index(names, ref.name)
		if at < 0 {
			return nil, apperr.New(apperr.KindNotFound, "no such list")
		}

		return slices.Delete(slices.Clone(names), at, at+1), nil
	})
}

// rewriteAniListCustomLists reads both arrays straight from AniList, applies
// mutate to the one for mediaType and writes both back. Reading first is what
// keeps a list created on the AniList site from being erased here: the mutation
// replaces the whole array, so a stale copy would silently drop everything the
// node has not seen.
func (s *Service) rewriteAniListCustomLists(
	ctx context.Context,
	mediaType ListMediaType,
	mutate func([]string) ([]string, error),
) error {
	connected, err := s.connected()
	if err != nil {
		return err
	}

	if !connected {
		return apperr.New(apperr.KindPrecondition, "anilist account is not connected")
	}

	viewer, err := s.opts.AniList.Viewer(ctx)
	if err != nil {
		return s.handleRejected(ctx, err)
	}

	anime := viewer.MediaListOptions.AnimeList.CustomLists
	manga := viewer.MediaListOptions.MangaList.CustomLists

	if mediaType == ListMediaTypeManga {
		manga, err = mutate(manga)
	} else {
		anime, err = mutate(anime)
	}

	if err != nil {
		return err
	}

	if _, err := s.opts.AniList.UpdateCustomLists(ctx, anime, manga); err != nil {
		return s.handleRejected(ctx, err)
	}

	s.publishLists("changed")
	s.refreshInBackground(ctx, mediaType.trackerType())

	return nil
}

func (s *Service) publishLists(reason string) {
	s.hub.Publish(events.TopicTracker, map[string]any{"reason": reason, "scope": "lists"})
}

func aniListCustomLists(collection *Collection) []CustomList {
	type aggregate struct {
		covers    []string
		updatedAt time.Time
	}

	aggregates := make(map[string]*aggregate)

	for i := range collection.Entries {
		entry := &collection.Entries[i]

		for _, name := range entry.CustomLists {
			item := aggregates[name]
			if item == nil {
				item = &aggregate{covers: []string{}}
				aggregates[name] = item
			}

			if len(item.covers) < listCoverCount && entry.Media.CoverImage != nil {
				item.covers = append(item.covers, *entry.Media.CoverImage)
			}

			if entry.UpdatedAt.After(item.updatedAt) {
				item.updatedAt = entry.UpdatedAt
			}
		}
	}

	lists := []CustomList{}

	for _, list := range collection.Lists {
		if !list.Custom {
			continue
		}

		out := CustomList{
			ID:        aniListListID(collection.MediaType, list.Name),
			Provider:  ListProviderAniList,
			MediaType: ListMediaType(collection.MediaType),
			Name:      list.Name,
			Count:     list.Count,
			Covers:    []string{},
		}

		if item := aggregates[list.Name]; item != nil {
			out.Covers = item.covers

			if !item.updatedAt.IsZero() {
				updatedAt := item.updatedAt
				out.UpdatedAt = &updatedAt
			}
		}

		lists = append(lists, out)
	}

	return lists
}

func isUniqueViolation(err error) bool {
	return err != nil && strings.Contains(err.Error(), "UNIQUE constraint failed")
}
