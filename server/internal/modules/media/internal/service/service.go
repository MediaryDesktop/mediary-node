package service

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/media/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anilist"
)

const aniListMaxAge = 24 * time.Hour

// Bump when MediaDetails gains a field, so payloads cached by an older build
// are fetched again instead of being served without it for up to a day.
const detailsCacheVersion = 2

type cachedDetails struct {
	Version int          `json:"version"`
	Details MediaDetails `json:"details"`
}

type Options struct {
	AniList *anilist.Client
	Now     func() time.Time
}

type Service struct {
	store  *store.Store
	logger zerolog.Logger
	opts   Options
}

func New(st *store.Store, logger zerolog.Logger, opts Options) *Service {
	if opts.Now == nil {
		opts.Now = time.Now
	}

	return &Service{store: st, logger: logger, opts: opts}
}

func parseMediaRef(mediaRef string) (int, error) {
	provider, id, found := strings.Cut(mediaRef, ":")
	if !found || provider != ProviderAniList {
		return 0, apperr.Invalid("media_ref", "only anilist titles are supported for now")
	}

	mediaID, err := strconv.Atoi(id)
	if err != nil || mediaID <= 0 {
		return 0, apperr.Invalid("media_ref", "malformed media reference %q", mediaRef)
	}

	return mediaID, nil
}

func (s *Service) Details(ctx context.Context, mediaRef string) (*MediaDetails, error) {
	mediaID, err := parseMediaRef(mediaRef)
	if err != nil {
		return nil, err
	}

	externalID := strconv.Itoa(mediaID)
	now := s.opts.Now()

	cached, err := s.store.Get(ctx, ProviderAniList, externalID)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read media cache")
	}

	if cached != nil && now.Sub(cached.FetchedAt) < aniListMaxAge {
		var entry cachedDetails
		if decodeErr := json.Unmarshal(cached.Payload, &entry); decodeErr == nil && entry.Version == detailsCacheVersion {
			return &entry.Details, nil
		}
	}

	source, err := s.opts.AniList.MediaDetails(ctx, mediaID)
	if err != nil {
		return nil, err
	}

	details := detailsFromAniList(source, now)

	payload, err := json.Marshal(cachedDetails{Version: detailsCacheVersion, Details: details})
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "encode media details")
	}

	if putErr := s.store.Put(ctx, ProviderAniList, externalID, payload, now); putErr != nil {
		return nil, apperr.Wrap(putErr, apperr.KindInternal, "store media details")
	}

	if purgeErr := s.store.PurgeOlderThan(ctx, ProviderAniList, now.Add(-aniListMaxAge)); purgeErr != nil {
		s.logger.Warn().Err(purgeErr).Msg("purge expired anilist cache")
	}

	return &details, nil
}
