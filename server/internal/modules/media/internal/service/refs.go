package service

import (
	"strconv"
	"strings"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/tmdb"
)

const ProviderTMDB = "tmdb"

// titleRef is a parsed media_ref: "anilist:154587", "tmdb:movie:603" or
// "tmdb:tv:1396". TMDB keeps movies and shows in separate id spaces, so its
// references carry the kind.
type titleRef struct {
	provider string
	kind     tmdb.Kind
	id       int
}

func parseRef(mediaRef string) (titleRef, error) {
	malformed := apperr.Invalid("media_ref", "malformed media reference %q", mediaRef)

	provider, rest, found := strings.Cut(mediaRef, ":")
	if !found {
		return titleRef{}, malformed
	}

	switch provider {
	case ProviderAniList:
		id, err := positiveID(rest)
		if err != nil {
			return titleRef{}, malformed
		}

		return titleRef{provider: ProviderAniList, id: id}, nil

	case ProviderTMDB:
		kind, rawID, found := strings.Cut(rest, ":")
		if !found || (tmdb.Kind(kind) != tmdb.KindMovie && tmdb.Kind(kind) != tmdb.KindTV) {
			return titleRef{}, malformed
		}

		id, err := positiveID(rawID)
		if err != nil {
			return titleRef{}, malformed
		}

		return titleRef{provider: ProviderTMDB, kind: tmdb.Kind(kind), id: id}, nil

	default:
		return titleRef{}, apperr.Invalid("media_ref", "no source for media reference %q", mediaRef)
	}
}

func positiveID(raw string) (int, error) {
	id, err := strconv.Atoi(raw)
	if err != nil || id <= 0 {
		return 0, apperr.Invalid("media_ref", "not a positive id")
	}

	return id, nil
}

func tmdbMediaRef(kind tmdb.Kind, id int) string {
	return ProviderTMDB + ":" + string(kind) + ":" + strconv.Itoa(id)
}

// cacheKey is the row a TMDB title is cached under in source_cache.
func (r titleRef) cacheKey() string {
	return string(r.kind) + ":" + strconv.Itoa(r.id)
}
