package app

import (
	"context"

	"github.com/mediaryorg/mediary-node/server/internal/modules/media"
	"github.com/mediaryorg/mediary-node/server/internal/modules/tracker"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// forgetManual takes a deleted manual title off the user's list. The media module
// is built before the tracker, so the tracker is set once it exists.
type forgetManual struct {
	tracker *tracker.Module
}

func (f *forgetManual) Forget(ctx context.Context, mediaRef string) error {
	if f.tracker == nil {
		return nil
	}

	err := f.tracker.DeleteEntry(ctx, mediaRef)
	if err != nil && apperr.KindOf(err) != apperr.KindNotFound {
		return err
	}

	return nil
}

// localTitles names the titles on the node's own lists — movies and shows — from
// what the media module caches. The tracker stores only the user's data.
type localTitles struct {
	media *media.Module
}

func (l localTitles) Describe(ctx context.Context, mediaRefs []string) map[string]tracker.LocalTitle {
	described := make(map[string]tracker.LocalTitle, len(mediaRefs))

	for _, ref := range mediaRefs {
		details, err := l.media.Cached(ctx, ref)
		if err != nil || details == nil {
			continue
		}

		described[ref] = localTitle(details)
	}

	return described
}

func (l localTitles) Lookup(ctx context.Context, mediaRef string) (*tracker.LocalTitle, error) {
	details, err := l.media.Details(ctx, mediaRef)
	if err != nil {
		return nil, err
	}

	title := localTitle(details)

	return &title, nil
}

func localTitle(details *media.MediaDetails) tracker.LocalTitle {
	return tracker.LocalTitle{
		MediaType: tracker.MediaType(details.MediaType),
		Media: tracker.Media{
			Title: tracker.Title{
				UserPreferred: details.Title.UserPreferred,
				Romaji:        details.Title.Romaji,
				English:       details.Title.English,
				Native:        details.Title.Native,
			},
			Format:       details.Format,
			Status:       details.Status,
			Episodes:     details.Episodes,
			Pages:        details.Pages,
			Authors:      details.Authors,
			Chapters:     details.Chapters,
			Volumes:      details.Volumes,
			SeasonYear:   details.SeasonYear,
			IsAdult:      details.IsAdult,
			CoverImage:   details.CoverImage,
			CoverColor:   details.CoverColor,
			BannerImage:  details.BannerImage,
			SiteURL:      details.SiteURL,
			Genres:       details.Genres,
			Synonyms:     details.Synonyms,
			AverageScore: details.AverageScore,
		},
	}
}
