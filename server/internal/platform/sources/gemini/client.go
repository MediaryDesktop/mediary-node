// Package gemini asks Google's Gemini, with the user's own API key, for
// structured answers. The node's free default reaches Gemini through the
// cloud instead; this is for a person who would rather bring their own key.
package gemini

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/mediaryorg/mediary-node/server/internal/platform/ai"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/secrets"
)

// Models the user may pick from. The first is the default.
var Models = []string{"gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.1-pro-preview"}

const (
	keyEntry   = "gemini.api_key"
	modelEntry = "gemini.model"

	maxAnswerBytes  = 1 << 20
	maxOutputTokens = 8192
)

var ErrNoKey = errors.New("no gemini api key")

type Options struct {
	Endpoint string
	Timeout  time.Duration
	Store    *secrets.Store
}

type Client struct {
	endpoint string
	store    *secrets.Store
	keys     *secrets.APIKey
	http     *http.Client
}

func New(opts Options) *Client {
	return &Client{
		endpoint: strings.TrimRight(opts.Endpoint, "/"),
		store:    opts.Store,
		keys:     secrets.NewAPIKey(opts.Store, keyEntry, ""),
		http:     &http.Client{Timeout: opts.Timeout},
	}
}

func (c *Client) Keys() *secrets.APIKey {
	return c.keys
}

func (c *Client) Model() (string, error) {
	model, err := c.store.Get(modelEntry)
	if err != nil {
		return "", apperr.Wrap(err, apperr.KindInternal, "read gemini model")
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
		return apperr.Wrap(err, apperr.KindInternal, "store gemini model")
	}

	return nil
}

// Check asks Google whether it accepts the key. Reading a model's description
// costs nothing, unlike generating.
func (c *Client) Check(ctx context.Context, key string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.modelURL(Models[0]), http.NoBody)
	if err != nil {
		return apperr.Wrap(err, apperr.KindInternal, "build gemini request")
	}

	req.Header.Set("x-goog-api-key", key)

	_, err = c.do(ctx, req)

	return err
}

type part struct {
	Text string `json:"text"`
}

type content struct {
	Role  string `json:"role,omitempty"`
	Parts []part `json:"parts"`
}

type generateRequest struct {
	SystemInstruction *content  `json:"systemInstruction,omitempty"`
	Contents          []content `json:"contents"`
	GenerationConfig  struct {
		ResponseMimeType   string         `json:"responseMimeType"`
		ResponseJSONSchema map[string]any `json:"responseJsonSchema"`
		MaxOutputTokens    int            `json:"maxOutputTokens"`
	} `json:"generationConfig"`
}

type generateResponse struct {
	Candidates []struct {
		Content      content `json:"content"`
		FinishReason string  `json:"finishReason"`
	} `json:"candidates"`
	PromptFeedback struct {
		BlockReason string `json:"blockReason"`
	} `json:"promptFeedback"`
	ModelVersion string `json:"modelVersion"`
}

func (c *Client) Structured(ctx context.Context, request ai.Request) (*ai.Answer, error) {
	key, err := c.keys.Key()
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "read gemini api key")
	}

	if key == "" {
		return nil, apperr.Wrap(ErrNoKey, apperr.KindPrecondition, "Gemini is not set up: add an API key in the settings")
	}

	model, err := c.Model()
	if err != nil {
		return nil, err
	}

	payload := generateRequest{Contents: []content{{Role: "user", Parts: []part{{Text: request.Prompt}}}}}
	if request.System != "" {
		payload.SystemInstruction = &content{Parts: []part{{Text: request.System}}}
	}
	payload.GenerationConfig.ResponseMimeType = "application/json"
	payload.GenerationConfig.ResponseJSONSchema = request.Schema
	payload.GenerationConfig.MaxOutputTokens = maxOutputTokens

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "encode gemini request")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.modelURL(model)+":generateContent", bytes.NewReader(body))
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindInternal, "build gemini request")
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", key)

	raw, err := c.do(ctx, req)
	if err != nil {
		return nil, err
	}

	var decoded generateResponse
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return nil, apperr.Wrap(err, apperr.KindUpstream, "Gemini answered in a shape the node cannot read")
	}

	if decoded.PromptFeedback.BlockReason != "" || len(decoded.Candidates) == 0 {
		return nil, apperr.New(apperr.KindUpstream, "Gemini declined to describe this title")
	}

	candidate := decoded.Candidates[0]

	switch candidate.FinishReason {
	case "STOP", "":
	case "MAX_TOKENS":
		return nil, apperr.New(apperr.KindUpstream, "Gemini's answer was cut off")
	default:
		return nil, apperr.New(apperr.KindUpstream, "Gemini declined to describe this title")
	}

	var text strings.Builder
	for _, p := range candidate.Content.Parts {
		text.WriteString(p.Text)
	}

	answer := strings.TrimSpace(text.String())
	if answer == "" {
		return nil, apperr.New(apperr.KindUpstream, "Gemini answered without any text")
	}

	if decoded.ModelVersion != "" {
		model = decoded.ModelVersion
	}

	return &ai.Answer{JSON: []byte(answer), Model: model}, nil
}

func (c *Client) modelURL(model string) string {
	return c.endpoint + "/v1beta/models/" + url.PathEscape(model)
}

type apiError struct {
	Error struct {
		Message string `json:"message"`
		Status  string `json:"status"`
		Details []struct {
			Reason string `json:"reason"`
		} `json:"details"`
	} `json:"error"`
}

func (c *Client) do(ctx context.Context, req *http.Request) ([]byte, error) {
	resp, err := c.http.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return nil, apperr.Wrap(err, apperr.KindUnavailable, "the request to Gemini was cancelled")
		}

		return nil, apperr.Wrap(err, apperr.KindUnavailable, "Gemini is unreachable")
	}
	defer func() { _ = resp.Body.Close() }()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxAnswerBytes))
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindUnavailable, "Gemini's answer could not be read")
	}

	if resp.StatusCode == http.StatusOK {
		return raw, nil
	}

	return nil, failure(resp.StatusCode, raw)
}

// failure maps what went wrong to what the user can do about it. A rejected
// key is 428, not 401: the desktop reads 401 as the end of its own session
// with the node. Google reports a malformed key as 400 with a reason.
func failure(status int, raw []byte) error {
	var decoded apiError
	_ = json.Unmarshal(raw, &decoded)

	badKey := slices.ContainsFunc(decoded.Error.Details, func(d struct {
		Reason string `json:"reason"`
	},
	) bool {
		return d.Reason == "API_KEY_INVALID"
	})

	cause := fmt.Errorf("gemini answered %d: %s", status, decoded.Error.Message)

	switch {
	case badKey || status == http.StatusUnauthorized || status == http.StatusForbidden:
		return apperr.Wrap(cause, apperr.KindPrecondition, "Gemini did not accept the API key")
	case status == http.StatusNotFound:
		return apperr.Wrap(cause, apperr.KindUpstream, "this API key cannot use the chosen model")
	case status == http.StatusTooManyRequests:
		return apperr.Wrap(cause, apperr.KindUnavailable, "Gemini is busy or the key's quota is used up, try again later")
	case status >= http.StatusInternalServerError:
		return apperr.Wrap(cause, apperr.KindUnavailable, "Gemini is busy, try again in a moment")
	default:
		return apperr.Wrap(cause, apperr.KindUpstream, "Gemini refused the request")
	}
}
