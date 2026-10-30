package cloud

import (
	"context"
	"net/http"
	"time"

	contracts "github.com/mediaryorg/mediary-contracts/go/cloudclient"

	"github.com/mediaryorg/mediary-node/server/internal/platform/ai"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// AIQuota is the account's daily allowance of AI requests on the cloud's key.
type AIQuota struct {
	Enabled   bool
	Limit     int
	Used      int
	Remaining int
	ResetsAt  time.Time
}

// Structured answers on the cloud's own key, spending one of the account's
// requests for the day. It needs the node paired: the account pays the quota.
func (c *Client) Structured(ctx context.Context, request ai.Request) (*ai.Answer, error) {
	if !c.Linked() {
		return nil, apperr.Wrap(ErrNotLinked, apperr.KindPrecondition,
			"sign in to Mediary Cloud to use the free AI, or add your own AI in the settings")
	}

	resp, err := c.aiAPI.StructuredCompletionWithResponse(ctx, contracts.StructuredCompletionJSONRequestBody{
		System:     &request.System,
		Prompt:     request.Prompt,
		JsonSchema: request.Schema,
	})
	if err != nil {
		if ctx.Err() != nil {
			return nil, apperr.Wrap(err, apperr.KindUnavailable, "the request to Mediary Cloud was cancelled")
		}

		return nil, apperr.Wrap(err, apperr.KindUnavailable, "Mediary Cloud is unreachable")
	}

	if resp.JSON200 != nil {
		return &ai.Answer{JSON: []byte(resp.JSON200.Json), Model: resp.JSON200.Model}, nil
	}

	return nil, aiFailure(resp.StatusCode(), problem(resp.ApplicationproblemJSON429, resp.ApplicationproblemJSON502))
}

func (c *Client) AIQuota(ctx context.Context) (*AIQuota, error) {
	if !c.Linked() {
		return nil, apperr.Wrap(ErrNotLinked, apperr.KindPrecondition, "the node is not paired with Mediary Cloud")
	}

	resp, err := c.api.GetAIQuotaWithResponse(ctx)
	if err != nil {
		return nil, apperr.Wrap(err, apperr.KindUnavailable, "Mediary Cloud is unreachable")
	}

	if resp.JSON200 == nil {
		return nil, aiFailure(resp.StatusCode(), "")
	}

	quota := resp.JSON200

	return &AIQuota{
		Enabled:   quota.Enabled,
		Limit:     int(quota.Limit),
		Used:      int(quota.Used),
		Remaining: int(quota.Remaining),
		ResetsAt:  quota.ResetsAt,
	}, nil
}

func problem(models ...*contracts.ErrorModel) string {
	for _, model := range models {
		if model != nil && model.Detail != nil {
			return *model.Detail
		}
	}

	return ""
}

// aiFailure keeps the cloud's own words where they help the user — the time
// the allowance renews — and says what to do otherwise.
func aiFailure(status int, detail string) error {
	switch status {
	case http.StatusTooManyRequests:
		if detail == "" {
			detail = "today's free AI requests are used up"
		}

		return apperr.New(apperr.KindRateLimited, "%s", detail)
	case http.StatusUnauthorized:
		return apperr.New(apperr.KindPrecondition, "Mediary Cloud no longer accepts this node: pair it again")
	case http.StatusForbidden:
		return apperr.New(apperr.KindPrecondition, "confirm your Mediary Cloud email address to use the free AI")
	case http.StatusBadGateway:
		if detail == "" {
			detail = "the AI could not answer, try again"
		}

		return apperr.New(apperr.KindUpstream, "%s", detail)
	default:
		return apperr.New(apperr.KindUnavailable, "Mediary Cloud answered %d", status)
	}
}
