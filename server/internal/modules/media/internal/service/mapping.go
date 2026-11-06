package service

import (
	"html"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/sources/anilist"
)

const ProviderAniList = "anilist"

var (
	lineBreakTag  = regexp.MustCompile(`(?i)<br\s*/?>`)
	anyTag        = regexp.MustCompile(`<[^>]+>`)
	blankLineRuns = regexp.MustCompile(`\n{3,}`)
	mediaTypes    = map[string]string{"ANIME": "anime", "MANGA": "manga"}
)

func aniListMediaRef(mediaID int) string {
	return ProviderAniList + ":" + strconv.Itoa(mediaID)
}

func plainDescription(raw *string) string {
	if raw == nil {
		return ""
	}

	text := strings.ReplaceAll(*raw, "\r\n", "\n")
	text = lineBreakTag.ReplaceAllString(text, "\n")
	text = anyTag.ReplaceAllString(text, "")
	text = html.UnescapeString(text)
	text = blankLineRuns.ReplaceAllString(text, "\n\n")

	return strings.TrimSpace(text)
}

func titleNames(title anilist.Titles) TitleNames {
	return TitleNames{
		UserPreferred: title.UserPreferred,
		Romaji:        title.Romaji,
		English:       title.English,
		Native:        title.Native,
	}
}

func firstPresent(values ...*string) *string {
	for _, value := range values {
		if value != nil && *value != "" {
			return value
		}
	}

	return nil
}

func nonNilStrings(values []string) []string {
	if values == nil {
		return []string{}
	}

	return values
}

func detailsFromAniList(source *anilist.MediaDetails, fetchedAt time.Time) MediaDetails {
	details := MediaDetails{
		MediaRef:        aniListMediaRef(source.ID),
		MediaType:       mediaTypes[source.Type],
		Format:          source.Format,
		Status:          source.Status,
		Title:           titleNames(source.Title),
		Synonyms:        nonNilStrings(source.Synonyms),
		Description:     plainDescription(source.Description),
		CoverImage:      firstPresent(source.CoverImage.ExtraLarge, source.CoverImage.Large, source.CoverImage.Medium),
		CoverColor:      source.CoverImage.Color,
		BannerImage:     source.BannerImage,
		Episodes:        source.Episodes,
		Chapters:        source.Chapters,
		Volumes:         source.Volumes,
		Duration:        source.Duration,
		Season:          source.Season,
		SeasonYear:      source.SeasonYear,
		StartDate:       FuzzyDate(source.StartDate),
		EndDate:         FuzzyDate(source.EndDate),
		AverageScore:    source.AverageScore,
		MeanScore:       source.MeanScore,
		Popularity:      source.Popularity,
		Favourites:      source.Favourites,
		Genres:          nonNilStrings(source.Genres),
		Studios:         []string{},
		Source:          source.Source,
		CountryOfOrigin: source.CountryOfOrigin,
		IsAdult:         source.IsAdult,
		SiteURL:         source.SiteURL,
		Relations:       []RelatedMedia{},
		Recommendations: []RelatedMedia{},
		Similar:         []RelatedMedia{},
		FetchedAt:       fetchedAt.UTC(),
	}

	for _, node := range source.Recommendations.Nodes {
		recommended := node.MediaRecommendation

		// An adult title is only suggested from another one.
		if recommended == nil || (recommended.IsAdult && !source.IsAdult) {
			continue
		}

		details.Recommendations = append(details.Recommendations, relatedFromAniList("RECOMMENDATION", recommended))
	}

	for _, studio := range source.Studios.Nodes {
		details.Studios = append(details.Studios, studio.Name)
	}

	if source.Trailer != nil && source.Trailer.ID != nil && source.Trailer.Site != nil {
		details.Trailer = &Trailer{
			ID:        *source.Trailer.ID,
			Site:      *source.Trailer.Site,
			Thumbnail: source.Trailer.Thumbnail,
		}
	}

	if source.NextAiringEpisode != nil {
		details.NextAiringEpisode = &AiringEpisode{
			Episode:  source.NextAiringEpisode.Episode,
			AiringAt: time.Unix(source.NextAiringEpisode.AiringAt, 0).UTC(),
		}
	}

	for i := range source.Relations.Edges {
		edge := &source.Relations.Edges[i]
		details.Relations = append(details.Relations, relatedFromAniList(edge.RelationType, &edge.Node))
	}

	return details
}

func relatedFromAniList(relationType string, node *anilist.RelatedNode) RelatedMedia {
	return RelatedMedia{
		RelationType: relationType,
		MediaRef:     aniListMediaRef(node.ID),
		MediaType:    mediaTypes[node.Type],
		Format:       node.Format,
		Status:       node.Status,
		SeasonYear:   node.SeasonYear,
		Title:        titleNames(node.Title),
		CoverImage:   firstPresent(node.CoverImage.Large, node.CoverImage.Medium),
		CoverColor:   node.CoverImage.Color,
	}
}

func summaryFromAniList(source *anilist.MediaSummary) MediaSummary {
	summary := MediaSummary{
		MediaRef:     aniListMediaRef(source.ID),
		MediaType:    mediaTypes[source.Type],
		Format:       source.Format,
		Status:       source.Status,
		Title:        titleNames(source.Title),
		CoverImage:   firstPresent(source.CoverImage.ExtraLarge, source.CoverImage.Large, source.CoverImage.Medium),
		CoverColor:   source.CoverImage.Color,
		BannerImage:  source.BannerImage,
		Episodes:     source.Episodes,
		Chapters:     source.Chapters,
		Volumes:      source.Volumes,
		Season:       source.Season,
		SeasonYear:   source.SeasonYear,
		StartDate:    FuzzyDate(source.StartDate),
		AverageScore: source.AverageScore,
		Popularity:   source.Popularity,
		Genres:       nonNilStrings(source.Genres),
		IsAdult:      source.IsAdult,
		SiteURL:      source.SiteURL,
		Description:  plainDescription(source.Description),
	}

	if source.NextAiringEpisode != nil {
		summary.NextAiringEpisode = &AiringEpisode{
			Episode:  source.NextAiringEpisode.Episode,
			AiringAt: time.Unix(source.NextAiringEpisode.AiringAt, 0).UTC(),
		}
	}

	return summary
}
