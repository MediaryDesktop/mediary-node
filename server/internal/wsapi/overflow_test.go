package wsapi

import (
	"context"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

// A client that fell behind is told so, once it catches up, instead of being
// left with a stream that silently skipped events.
func TestAClientThatFellBehindIsToldToReload(t *testing.T) {
	hub := events.NewHub(1)
	server := httptest.NewServer(New(hub, zerolog.Nop(), nil))
	t.Cleanup(server.Close)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	conn, response, err := websocket.Dial(ctx, "ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if response != nil && response.Body != nil {
		_ = response.Body.Close()
	}
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer func() { _ = conn.CloseNow() }()

	for hub.SubscriberCount() == 0 {
		time.Sleep(time.Millisecond)
	}

	// A burst far faster than one event a write: with room for a single event,
	// most of it is dropped.
	for range 1000 {
		hub.Publish(events.TopicTorrent, map[string]any{"reason": "progress"})
	}

	for {
		var event events.Event
		if err := wsjson.Read(ctx, conn, &event); err != nil {
			t.Fatalf("no overflow event arrived: %v", err)
		}

		if event.Topic == events.TopicOverflow {
			return
		}
	}
}
