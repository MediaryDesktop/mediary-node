package httpapi

import (
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

var statusByKind = map[apperr.Kind]int{
	apperr.KindInvalid:      http.StatusUnprocessableEntity,
	apperr.KindUnauthorized: http.StatusUnauthorized,
	apperr.KindNotFound:     http.StatusNotFound,
	apperr.KindConflict:     http.StatusConflict,
	apperr.KindUnavailable:  http.StatusServiceUnavailable,
	apperr.KindUpstream:     http.StatusBadGateway,
	apperr.KindInternal:     http.StatusInternalServerError,
}

func ToHTTP(err error) error {
	if err == nil {
		return nil
	}

	var statusErr huma.StatusError
	if errors.As(err, &statusErr) {
		return err
	}

	var appErr *apperr.Error
	if !errors.As(err, &appErr) {
		return huma.Error500InternalServerError(err.Error())
	}

	status, ok := statusByKind[appErr.Kind]
	if !ok {
		status = http.StatusInternalServerError
	}

	if appErr.Field != "" {
		return huma.NewError(status, appErr.Message, &huma.ErrorDetail{
			Message:  appErr.Message,
			Location: appErr.Field,
		})
	}

	return huma.NewError(status, appErr.Message)
}
