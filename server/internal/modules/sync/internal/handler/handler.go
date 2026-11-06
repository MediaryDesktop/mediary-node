package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	contracts "github.com/MediaryDesktop/mediary-contracts/go/cloudclient"

	"github.com/MediaryDesktop/mediary-node/server/internal/httpapi"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/sync/internal/service"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

type Handler struct {
	svc *service.Service
}

func New(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

type SyncStatusOutput struct {
	Body struct {
		Ready         bool       `json:"ready" doc:"True when the module's dependencies are wired."`
		Linked        bool       `json:"linked" doc:"True when this node is paired with a Mediary account and may back up."`
		DeviceID      string     `json:"device_id,omitempty" doc:"This node's id in the account's device list, when it was paired from the app."`
		LastBackupAt  *time.Time `json:"last_backup_at,omitempty" doc:"When the cloud last confirmed this node's state, whether or not it had changed."`
		LastAttemptAt *time.Time `json:"last_attempt_at,omitempty" doc:"When this node last tried to back up."`
		LastError     string     `json:"last_error,omitempty" doc:"Why the last attempt failed; empty when it succeeded."`
	}
}

type SyncPairInput struct {
	Body struct {
		Code string `json:"code" minLength:"8" maxLength:"16" doc:"The pairing code the desktop got from the cloud."`
	}
}

type SyncPairOutput struct {
	Body struct {
		DeviceID string `json:"device_id" doc:"This node's identifier in the account."`
		Label    string `json:"label" doc:"How this node appears in the account's device list."`
	}
}

type SyncBackupBody struct {
	ID            string    `json:"id" doc:"Snapshot identifier."`
	DeviceID      string    `json:"device_id" doc:"The device that uploaded it."`
	DeviceLabel   string    `json:"device_label" doc:"That device's name."`
	CreatedAt     time.Time `json:"created_at" doc:"When it was uploaded."`
	SizeBytes     int64     `json:"size_bytes" doc:"Compressed size."`
	FormatVersion int       `json:"format_version" doc:"Snapshot format version."`
}

type SyncBackupNowOutput struct {
	Body struct {
		Backup  SyncBackupBody `json:"backup" doc:"The snapshot the cloud now holds for this node."`
		Created bool           `json:"created" doc:"False when the state had not changed since the last backup and nothing new was stored."`
	}
}

type SyncBackupListOutput struct {
	Body struct {
		Backups []SyncBackupBody `json:"backups" doc:"The account's snapshots from every device, newest first."`
	}
}

type SyncRestoreInput struct {
	ID string `path:"id" format:"uuid" doc:"Snapshot to restore."`
}

func (h *Handler) Register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "getSyncStatus",
		Method:      http.MethodGet,
		Path:        "/v1/sync/status",
		Summary:     "Backup status",
		Description: "Whether this node is paired with a Mediary account, and how its last backup went.",
		Tags:        []string{"sync"},
	}, h.status)

	huma.Register(api, huma.Operation{
		OperationID:   "pairNode",
		Method:        http.MethodPost,
		Path:          "/v1/sync/pairing",
		Summary:       "Pair with an account",
		Description:   "Trades a pairing code from the cloud for this node's device token and keeps it in a file only the user can read. Takes effect at once; the first backup follows within minutes.",
		Tags:          []string{"sync"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusBadGateway, http.StatusServiceUnavailable},
	}, h.pair)

	huma.Register(api, huma.Operation{
		OperationID:   "unpairNode",
		Method:        http.MethodDelete,
		Path:          "/v1/sync/pairing",
		Summary:       "Forget the pairing",
		Description:   "Deletes this node's device token. It does not revoke it in the cloud — that is done from the account's device list.",
		Tags:          []string{"sync"},
		DefaultStatus: http.StatusNoContent,
	}, h.unpair)

	huma.Register(api, huma.Operation{
		OperationID: "backUpNow",
		Method:      http.MethodPost,
		Path:        "/v1/sync/backups",
		Summary:     "Back up now",
		Description: "Uploads the current state at once. An unchanged state is not stored twice.",
		Tags:        []string{"sync"},
		Errors: []int{
			http.StatusPreconditionRequired, http.StatusUnauthorized,
			http.StatusBadGateway, http.StatusServiceUnavailable,
		},
	}, h.backUpNow)

	huma.Register(api, huma.Operation{
		OperationID: "listSyncBackups",
		Method:      http.MethodGet,
		Path:        "/v1/sync/backups",
		Summary:     "Backups in the account",
		Description: "The account's snapshots, read from the cloud with this node's token.",
		Tags:        []string{"sync"},
		Errors:      []int{http.StatusPreconditionRequired, http.StatusUnauthorized, http.StatusBadGateway},
	}, h.list)

	huma.Register(api, huma.Operation{
		OperationID:   "restoreSyncBackup",
		Method:        http.MethodPost,
		Path:          "/v1/sync/backups/{id}/restore",
		Summary:       "Restore a backup",
		Description:   "Replaces the local tracker and lists with the snapshot's, as a whole and without merging. A copy of the current state is kept in the data folder first, so a mistaken restore can be undone by hand.",
		Tags:          []string{"sync"},
		DefaultStatus: http.StatusNoContent,
		Errors: []int{
			http.StatusPreconditionRequired, http.StatusUnauthorized, http.StatusNotFound,
			http.StatusUnprocessableEntity, http.StatusBadGateway,
		},
	}, h.restore)
}

func (h *Handler) status(context.Context, *struct{}) (*SyncStatusOutput, error) {
	state := h.svc.Status()

	out := &SyncStatusOutput{}
	out.Body.Ready = h.svc.Ready()
	out.Body.Linked = state.Linked
	out.Body.DeviceID = state.DeviceID
	out.Body.LastBackupAt = timePtr(state.LastBackupAt)
	out.Body.LastAttemptAt = timePtr(state.LastAttemptAt)
	out.Body.LastError = state.LastError

	return out, nil
}

func (h *Handler) pair(ctx context.Context, in *SyncPairInput) (*SyncPairOutput, error) {
	paired, err := h.svc.Pair(ctx, in.Body.Code)
	if err != nil {
		return nil, httpapi.ToHTTP(err)
	}

	out := &SyncPairOutput{}
	out.Body.DeviceID = paired.DeviceID
	out.Body.Label = paired.Label

	return out, nil
}

func (h *Handler) unpair(context.Context, *struct{}) (*struct{}, error) {
	if err := h.svc.Unpair(); err != nil {
		return nil, httpapi.ToHTTP(err)
	}

	return nil, nil
}

func (h *Handler) backUpNow(ctx context.Context, _ *struct{}) (*SyncBackupNowOutput, error) {
	uploaded, err := h.svc.BackupNow(ctx)
	if err != nil {
		return nil, httpapi.ToHTTP(err)
	}

	out := &SyncBackupNowOutput{}
	out.Body.Backup = toBody(&uploaded.Backup)
	out.Body.Created = uploaded.Created

	return out, nil
}

func (h *Handler) list(ctx context.Context, _ *struct{}) (*SyncBackupListOutput, error) {
	backups, err := h.svc.List(ctx)
	if err != nil {
		return nil, httpapi.ToHTTP(err)
	}

	out := &SyncBackupListOutput{}
	out.Body.Backups = make([]SyncBackupBody, 0, len(backups))

	for i := range backups {
		out.Body.Backups = append(out.Body.Backups, toBody(&backups[i]))
	}

	return out, nil
}

func (h *Handler) restore(ctx context.Context, in *SyncRestoreInput) (*struct{}, error) {
	id, err := uuid.Parse(in.ID)
	if err != nil {
		return nil, httpapi.ToHTTP(apperr.New(apperr.KindNotFound, "backup not found"))
	}

	if err := h.svc.Restore(ctx, id); err != nil {
		return nil, httpapi.ToHTTP(err)
	}

	return nil, nil
}

func toBody(b *contracts.BackupBody) SyncBackupBody {
	return SyncBackupBody{
		ID:            b.Id.String(),
		DeviceID:      b.DeviceId.String(),
		DeviceLabel:   b.DeviceLabel,
		CreatedAt:     b.CreatedAt,
		SizeBytes:     b.SizeBytes,
		FormatVersion: int(b.FormatVersion),
	}
}

func timePtr(t time.Time) *time.Time {
	if t.IsZero() {
		return nil
	}

	return &t
}
