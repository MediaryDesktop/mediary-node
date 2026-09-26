package service

import (
	"math"
	"strconv"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anilist"
)

func accountFromViewer(viewer *anilist.Viewer) Account {
	avatar := viewer.Avatar.Large
	if avatar == nil {
		avatar = viewer.Avatar.Medium
	}

	return Account{
		ID:                  viewer.ID,
		Name:                viewer.Name,
		SiteURL:             viewer.SiteURL,
		AvatarURL:           avatar,
		ScoreFormat:         viewer.MediaListOptions.ScoreFormat,
		DisplayAdultContent: viewer.Options.DisplayAdultContent,
	}
}

func aniListMediaRef(mediaID int) string {
	return ProviderAniList + ":" + strconv.Itoa(mediaID)
}

func collectionFromAniList(source *anilist.Collection, mediaType MediaType, fetchedAt time.Time) Collection {
	collection := Collection{
		MediaType: mediaType,
		Entries:   []Entry{},
		Lists:     []List{},
		FetchedAt: fetchedAt,
	}

	positions := make(map[int]int)
	named := make(map[string]bool)

	for _, list := range source.Lists {
		collection.Lists = append(collection.Lists, List{
			Name:   list.Name,
			Custom: list.IsCustomList,
			Status: list.Status,
			Count:  len(list.Entries),
		})

		if list.IsCustomList {
			named[list.Name] = true
		}

		for i := range list.Entries {
			item := &list.Entries[i]

			position, seen := positions[item.MediaID]
			if !seen {
				position = len(collection.Entries)
				positions[item.MediaID] = position
				collection.Entries = append(collection.Entries, entryFromAniList(item, mediaType))
			}

			if list.IsCustomList {
				entry := &collection.Entries[position]
				entry.CustomLists = append(entry.CustomLists, list.Name)
			}
		}
	}

	for _, name := range source.CustomListNames(aniListType(mediaType)) {
		if named[name] {
			continue
		}

		named[name] = true
		collection.Lists = append(collection.Lists, List{Name: name, Custom: true})
	}

	return collection
}

func entryFromAniList(item *anilist.ListEntry, mediaType MediaType) Entry {
	cover := item.Media.CoverImage.ExtraLarge
	if cover == nil {
		cover = item.Media.CoverImage.Large
	}
	if cover == nil {
		cover = item.Media.CoverImage.Medium
	}

	return Entry{
		MediaRef:        aniListMediaRef(item.MediaID),
		Provider:        ProviderAniList,
		MediaType:       mediaType,
		Status:          item.Status,
		Score:           int(math.Round(item.Score)),
		Progress:        derefInt(item.Progress),
		ProgressVolumes: item.ProgressVolumes,
		Repeat:          derefInt(item.Repeat),
		Private:         item.Private,
		Notes:           derefString(item.Notes),
		StartedAt:       dateFromAniList(item.StartedAt),
		CompletedAt:     dateFromAniList(item.CompletedAt),
		UpdatedAt:       time.Unix(item.UpdatedAt, 0).UTC(),
		CustomLists:     []string{},
		Media: Media{
			Title: Title{
				UserPreferred: item.Media.Title.UserPreferred,
				Romaji:        item.Media.Title.Romaji,
				English:       item.Media.Title.English,
				Native:        item.Media.Title.Native,
			},
			Format:       item.Media.Format,
			Status:       item.Media.Status,
			Episodes:     item.Media.Episodes,
			Chapters:     item.Media.Chapters,
			Volumes:      item.Media.Volumes,
			SeasonYear:   item.Media.SeasonYear,
			IsAdult:      item.Media.IsAdult,
			CoverImage:   cover,
			CoverColor:   item.Media.CoverImage.Color,
			BannerImage:  item.Media.BannerImage,
			SiteURL:      item.Media.SiteURL,
			Genres:       nonNilStrings(item.Media.Genres),
			Synonyms:     item.Media.Synonyms,
			AverageScore: item.Media.AverageScore,
		},
	}
}

func dateFromAniList(date anilist.FuzzyDate) Date {
	return Date{Year: date.Year, Month: date.Month, Day: date.Day}
}

func derefInt(value *int) int {
	if value == nil {
		return 0
	}
	return *value
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func nonNilStrings(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}
