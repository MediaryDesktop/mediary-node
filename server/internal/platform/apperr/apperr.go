package apperr

import (
	"errors"
	"fmt"
)

type Kind string

const (
	KindInvalid Kind = "invalid"

	KindUnauthorized Kind = "unauthorized"

	KindNotFound Kind = "not_found"

	KindConflict Kind = "conflict"

	KindUnavailable Kind = "unavailable"

	KindUpstream Kind = "upstream"

	KindInternal Kind = "internal"
)

type Error struct {
	Kind    Kind
	Message string

	Field string
	cause error
}

func (e *Error) Error() string {
	if e.cause != nil {
		return fmt.Sprintf("%s: %s: %v", e.Kind, e.Message, e.cause)
	}
	return fmt.Sprintf("%s: %s", e.Kind, e.Message)
}

func (e *Error) Unwrap() error { return e.cause }

func New(kind Kind, format string, args ...any) *Error {
	return &Error{Kind: kind, Message: fmt.Sprintf(format, args...)}
}

func Wrap(err error, kind Kind, format string, args ...any) *Error {
	return &Error{Kind: kind, Message: fmt.Sprintf(format, args...), cause: err}
}

func Invalid(field, format string, args ...any) *Error {
	return &Error{Kind: KindInvalid, Field: field, Message: fmt.Sprintf(format, args...)}
}

func KindOf(err error) Kind {
	var appErr *Error
	if errors.As(err, &appErr) {
		return appErr.Kind
	}
	return KindInternal
}
