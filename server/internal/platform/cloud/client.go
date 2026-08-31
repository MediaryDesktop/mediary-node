package cloud

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	contracts "github.com/mediaryorg/mediary-contracts/go/cloudclient"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

const DeviceTokenHeader = "X-Mediary-Device-Token"

var ErrNotLinked = errors.New("node is not paired with a cloud account")

type Options struct {
	BaseURL     string
	DeviceToken string
	Timeout     time.Duration
	UserAgent   string
}

type Client struct {
	api    *contracts.ClientWithResponses
	linked bool
}

func New(opts Options) (*Client, error) {
	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = 20 * time.Second
	}

	userAgent := opts.UserAgent
	if userAgent == "" {
		userAgent = "mediary-node"
	}

	httpClient := &http.Client{Timeout: timeout}

	api, err := contracts.NewClientWithResponses(
		opts.BaseURL,
		contracts.WithHTTPClient(httpClient),
		contracts.WithRequestEditorFn(func(_ context.Context, req *http.Request) error {
			req.Header.Set("User-Agent", userAgent)
			if opts.DeviceToken != "" {
				req.Header.Set(DeviceTokenHeader, opts.DeviceToken)
			}
			return nil
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("build cloud client: %w", err)
	}

	return &Client{api: api, linked: opts.DeviceToken != ""}, nil
}

func (c *Client) Linked() bool {
	return c.linked
}

func (c *Client) API() *contracts.ClientWithResponses {
	return c.api
}

func (c *Client) Reachable(ctx context.Context) error {
	resp, err := c.api.GetHealthWithResponse(ctx)
	if err != nil {
		return apperr.Wrap(err, apperr.KindUpstream, "cloud is unreachable")
	}

	if resp.StatusCode() != http.StatusOK {
		return apperr.New(apperr.KindUpstream, "cloud health returned %d", resp.StatusCode())
	}

	return nil
}
