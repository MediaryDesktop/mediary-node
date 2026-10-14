package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	contracts "github.com/mediaryorg/mediary-contracts/go/cloudclient"

	"github.com/mediaryorg/mediary-node/server/internal/modules/sync/internal/snapshot"
	"github.com/mediaryorg/mediary-node/server/internal/modules/sync/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/cloud"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
	"github.com/mediaryorg/mediary-node/server/internal/platform/secrets"
)

const (
	DeviceTokenSecret = "device_token"

	// Not a secret, but it belongs with the token: both name this pairing, and
	// both go when it ends.
	deviceIDSecret = "device_id"

	// An upload waits this long after the last change, so a burst of edits
	// becomes one snapshot rather than one per click.
	quietPeriod = 15 * time.Minute

	// Even without a change event the state is offered once a day: the cloud
	// answers an unchanged one for free, and an edit the node missed — made
	// while it was offline, say — still gets out.
	dailyFloor = 24 * time.Hour

	safetyCopiesKept = 5
)

type Deps struct {
	Store   *store.Store
	Logger  zerolog.Logger
	Hub     *events.Hub
	Cloud   *cloud.Client
	Secrets *secrets.Store

	// Where the copy of the current state goes before a restore replaces it.
	SafetyDir string

	// How this node names itself when paired; the device list shows it.
	Label string
}

type Service struct {
	store     *store.Store
	logger    zerolog.Logger
	hub       *events.Hub
	cloud     *cloud.Client
	secrets   *secrets.Store
	safetyDir string
	label     string

	mu          sync.Mutex
	state       State
	lastChange  time.Time
	lastAttempt time.Time
	busy        sync.Mutex
}

// State is what the desktop shows about backups on this node.
type State struct {
	Linked         bool
	DeviceID       string
	LastBackupAt   time.Time
	LastBackupHash string
	LastError      string
	LastAttemptAt  time.Time
}

type Uploaded struct {
	Backup  contracts.BackupBody
	Created bool
}

type Paired struct {
	DeviceID string
	Label    string
}

func New(deps Deps) *Service {
	return &Service{
		store:     deps.Store,
		logger:    deps.Logger,
		hub:       deps.Hub,
		cloud:     deps.Cloud,
		secrets:   deps.Secrets,
		safetyDir: deps.SafetyDir,
		label:     deps.Label,
	}
}

// LoadToken puts a token saved by an earlier pairing into the client. A paired
// token wins over NODE_CLOUD_DEVICE_TOKEN: pairing is the later, deliberate act.
func (s *Service) LoadToken() error {
	if s.secrets == nil || s.cloud == nil {
		return nil
	}

	token, err := s.secrets.Get(DeviceTokenSecret)
	if err != nil {
		return fmt.Errorf("read device token: %w", err)
	}

	if token != "" {
		if s.cloud.Linked() && s.cloud.DeviceToken() != token {
			s.logger.Warn().Msg("both a paired device token and NODE_CLOUD_DEVICE_TOKEN are set; using the paired one")
		}

		s.cloud.SetDeviceToken(token)
	}

	return nil
}

func (s *Service) Ready() bool {
	return s.store.Ready()
}

func (s *Service) Status() State {
	s.mu.Lock()
	defer s.mu.Unlock()

	state := s.state
	state.Linked = s.cloud != nil && s.cloud.Linked()

	if state.Linked && s.secrets != nil {
		// A token from NODE_CLOUD_DEVICE_TOKEN has no id here; the list then
		// simply marks no device as this one.
		state.DeviceID, _ = s.secrets.Get(deviceIDSecret)
	}

	return state
}

func (s *Service) Pair(ctx context.Context, code string) (*Paired, error) {
	resp, err := s.cloud.API().ExchangePairingCodeWithResponse(ctx, contracts.ExchangeInputBody{
		Code:  strings.TrimSpace(code),
		Label: s.label,
	})
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindUpstream, "cloud is unreachable")
	}

	if resp.JSON201 == nil {
		return nil, cloudError(resp.StatusCode(), resp.Body, "pair with the cloud")
	}

	token := resp.JSON201.DeviceToken

	if err := s.secrets.Set(DeviceTokenSecret, token); err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "save device token")
	}

	if err := s.secrets.Set(deviceIDSecret, resp.JSON201.Device.Id.String()); err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "save device id")
	}

	s.cloud.SetDeviceToken(token)

	s.mu.Lock()
	s.state = State{}
	// The first snapshot goes out on the next tick rather than after the
	// quiet period: a freshly paired node has nothing in the cloud yet.
	s.lastChange = time.Now().Add(-quietPeriod)
	s.lastAttempt = time.Time{}
	s.mu.Unlock()

	s.publish("paired")

	return &Paired{DeviceID: resp.JSON201.Device.Id.String(), Label: resp.JSON201.Device.Label}, nil
}

// Unpair forgets the token here. Revoking it in the cloud is the account's
// business and goes through the desktop's session, not through this node.
func (s *Service) Unpair() error {
	for _, key := range []string{DeviceTokenSecret, deviceIDSecret} {
		if err := s.secrets.Set(key, ""); err != nil {
			return apperr.Wrap(err, apperr.KindInternal, "forget device token")
		}
	}

	s.cloud.SetDeviceToken("")

	s.mu.Lock()
	s.state = State{}
	s.mu.Unlock()

	s.publish("unpaired")

	return nil
}

func (s *Service) BackupNow(ctx context.Context) (*Uploaded, error) {
	s.busy.Lock()
	defer s.busy.Unlock()

	uploaded, err := s.upload(ctx)

	s.mu.Lock()
	s.lastAttempt = time.Now()
	s.state.LastAttemptAt = s.lastAttempt

	if err != nil {
		s.state.LastError = err.Error()
	} else {
		s.state.LastError = ""
		s.state.LastBackupAt = uploaded.Backup.CreatedAt
		s.state.LastBackupHash = uploaded.Backup.Sha256
	}
	s.mu.Unlock()

	if err != nil {
		s.publish("failed")
		return nil, err
	}

	if uploaded.Created {
		s.publish("uploaded")
	}

	return uploaded, nil
}

func (s *Service) upload(ctx context.Context) (*Uploaded, error) {
	if !s.cloud.Linked() {
		return nil, errNotPaired()
	}

	doc, err := s.store.Read(ctx)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read state for backup")
	}

	encoded, err := snapshot.Encode(doc)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "encode backup")
	}

	resp, err := s.cloud.API().UploadBackupWithBodyWithResponse(ctx, &contracts.UploadBackupParams{
		XBackupSha256:        encoded.Sha256,
		XBackupFormatVersion: snapshot.FormatVersion,
	}, "application/octet-stream", bytes.NewReader(encoded.Body))
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindUpstream, "cloud is unreachable")
	}

	switch {
	case resp.JSON201 != nil:
		return &Uploaded{Backup: *resp.JSON201, Created: true}, nil
	case resp.JSON200 != nil:
		return &Uploaded{Backup: *resp.JSON200, Created: false}, nil
	}

	s.forgetRevokedToken(resp.StatusCode())

	return nil, cloudError(resp.StatusCode(), resp.Body, "upload backup")
}

func (s *Service) List(ctx context.Context) ([]contracts.BackupBody, error) {
	if !s.cloud.Linked() {
		return nil, errNotPaired()
	}

	resp, err := s.cloud.API().ListBackupsWithResponse(ctx)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindUpstream, "cloud is unreachable")
	}

	if resp.JSON200 == nil {
		s.forgetRevokedToken(resp.StatusCode())
		return nil, cloudError(resp.StatusCode(), resp.Body, "list backups")
	}

	if resp.JSON200.Backups == nil {
		return []contracts.BackupBody{}, nil
	}

	return *resp.JSON200.Backups, nil
}

func (s *Service) Restore(ctx context.Context, id uuid.UUID) error {
	if !s.cloud.Linked() {
		return errNotPaired()
	}

	s.busy.Lock()
	defer s.busy.Unlock()

	resp, err := s.cloud.API().DownloadBackupWithResponse(ctx, id)
	if err != nil {
		return apperr.Wrap(err, apperr.KindUpstream, "cloud is unreachable")
	}

	if resp.StatusCode() != http.StatusOK {
		s.forgetRevokedToken(resp.StatusCode())
		return cloudError(resp.StatusCode(), resp.Body, "download backup")
	}

	if want := resp.HTTPResponse.Header.Get("X-Backup-Sha256"); want != "" && snapshot.Hash(resp.Body) != want {
		return apperr.New(apperr.KindUpstream, "downloaded backup does not match its hash")
	}

	doc, err := snapshot.Decode(resp.Body)
	if errors.Is(err, snapshot.ErrNewerFormat) {
		return apperr.New(apperr.KindPrecondition, "this backup was made by a newer version of Mediary; update to restore it")
	}
	if err != nil {
		return apperr.Wrap(err, apperr.KindInvalid, "backup is unreadable")
	}

	if err := s.keepSafetyCopy(ctx); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "save a copy of the current state before restoring")
	}

	if err := s.store.Replace(ctx, doc); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "restore backup")
	}

	s.mu.Lock()
	s.lastChange = time.Now()
	s.mu.Unlock()

	s.hub.Publish(events.TopicTracker, map[string]any{"reason": "restored", "scope": "all"})
	s.publish("restored")

	return nil
}

// Run uploads on its own until ctx ends: after a burst of changes has gone
// quiet, and once a day regardless.
func (s *Service) Run(ctx context.Context, tick time.Duration) {
	changes, unsubscribe := s.hub.Subscribe(events.TopicTracker)
	defer unsubscribe()

	ticker := time.NewTicker(tick)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-changes:
			// A restore announces itself on this topic too. It is a change like
			// any other: the next upload records which state this device holds.
			s.mu.Lock()
			s.lastChange = time.Now()
			s.mu.Unlock()
		case <-ticker.C:
			if !s.due(time.Now()) {
				continue
			}

			if _, err := s.BackupNow(ctx); err != nil && apperr.KindOf(err) != apperr.KindPrecondition {
				s.logger.Warn().Err(err).Msg("automatic backup")
			}
		}
	}
}

func (s *Service) due(now time.Time) bool {
	if s.cloud == nil || !s.cloud.Linked() {
		return false
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	settled := !s.lastChange.IsZero() &&
		s.lastChange.After(s.lastAttempt) &&
		now.Sub(s.lastChange) >= quietPeriod

	return settled || now.Sub(s.lastAttempt) >= dailyFloor
}

func (s *Service) keepSafetyCopy(ctx context.Context) error {
	doc, err := s.store.Read(ctx)
	if err != nil {
		return err
	}

	encoded, err := snapshot.Encode(doc)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(s.safetyDir, 0o700); err != nil {
		return err
	}

	name := "pre-restore-" + time.Now().UTC().Format("20060102-150405") + ".json.gz"

	if err := os.WriteFile(filepath.Join(s.safetyDir, name), encoded.Body, 0o600); err != nil {
		return err
	}

	s.pruneSafetyCopies()

	return nil
}

func (s *Service) pruneSafetyCopies() {
	matches, err := filepath.Glob(filepath.Join(s.safetyDir, "pre-restore-*.json.gz"))
	if err != nil || len(matches) <= safetyCopiesKept {
		return
	}

	// The timestamp in the name sorts the same way as time.
	sort.Strings(matches)

	for _, old := range matches[:len(matches)-safetyCopiesKept] {
		if err := os.Remove(old); err != nil {
			s.logger.Warn().Err(err).Str("path", old).Msg("remove old pre-restore copy")
		}
	}
}

// forgetRevokedToken drops a token the cloud no longer accepts, so the node
// reports itself unpaired instead of failing every hour with the same 401.
func (s *Service) forgetRevokedToken(status int) {
	if status != http.StatusUnauthorized {
		return
	}

	s.logger.Warn().Msg("the cloud refused this node's device token; it was revoked or expired")

	if err := s.Unpair(); err != nil {
		s.logger.Warn().Err(err).Msg("forget revoked device token")
	}
}

func (s *Service) publish(reason string) {
	if s.hub != nil {
		s.hub.Publish(events.TopicSync, map[string]any{"reason": reason})
	}
}

func errNotPaired() error {
	return apperr.New(apperr.KindPrecondition, "this node is not paired with a Mediary account")
}

func cloudError(status int, body []byte, action string) error {
	detail := cloudDetail(body)

	switch status {
	case http.StatusUnauthorized:
		return apperr.New(apperr.KindUnauthorized, "%s: %s", action, detail)
	case http.StatusNotFound:
		return apperr.New(apperr.KindNotFound, "%s: %s", action, detail)
	case http.StatusTooManyRequests:
		return apperr.New(apperr.KindUnavailable, "%s: %s", action, detail)
	case http.StatusUnprocessableEntity, http.StatusRequestEntityTooLarge:
		return apperr.New(apperr.KindInvalid, "%s: %s", action, detail)
	default:
		return apperr.New(apperr.KindUpstream, "%s: cloud answered %d: %s", action, status, detail)
	}
}

// cloudDetail pulls the human-readable reason out of the cloud's problem JSON,
// so the desktop can show "pairing code is invalid" rather than a status code.
func cloudDetail(body []byte) string {
	var problem contracts.ErrorModel
	if err := json.Unmarshal(body, &problem); err == nil && problem.Detail != nil {
		return *problem.Detail
	}

	return "no details"
}
