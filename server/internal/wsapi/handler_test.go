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

// A client that only listens must outlive the pings: they used to time out for
// want of a reader on the node's side, dropping the client every forty seconds
// and with it whatever was published until it came back.
func TestClientSurvivesPings(t *testing.T) {
	previousPing, previousWrite := pingInterval, writeTimeout
	pingInterval, writeTimeout = 20*time.Millisecond, 100*time.Millisecond
	t.Cleanup(func() { pingInterval, writeTimeout = previousPing, previousWrite })

	hub := events.NewHub(8)
	server := httptest.NewServer(New(hub, zerolog.Nop(), nil))
	t.Cleanup(server.Close)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, _, err := websocket.Dial(ctx, "ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer func() { _ = conn.CloseNow() }()

	received := make(chan events.Event, 1)
	failed := make(chan error, 1)
	go func() {
		var event events.Event
		if err := wsjson.Read(ctx, conn, &event); err != nil {
			failed <- err
			return
		}
		received <- event
	}()

	// Long enough for several pings and for any of them to time out.
	time.Sleep(500 * time.Millisecond)

	select {
	case err := <-failed:
		t.Fatalf("the node dropped the connection before publishing: %v", err)
	default:
	}

	hub.Publish(events.TopicTorrent, map[string]any{"reason": "done"})

	select {
	case event := <-received:
		if event.Topic != events.TopicTorrent {
			t.Fatalf("got topic %q, want %q", event.Topic, events.TopicTorrent)
		}
	case err := <-failed:
		t.Fatalf("the event never arrived: %v", err)
	case <-ctx.Done():
		t.Fatal("the event never arrived")
	}
}
