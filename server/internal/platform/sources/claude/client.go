// Package claude asks Claude, with the user's own API key, for structured
// answers the node cannot get from a catalog: the details of a title the user
// describes by hand.
package claude

import (
	"context"
	"errors"
	"net/http"
	"slices"
	"time"

	"github.com/anthropics/anthropic-sdk-go/v2"
	"github.com/anthropics/anthropic-sdk-go/v2/option"
	"github.com/anthropics/anthropic-sdk-go/v2/shared/constant"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/ai"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/secrets"
)

// Models the user may pick from, most capable first. The first is the default.
var Models = []string{"claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"}

const (
	keyEntry   = "claude.api_key"
	modelEntry = "claude.model"

	maxRetries = 2
)

// ErrNoKey is a request made before the user saved a key. There is no key the
// build ships with: every request costs money, and only the user's own account
// may be charged for it.
var ErrNoKey = errors.New("no claude api key")

// Models that can hand a declined request on to another model inside the same
// call. Haiku cannot.
var withFallback = []string{"claude-opus-5-5", "claude-sonnet-5-5"}

type Options struct {
	Endpoint string
	Timeout  time.Duration

	// Store keeps the key and the chosen model in a file only the user can read.
	Store *secrets.Store
}

type Client struct {
	endpoint string
	timeout  time.Duration
	store    *secrets.Store
	keys     *secrets.APIKey
}

func New(opts Options) *Client {
	return &Client{
		endpoint: opts.Endpoint,
		timeout:  opts.Timeout,
		store:    opts.Store,
		keys:     secrets.NewAPIKey(opts.Store, keyEntry, ""),
	}
}

func (c *Client) Keys() *secrets.APIKey {
	return c.keys
}

// Model is the one the user picked, or the default when they picked none or one
// this build no longer offers.
func (c *Client) Model() (string, error) {
	model, err := c.store.Get(modelEntry)
	if err != nil {
		return "", apperr.Wrap(err, apperr.KindInternal, "read claude model")
	}

	if !slices.Contains(Models, model) {
		return Models[0], nil
	}

	return model, nil
}

func (c *Client) SetModel(model string) error {
	if !slices.Contains(Models, model) {
		return apperr.Invalid("model", "unknown model %q", model)
	}

	if err := c.store.Set(modelEntry, model); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "store claude model")
	}

	return nil
}

// api builds a client from the node's own settings only: whatever ANTHROPIC_*
// variables or CLI profile the user's machine has belong to their other tools,
// and must not decide which account a request is charged to or where it goes.
func (c *Client) api(key string) anthropic.Client {
	return anthropic.NewClient(
		option.WithoutEnvironmentDefaults(),
		option.WithAPIKey(key),
		option.WithBaseURL(c.endpoint),
		option.WithRequestTimeout(c.timeout),
		option.WithMaxRetries(maxRetries),
	)
}

// Check asks Anthropic whether it accepts the key. Looking up a model costs
// nothing, unlike a message.
func (c *Client) Check(ctx context.Context, key string) error {
	client := c.api(key)

	if _, err := client.Models.Get(ctx, Models[0], anthropic.ModelGetParams{}); err != nil {
		return failure(ctx, err)
	}

	return nil
}

type (
	Request = ai.Request
	Answer  = ai.Answer
)

// Structured asks for one answer that follows the request's schema.
func (c *Client) Structured(ctx context.Context, request Request) (*Answer, error) {
	key, err := c.keys.Key()
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read claude api key")
	}

	if key == "" {
		return nil, apperr.Wrap(ErrNoKey, apperr.KindPrecondition, "Claude is not set up: add an API key in the settings")
	}

	model, err := c.Model()
	if err != nil {
		return nil, err
	}

	params := anthropic.BetaMessageNewParams{
		Model:     model,
		MaxTokens: 16000,
		System:    []anthropic.BetaTextBlockParam{{Text: request.System}},
		Messages: []anthropic.BetaMessageParam{
			anthropic.NewBetaUserMessage(anthropic.NewBetaTextBlock(request.Prompt)),
		},
		OutputConfig: anthropic.BetaOutputConfigParam{
			Effort: anthropic.BetaOutputConfigEffortMedium,
			Format: anthropic.BetaJSONOutputFormatParam{Schema: request.Schema},
		},
	}

	// A declined request is answered by another model in the same call rather
	// than leaving the form empty.
	if slices.Contains(withFallback, model) {
		params.Fallbacks = anthropic.BetaFallbacksParamUnion{OfDefault: constant.ValueOf[constant.Default]()}
		params.Betas = []anthropic.AnthropicBeta{anthropic.AnthropicBetaServerSideFallback2026_07_01}
	}

	client := c.api(key)

	message, err := client.Beta.Messages.New(ctx, params)
	if err != nil {
		return nil, failure(ctx, err)
	}

	switch message.StopReason {
	case anthropic.BetaStopReasonRefusal:
		return nil, apperr.New(apperr.KindUpstream, "Claude declined to describe this title")
	case anthropic.BetaStopReasonMaxTokens:
		return nil, apperr.New(apperr.KindUpstream, "Claude's answer was cut off")
	}

	for i := range message.Content {
		if text, ok := message.Content[i].AsAny().(anthropic.BetaTextBlock); ok && text.Text != "" {
			return &Answer{JSON: []byte(text.Text), Model: message.Model}, nil
		}
	}

	return nil, apperr.New(apperr.KindUpstream, "Claude answered without any text")
}

// failure maps what went wrong to what the user can do about it. A rejected key
// is 428, not 401: the desktop reads 401 as the end of its own session with the
// node.
func failure(ctx context.Context, err error) error {
	var apiErr *anthropic.Error
	if errors.As(err, &apiErr) {
		switch status := apiErr.StatusCode; {
		case status == http.StatusUnauthorized || status == http.StatusForbidden:
			return apperr.Wrap(err, apperr.KindPrecondition, "Claude did not accept the API key")
		case status == http.StatusPaymentRequired:
			return apperr.Wrap(err, apperr.KindPrecondition, "the Anthropic account has a billing problem")
		case status == http.StatusNotFound:
			return apperr.Wrap(err, apperr.KindUpstream, "this API key cannot use the chosen model")
		case status == http.StatusTooManyRequests || status >= http.StatusInternalServerError:
			return apperr.Wrap(err, apperr.KindUnavailable, "Claude is busy, try again in a moment")
		default:
			return apperr.Wrap(err, apperr.KindUpstream, "Claude refused the request")
		}
	}

	if ctx.Err() != nil {
		return apperr.Wrap(err, apperr.KindUnavailable, "the request to Claude was cancelled")
	}

	return apperr.Wrap(err, apperr.KindUnavailable, "Claude is unreachable")
}
