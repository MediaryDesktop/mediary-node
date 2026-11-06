// Package openai speaks the OpenAI chat completions API that many providers
// copy — OpenAI itself, OpenRouter, DeepSeek, and local servers such as Ollama
// or LM Studio. The user picks the endpoint and the model; a local server may
// need no key at all.
package openai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/ai"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/secrets"
)

const (
	keyEntry      = "openai.api_key"
	endpointEntry = "openai.endpoint"
	modelEntry    = "openai.model"

	maxAnswerBytes = 1 << 20
	maxModelName   = 200
)

type Options struct {
	Timeout time.Duration
	Store   *secrets.Store
}

type Client struct {
	store *secrets.Store
	keys  *secrets.APIKey
	http  *http.Client
}

func New(opts Options) *Client {
	return &Client{
		store: opts.Store,
		keys:  secrets.NewAPIKey(opts.Store, keyEntry, ""),
		http:  &http.Client{Timeout: opts.Timeout},
	}
}

func (c *Client) Keys() *secrets.APIKey {
	return c.keys
}

func (c *Client) Endpoint() (string, error) {
	endpoint, err := c.store.Get(endpointEntry)
	if err != nil {
		return "", apperr.Wrap(err, apperr.KindInternal, "read the AI endpoint")
	}

	return endpoint, nil
}

func (c *Client) Model() (string, error) {
	model, err := c.store.Get(modelEntry)
	if err != nil {
		return "", apperr.Wrap(err, apperr.KindInternal, "read the AI model")
	}

	return model, nil
}

// Configured is whether there is somewhere to send a request. The key is not
// part of it: a local server usually wants none.
func (c *Client) Configured() (bool, error) {
	endpoint, err := c.Endpoint()
	if err != nil {
		return false, err
	}

	model, err := c.Model()
	if err != nil {
		return false, err
	}

	return endpoint != "" && model != "", nil
}

// SetEndpoint stores the base URL requests go to, such as
// https://api.openai.com/v1 or http://localhost:11434/v1. Empty forgets it.
func (c *Client) SetEndpoint(endpoint string) error {
	endpoint = strings.TrimRight(strings.TrimSpace(endpoint), "/")

	if endpoint != "" {
		parsed, err := url.Parse(endpoint)
		if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
			return apperr.Invalid("endpoint", "the endpoint must be an http or https address")
		}
	}

	if err := c.store.Set(endpointEntry, endpoint); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "store the AI endpoint")
	}

	return nil
}

func (c *Client) SetModel(model string) error {
	model = strings.TrimSpace(model)

	if len(model) > maxModelName {
		return apperr.Invalid("model", "a model name is at most %d characters", maxModelName)
	}

	if err := c.store.Set(modelEntry, model); err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "store the AI model")
	}

	return nil
}

// Check asks the endpoint for its models, which costs nothing and fails the
// same way a real request would on a wrong address or a refused key.
func (c *Client) Check(ctx context.Context, endpoint, key string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(endpoint, "/")+"/models", http.NoBody)
	if err != nil {
		return apperr.Invalid("endpoint", "the endpoint is not a valid address")
	}

	authorize(req, key)

	_, err = c.do(ctx, req)

	return err
}

type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type completionRequest struct {
	Model          string    `json:"model"`
	Messages       []message `json:"messages"`
	ResponseFormat struct {
		Type       string `json:"type"`
		JSONSchema struct {
			Name   string         `json:"name"`
			Strict bool           `json:"strict"`
			Schema map[string]any `json:"schema"`
		} `json:"json_schema"`
	} `json:"response_format"`
}

type completionResponse struct {
	Model   string `json:"model"`
	Choices []struct {
		FinishReason string `json:"finish_reason"`
		Message      struct {
			Content *string `json:"content"`
			Refusal *string `json:"refusal"`
		} `json:"message"`
	} `json:"choices"`
}

func (c *Client) Structured(ctx context.Context, request ai.Request) (*ai.Answer, error) {
	endpoint, err := c.Endpoint()
	if err != nil {
		return nil, err
	}

	model, err := c.Model()
	if err != nil {
		return nil, err
	}

	if endpoint == "" || model == "" {
		return nil, apperr.New(apperr.KindPrecondition, "the AI endpoint is not set up: add its address and model in the settings")
	}

	key, err := c.keys.Key()
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read the AI api key")
	}

	payload := completionRequest{Model: model}
	if request.System != "" {
		payload.Messages = append(payload.Messages, message{Role: "system", Content: request.System})
	}
	payload.Messages = append(payload.Messages, message{Role: "user", Content: request.Prompt})
	payload.ResponseFormat.Type = "json_schema"
	payload.ResponseFormat.JSONSchema.Name = "answer"
	payload.ResponseFormat.JSONSchema.Strict = true
	payload.ResponseFormat.JSONSchema.Schema = request.Schema

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "encode the AI request")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "build the AI request")
	}

	req.Header.Set("Content-Type", "application/json")
	authorize(req, key)

	raw, err := c.do(ctx, req)
	if err != nil {
		return nil, err
	}

	var decoded completionResponse
	if err := json.Unmarshal(raw, &decoded); err != nil || len(decoded.Choices) == 0 {
		return nil, apperr.New(apperr.KindUpstream, "the AI answered in a shape the node cannot read")
	}

	choice := decoded.Choices[0]

	if choice.Message.Refusal != nil && *choice.Message.Refusal != "" {
		return nil, apperr.New(apperr.KindUpstream, "the AI declined to describe this title")
	}

	if choice.FinishReason == "length" {
		return nil, apperr.New(apperr.KindUpstream, "the AI's answer was cut off")
	}

	if choice.Message.Content == nil || strings.TrimSpace(*choice.Message.Content) == "" {
		return nil, apperr.New(apperr.KindUpstream, "the AI answered without any text")
	}

	answered := decoded.Model
	if answered == "" {
		answered = model
	}

	return &ai.Answer{JSON: []byte(stripFence(*choice.Message.Content)), Model: answered}, nil
}

// stripFence unwraps an answer a local model put in a Markdown code block
// despite being asked for bare JSON.
func stripFence(text string) string {
	text = strings.TrimSpace(text)

	if !strings.HasPrefix(text, "```") {
		return text
	}

	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")

	return strings.TrimSpace(text)
}

func authorize(req *http.Request, key string) {
	if key != "" {
		req.Header.Set("Authorization", "Bearer "+key)
	}
}

func (c *Client) do(ctx context.Context, req *http.Request) ([]byte, error) {
	resp, err := c.http.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return nil, apperr.Wrap(err, apperr.KindUnavailable, "the request to the AI was cancelled")
		}

		return nil, apperr.Wrap(err, apperr.KindUnavailable, "the AI endpoint is unreachable")
	}
	defer func() { _ = resp.Body.Close() }()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxAnswerBytes))
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindUnavailable, "the AI's answer could not be read")
	}

	if resp.StatusCode == http.StatusOK {
		return raw, nil
	}

	cause := fmt.Errorf("ai endpoint answered %d", resp.StatusCode)

	switch status := resp.StatusCode; {
	case status == http.StatusUnauthorized || status == http.StatusForbidden:
		return nil, apperr.Wrap(cause, apperr.KindPrecondition, "the AI endpoint did not accept the API key")
	case status == http.StatusPaymentRequired:
		return nil, apperr.Wrap(cause, apperr.KindPrecondition, "the AI account has a billing problem")
	case status == http.StatusNotFound:
		return nil, apperr.Wrap(cause, apperr.KindUpstream, "the endpoint does not know this model or address")
	case status == http.StatusTooManyRequests || status >= http.StatusInternalServerError:
		return nil, apperr.Wrap(cause, apperr.KindUnavailable, "the AI is busy, try again in a moment")
	default:
		return nil, apperr.Wrap(cause, apperr.KindUpstream, "the AI refused the request")
	}
}
