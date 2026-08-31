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

const (
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

	ctx := r.Context()

	stream, unsubscribe := h.hub.Subscribe(topicsFromQuery(r)...)
	defer unsubscribe()

	h.logger.Debug().Int("subscribers", h.hub.SubscriberCount()).Msg("websocket client attached")

	ticker := time.NewTicker(pingInterval)
	defer ticker.Stop()

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

		case <-ticker.C:
			pingCtx, cancel := context.WithTimeout(ctx, writeTimeout)
			err := conn.Ping(pingCtx)
			cancel()

			if err != nil {
				h.logClose(err, "ping failed")
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
