package service

import (
	"context"
	"encoding/json"
	"net/url"
	"sync"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/tracker/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/anilist"
)

const backgroundRefreshTimeout = 2 * time.Minute

type Options struct {
	AniList         *anilist.Client
	ClientID        string
	AuthorizeURL    string
	RefreshInterval time.Duration
	Now             func() time.Time
}

type Service struct {
	store  *store.Store
	logger zerolog.Logger
	hub    *events.Hub
	opts   Options

	mu         sync.Mutex
	refreshing map[MediaType]bool
}

func New(st *store.Store, logger zerolog.Logger, hub *events.Hub, opts Options) *Service {
	if opts.Now == nil {
		opts.Now = time.Now
	}

	if opts.RefreshInterval <= 0 {
		opts.RefreshInterval = 5 * time.Minute
	}

	return &Service{
		store:      st,
		logger:     logger,
		hub:        hub,
		opts:       opts,
		refreshing: make(map[MediaType]bool),
	}
}

func (s *Service) authorizeURL() string {
	if s.opts.ClientID == "" || s.opts.AuthorizeURL == "" {
		return ""
	}

	query := url.Values{}
	query.Set("client_id", s.opts.ClientID)
	query.Set("response_type", "token")

	return s.opts.AuthorizeURL + "?" + query.Encode()
}

func (s *Service) connected() (bool, error) {
	token, err := s.opts.AniList.Tokens().Token()
	if err != nil {
		return false, apperr.Wrap(err, apperr.KindInternal, "read anilist token")
	}

	return token != "", nil
}

func (s *Service) Session(ctx context.Context) (Session, error) {
	session := Session{AuthorizeURL: s.authorizeURL()}

	connected, err := s.connected()
	if err != nil || !connected {
		return session, err
	}

	session.Connected = true

	account, err := s.account(ctx)
	if err != nil {
		if anilist.IsTokenRejected(err) {
			return Session{AuthorizeURL: session.AuthorizeURL}, nil
		}
		if apperr.KindOf(err) == apperr.KindUnavailable {
			return session, nil
		}
		return session, err
	}

	session.Account = account

	return session, nil
}

func (s *Service) SignIn(ctx context.Context, token string) (*Account, error) {
	viewer, err := s.opts.AniList.ViewerWithToken(ctx, token)
	if anilist.IsTokenRejected(err) {
		return nil, apperr.Invalid("access_token", "anilist rejected this access token")
	}
	if err != nil {
		return nil, err
	}

	account := accountFromViewer(viewer)

	payload, err := json.Marshal(account)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "encode anilist account")
	}

	if err := s.store.ReplaceAccount(ctx, payload, s.opts.Now()); err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "store anilist account")
	}

	if err := s.opts.AniList.Tokens().Save(token); err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "store anilist token")
	}

	s.publishSession(true, "signed_in")

	s.refreshInBackground(ctx, MediaTypeAnime)
	s.refreshInBackground(ctx, MediaTypeManga)

	return &account, nil
}

func (s *Service) SignOut(ctx context.Context) error {
	if err := s.opts.AniList.Tokens().Clear(); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "remove anilist token")
	}

	if err := s.store.ClearMirror(ctx); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "clear anilist mirror")
	}

	s.publishSession(false, "signed_out")

	return nil
}

func (s *Service) Entries(ctx context.Context, mediaType MediaType) (*Collection, error) {
	connected, err := s.connected()
	if err != nil {
		return nil, err
	}
	if !connected {
		return nil, apperr.New(apperr.KindPrecondition, "anilist account is not connected")
	}

	cached, err := s.mirroredCollection(ctx, mediaType)
	if err != nil {
		return nil, err
	}

	if cached == nil {
		return s.refresh(ctx, mediaType)
	}

	if s.opts.Now().Sub(cached.FetchedAt) >= s.opts.RefreshInterval {
		cached.Stale = true
		s.refreshInBackground(ctx, mediaType)
	}

	return cached, nil
}

func (s *Service) RequestRefresh(ctx context.Context, mediaType MediaType) error {
	connected, err := s.connected()
	if err != nil {
		return err
	}
	if !connected {
		return apperr.New(apperr.KindPrecondition, "anilist account is not connected")
	}

	s.refreshInBackground(ctx, mediaType)

	return nil
}

func (s *Service) account(ctx context.Context) (*Account, error) {
	mirror, err := s.store.Mirror(ctx, store.KindViewer)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read anilist account")
	}

	if mirror != nil {
		var account Account
		if decodeErr := json.Unmarshal(mirror.Payload, &account); decodeErr == nil && account.ID != 0 {
			return &account, nil
		}
	}

	viewer, err := s.opts.AniList.Viewer(ctx)
	if err != nil {
		return nil, s.handleRejected(ctx, err)
	}

	account := accountFromViewer(viewer)

	payload, err := json.Marshal(account)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "encode anilist account")
	}

	if err := s.store.PutMirror(ctx, store.KindViewer, payload, s.opts.Now()); err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "store anilist account")
	}

	return &account, nil
}

func (s *Service) mirroredCollection(ctx context.Context, mediaType MediaType) (*Collection, error) {
	mirror, err := s.store.Mirror(ctx, string(mediaType))
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read anilist mirror")
	}

	if mirror == nil {
		return nil, nil
	}

	var collection Collection
	if err := json.Unmarshal(mirror.Payload, &collection); err != nil {
		s.logger.Warn().Err(err).Str("type", string(mediaType)).Msg("discarding unreadable anilist mirror")
		return nil, nil
	}

	collection.FetchedAt = mirror.FetchedAt

	return &collection, nil
}

func (s *Service) refresh(ctx context.Context, mediaType MediaType) (*Collection, error) {
	account, err := s.account(ctx)
	if err != nil {
		return nil, err
	}

	source, err := s.opts.AniList.Collection(ctx, account.ID, aniListType(mediaType))
	if err != nil {
		return nil, s.handleRejected(ctx, err)
	}

	current, err := s.account(ctx)
	if err != nil {
		return nil, err
	}
	if current.ID != account.ID {
		return nil, apperr.New(apperr.KindConflict, "anilist account changed during refresh")
	}

	fetchedAt := s.opts.Now()
	collection := collectionFromAniList(source, mediaType, fetchedAt)

	payload, err := json.Marshal(collection)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "encode anilist collection")
	}

	if err := s.store.PutMirror(ctx, string(mediaType), payload, fetchedAt); err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "store anilist collection")
	}

	s.hub.Publish(events.TopicTracker, map[string]any{
		"media_type": string(mediaType),
		"reason":     "refreshed",
	})

	return &collection, nil
}

func (s *Service) refreshInBackground(ctx context.Context, mediaType MediaType) {
	s.mu.Lock()
	if s.refreshing[mediaType] {
		s.mu.Unlock()
		return
	}
	s.refreshing[mediaType] = true
	s.mu.Unlock()

	detached, cancel := context.WithTimeout(context.WithoutCancel(ctx), backgroundRefreshTimeout)

	go func() {
		defer cancel()
		defer func() {
			s.mu.Lock()
			delete(s.refreshing, mediaType)
			s.mu.Unlock()
		}()

		if _, err := s.refresh(detached, mediaType); err != nil {
			event := s.logger.Warn()
			if apperr.KindOf(err) == apperr.KindUnavailable || apperr.KindOf(err) == apperr.KindPrecondition {
				event = s.logger.Debug()
			}
			event.Err(err).Str("type", string(mediaType)).Msg("anilist collection refresh failed")
		}
	}()
}

func (s *Service) handleRejected(ctx context.Context, err error) error {
	if !anilist.IsTokenRejected(err) {
		return err
	}

	if clearErr := s.opts.AniList.Tokens().Clear(); clearErr != nil {
		s.logger.Error().Err(clearErr).Msg("remove rejected anilist token")
	}

	if clearErr := s.store.ClearMirror(ctx); clearErr != nil {
		s.logger.Error().Err(clearErr).Msg("clear mirror of rejected anilist account")
	}

	s.publishSession(false, "token_rejected")

	return apperr.Wrap(err, apperr.KindPrecondition, "anilist access was revoked, sign in again")
}

func (s *Service) publishSession(connected bool, reason string) {
	s.hub.Publish(events.TopicAniListAuth, map[string]any{
		"connected": connected,
		"reason":    reason,
	})
}

func aniListType(mediaType MediaType) anilist.MediaType {
	if mediaType == MediaTypeManga {
		return anilist.MediaTypeManga
	}
	return anilist.MediaTypeAnime
}
