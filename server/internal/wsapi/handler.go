package wsapi

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

// Variables so a test can run through several pings quickly.
var (
	writeTimeout = 10 * time.Second

	pingInterval = 30 * time.Second
)

type Handler struct {
	hub            *events.Hub
	logger         zerolog.Logger
	allowedOrigins []string
}

func New(hub *events.Hub, logger zerolog.Logger, allowedOrigins []string) *Handler {
	return &Handler{hub: hub, logger: logger, allowedOrigins: allowedOrigins}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: h.allowedOrigins,

		CompressionMode: websocket.CompressionDisabled,
	})
	if err != nil {
		h.logger.Warn().Err(err).Msg("websocket upgrade failed")
		return
	}

	defer func() { _ = conn.CloseNow() }()

	// Clients only listen, but a pong is only seen while something reads the
	// connection; without a reader every ping times out and drops the client.
	ctx := conn.CloseRead(r.Context())

	stream, unsubscribe := h.hub.Subscribe(topicsFromQuery(r)...)
	defer unsubscribe()

	h.logger.Debug().Int("subscribers", h.hub.SubscriberCount()).Msg("websocket client attached")

	ticker := time.NewTicker(pingInterval)
	defer ticker.Stop()

	// seen is how many dropped events the client has been told about. Checked
	// after every write and on every ping, so a gap is reported as soon as the
	// client catches up, even when nothing else follows it.
	var seen uint64

	reportDrops := func() error {
		dropped := h.hub.Dropped(stream)
		if dropped == seen {
			return nil
		}

		seen = dropped

		writeCtx, cancel := context.WithTimeout(ctx, writeTimeout)
		defer cancel()

		return wsjson.Write(writeCtx, conn, events.Event{Topic: events.TopicOverflow, At: time.Now().UTC()})
	}

	for {
		select {
		case <-ctx.Done():
			_ = conn.Close(websocket.StatusNormalClosure, "server shutting down")
			return

		case event, ok := <-stream:
			if !ok {
				_ = conn.Close(websocket.StatusNormalClosure, "subscription closed")
				return
			}

			writeCtx, cancel := context.WithTimeout(ctx, writeTimeout)
			err := wsjson.Write(writeCtx, conn, event)
			cancel()

			if err != nil {
				h.logClose(err, "write failed")
				return
			}

			if err := reportDrops(); err != nil {
				h.logClose(err, "write failed")
				return
			}

		case <-ticker.C:
			pingCtx, cancel := context.WithTimeout(ctx, writeTimeout)
			err := conn.Ping(pingCtx)
			cancel()

			if err != nil {
				h.logClose(err, "ping failed")
				return
			}

			if err := reportDrops(); err != nil {
				h.logClose(err, "write failed")
				return
			}
		}
	}
}

func (h *Handler) logClose(err error, message string) {
	if errors.Is(err, context.Canceled) ||
		websocket.CloseStatus(err) == websocket.StatusNormalClosure ||
		websocket.CloseStatus(err) == websocket.StatusGoingAway {
		h.logger.Debug().Msg("websocket client detached")
		return
	}

	h.logger.Warn().Err(err).Msg(message)
}

func topicsFromQuery(r *http.Request) []events.Topic {
	raw := r.URL.Query()["topic"]

	topics := make([]events.Topic, 0, len(raw))
	for _, value := range raw {
		if value != "" {
			topics = append(topics, events.Topic(value))
		}
	}

	return topics
}
