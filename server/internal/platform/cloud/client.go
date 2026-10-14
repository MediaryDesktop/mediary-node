package cloud

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"
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
	api *contracts.ClientWithResponses

	mu          sync.RWMutex
	deviceToken string
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

	client := &Client{deviceToken: opts.DeviceToken}

	api, err := contracts.NewClientWithResponses(
		opts.BaseURL,
		contracts.WithHTTPClient(&http.Client{Timeout: timeout}),
		contracts.WithRequestEditorFn(func(_ context.Context, req *http.Request) error {
			req.Header.Set("User-Agent", userAgent)
			if token := client.DeviceToken(); token != "" {
				req.Header.Set(DeviceTokenHeader, token)
			}
			return nil
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("build cloud client: %w", err)
	}

	client.api = api

	return client, nil
}

func (c *Client) Linked() bool {
	return c.DeviceToken() != ""
}

func (c *Client) DeviceToken() string {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return c.deviceToken
}

// SetDeviceToken switches the token every later request carries, so pairing
// and unpairing take effect without restarting the node.
func (c *Client) SetDeviceToken(token string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.deviceToken = token
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
