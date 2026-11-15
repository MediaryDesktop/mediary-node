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

	KindPrecondition Kind = "precondition"

	KindUnavailable Kind = "unavailable"

	// An allowance someone else sets — the cloud's daily AI requests — is spent.
	KindRateLimited Kind = "rate_limited"

	KindUpstream Kind = "upstream"

	KindInternal Kind = "internal"
)

// A Code names, for a client, one of the few failures it acts on: it is sent as
// the problem's type, and a message may be reworded without it changing. Most
// errors have none, and a client shows their message as it is.
type Code string

const (
	// Something a metadata source needs is off or has no key: the client says
	// what to set up, in the message.
	CodeSetupRequired Code = "setup-required"

	// No usable library folder for books: the client offers to choose one.
	CodeBooksFolderMissing Code = "books-folder-missing"

	// A program the node runs, such as FFmpeg, is not installed: the client
	// offers the page that installs it.
	CodeToolMissing Code = "tool-missing"
)

type Error struct {
	Kind    Kind
	Message string

	Code  Code
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

// WithCode names the failure for a client; see Code.
func (e *Error) WithCode(code Code) *Error {
	e.Code = code

	return e
}

func Invalid(field, format string, args ...any) *Error {
	return &Error{Kind: KindInvalid, Field: field, Message: fmt.Sprintf(format, args...)}
}

func CodeOf(err error) Code {
	var appErr *Error
	if errors.As(err, &appErr) {
		return appErr.Code
	}

	return ""
}

func KindOf(err error) Kind {
	var appErr *Error
	if errors.As(err, &appErr) {
		return appErr.Kind
	}
	return KindInternal
}
