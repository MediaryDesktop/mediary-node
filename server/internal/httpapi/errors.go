package httpapi

import (
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

var statusByKind = map[apperr.Kind]int{
	apperr.KindInvalid:      http.StatusUnprocessableEntity,
	apperr.KindUnauthorized: http.StatusUnauthorized,
	apperr.KindNotFound:     http.StatusNotFound,
	apperr.KindConflict:     http.StatusConflict,
	apperr.KindPrecondition: http.StatusPreconditionRequired,
	apperr.KindUnavailable:  http.StatusServiceUnavailable,
	apperr.KindRateLimited:  http.StatusTooManyRequests,
	apperr.KindUpstream:     http.StatusBadGateway,
	apperr.KindInternal:     http.StatusInternalServerError,
}

// ProblemTypePrefix turns an apperr.Code into the problem's type, a URI as
// RFC 9457 wants; the desktop reads the code back from it.
const ProblemTypePrefix = "urn:mediary:problem:"

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

	var details []error
	if appErr.Field != "" {
		details = append(details, &huma.ErrorDetail{Message: appErr.Message, Location: appErr.Field})
	}

	problem := huma.NewError(status, appErr.Message, details...)

	if model, isModel := problem.(*huma.ErrorModel); isModel && appErr.Code != "" {
		model.Type = ProblemTypePrefix + string(appErr.Code)
	}

	return problem
}
