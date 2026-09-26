// Package mpv speaks mpv's JSON IPC protocol: newline-delimited JSON over a unix
// socket or, on Windows, a named pipe. mpv is the player Seanime uses too, and for
// the same reason — it plays anything the user has without a transcoding step, and
// it reports position and end-of-file over a socket the node can listen to.
package mpv

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"sync"
)

// How many events wait for a reader before the oldest are dropped. Position
// updates arrive several times a second and are worthless late, so a slow reader
// is skipped rather than waited for — the same rule the node's event hub follows.
const eventBuffer = 64

var ErrClosed = errors.New("mpv connection is closed")

// Event is what mpv reports on its own: a property it was asked to watch, or the
// end of a file.
type Event struct {
	Name     string
	Property string
	Reason   string
	Data     json.RawMessage
}

type frame struct {
	RequestID *int            `json:"request_id"`
	Error     string          `json:"error"`
	Data      json.RawMessage `json:"data"`
	Event     string          `json:"event"`
	Name      string          `json:"name"`
	Reason    string          `json:"reason"`
}

type response struct {
	data json.RawMessage
	err  error
}

type Client struct {
	conn net.Conn

	writeMu sync.Mutex
	encoder *json.Encoder

	mu      sync.Mutex
	nextID  int
	pending map[int]chan response

	events    chan Event
	closed    chan struct{}
	closeOnce sync.Once
}

// New drives an already-open connection. Tests hand it both ends of net.Pipe; the
// node gets it from Dial.
func New(conn net.Conn) *Client {
	client := &Client{
		conn:    conn,
		encoder: json.NewEncoder(conn),
		nextID:  1,
		pending: make(map[int]chan response),
		events:  make(chan Event, eventBuffer),
		closed:  make(chan struct{}),
	}

	go client.read()

	return client
}

func (c *Client) Events() <-chan Event { return c.events }

func (c *Client) Closed() <-chan struct{} { return c.closed }

// Command sends one mpv command and waits for the answer that carries its id.
func (c *Client) Command(ctx context.Context, args ...any) (json.RawMessage, error) {
	c.mu.Lock()
	if c.isClosed() {
		c.mu.Unlock()

		return nil, ErrClosed
	}

	id := c.nextID
	c.nextID++
	waiting := make(chan response, 1)
	c.pending[id] = waiting
	c.mu.Unlock()

	defer func() {
		c.mu.Lock()
		delete(c.pending, id)
		c.mu.Unlock()
	}()

	if err := c.write(map[string]any{"command": args, "request_id": id}); err != nil {
		return nil, err
	}

	select {
	case answer := <-waiting:
		return answer.data, answer.err
	case <-c.closed:
		return nil, ErrClosed
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (c *Client) Set(ctx context.Context, property string, value any) error {
	_, err := c.Command(ctx, "set_property", property, value)

	return err
}

// Observe asks mpv to report a property whenever it changes, which is how the
// node follows the position without polling.
func (c *Client) Observe(ctx context.Context, id int, property string) error {
	_, err := c.Command(ctx, "observe_property", id, property)

	return err
}

func (c *Client) Close() error {
	c.closeOnce.Do(func() {
		close(c.closed)

		c.mu.Lock()
		for id, waiting := range c.pending {
			select {
			case waiting <- response{err: ErrClosed}:
			default:
			}
			delete(c.pending, id)
		}
		c.mu.Unlock()
	})

	return c.conn.Close()
}

func (c *Client) write(payload map[string]any) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()

	if err := c.encoder.Encode(payload); err != nil {
		return fmt.Errorf("send mpv command: %w", err)
	}

	return nil
}

func (c *Client) read() {
	decoder := json.NewDecoder(c.conn)

	for {
		var incoming frame

		if err := decoder.Decode(&incoming); err != nil {
			_ = c.Close()
			close(c.events)

			return
		}

		switch {
		case incoming.RequestID != nil:
			c.answer(*incoming.RequestID, incoming)
		case incoming.Event != "":
			c.publish(Event{
				Name:     incoming.Event,
				Property: incoming.Name,
				Reason:   incoming.Reason,
				Data:     incoming.Data,
			})
		}
	}
}

func (c *Client) answer(id int, incoming frame) {
	c.mu.Lock()
	waiting, found := c.pending[id]
	c.mu.Unlock()

	if !found {
		return
	}

	answer := response{data: incoming.Data}

	// mpv answers every command with a status, and "success" is the only one that
	// means the command ran.
	if incoming.Error != "" && incoming.Error != "success" {
		answer.err = fmt.Errorf("mpv rejected the command: %s", incoming.Error)
	}

	select {
	case waiting <- answer:
	default:
	}
}

func (c *Client) publish(event Event) {
	select {
	case c.events <- event:
	default:
	}
}

func (c *Client) isClosed() bool {
	select {
	case <-c.closed:
		return true
	default:
		return false
	}
}
