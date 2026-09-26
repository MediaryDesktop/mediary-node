package mpv

import (
	"bufio"
	"context"
	"encoding/json"
	"net"
	"testing"
	"time"
)

// fakePlayer speaks mpv's side of the protocol over an in-process pipe: it answers
// every command with the status mpv would send and can push events of its own.
type fakePlayer struct {
	t    *testing.T
	conn net.Conn

	reader   *bufio.Reader
	answer   string
	commands chan []any
}

func newFakePlayer(t *testing.T) (*Client, *fakePlayer) {
	t.Helper()

	clientSide, playerSide := net.Pipe()

	player := &fakePlayer{
		t:        t,
		conn:     playerSide,
		reader:   bufio.NewReader(playerSide),
		answer:   "success",
		commands: make(chan []any, 8),
	}

	client := New(clientSide)
	t.Cleanup(func() { _ = client.Close() })

	go player.serve()

	return client, player
}

func (f *fakePlayer) serve() {
	for {
		line, err := f.reader.ReadBytes('\n')
		if err != nil {
			return
		}

		var request struct {
			Command   []any `json:"command"`
			RequestID int   `json:"request_id"`
		}

		if err := json.Unmarshal(line, &request); err != nil {
			return
		}

		f.commands <- request.Command

		reply := map[string]any{"request_id": request.RequestID, "error": f.answer, "data": nil}
		if err := json.NewEncoder(f.conn).Encode(reply); err != nil {
			return
		}
	}
}

func (f *fakePlayer) push(payload map[string]any) {
	f.t.Helper()

	if err := json.NewEncoder(f.conn).Encode(payload); err != nil {
		f.t.Fatalf("push event: %v", err)
	}
}

func (f *fakePlayer) nextCommand(t *testing.T) []any {
	t.Helper()

	select {
	case command := <-f.commands:
		return command
	case <-time.After(2 * time.Second):
		t.Fatal("mpv received no command")

		return nil
	}
}

func TestCommandCarriesItsAnswerBack(t *testing.T) {
	client, player := newFakePlayer(t)

	if _, err := client.Command(context.Background(), "loadfile", "D:/Anime/ep.mkv"); err != nil {
		t.Fatalf("loadfile: %v", err)
	}

	command := player.nextCommand(t)
	if len(command) != 2 || command[0] != "loadfile" {
		t.Fatalf("mpv got %v, want a loadfile command", command)
	}
}

func TestCommandFailsWhenMpvRefuses(t *testing.T) {
	client, player := newFakePlayer(t)
	player.answer = "property not found"

	if _, err := client.Command(context.Background(), "get_property", "nonsense"); err == nil {
		t.Fatal("a refused command reported success")
	}
}

func TestObservedPropertiesArriveAsEvents(t *testing.T) {
	client, player := newFakePlayer(t)

	if err := client.Observe(context.Background(), 1, "time-pos"); err != nil {
		t.Fatalf("observe: %v", err)
	}
	player.nextCommand(t)

	player.push(map[string]any{"event": "property-change", "id": 1, "name": "time-pos", "data": 12.5})

	select {
	case event := <-client.Events():
		if event.Name != "property-change" || event.Property != "time-pos" {
			t.Fatalf("event = %+v, want a time-pos change", event)
		}

		var position float64
		if err := json.Unmarshal(event.Data, &position); err != nil || position != 12.5 {
			t.Fatalf("position = %v (%v), want 12.5", position, err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("the observed property never arrived")
	}
}

func TestEndOfFileCarriesItsReason(t *testing.T) {
	client, player := newFakePlayer(t)

	player.push(map[string]any{"event": "end-file", "reason": "eof"})

	select {
	case event := <-client.Events():
		if event.Name != "end-file" || event.Reason != "eof" {
			t.Fatalf("event = %+v, want end-file with reason eof", event)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("the end of the file was never reported")
	}
}

// The player closing is the normal end of a session, so a command in flight has to
// come back rather than hang.
func TestCommandsStopWhenTheConnectionCloses(t *testing.T) {
	client, _ := newFakePlayer(t)

	if err := client.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}

	if _, err := client.Command(context.Background(), "get_property", "time-pos"); err == nil {
		t.Fatal("a command on a closed connection succeeded")
	}
}
