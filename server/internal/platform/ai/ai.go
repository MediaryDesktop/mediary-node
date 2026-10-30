// Package ai is what the node asks of any model it can reach: instructions, a
// request and a JSON schema in, one JSON document out. Each provider package
// speaks its own API behind this shape, so the code that decides what to ask
// never learns who answers.
package ai

import "context"

type Request struct {
	System string
	Prompt string

	// Schema is the JSON schema the answer must follow: every object closed with
	// additionalProperties false and every property required.
	Schema map[string]any
}

type Answer struct {
	JSON  []byte
	Model string
}

// Provider answers one structured request. Errors are apperr kinds the user can
// act on: precondition when it is not set up or its key was refused,
// unavailable when it is busy or unreachable, upstream when it answered badly,
// rate_limited when an allowance is spent.
type Provider interface {
	Structured(ctx context.Context, request Request) (*Answer, error)
}
