package events

import (
	"sync"
	"time"
)

type Topic string

const (
	TopicLibraryScan   Topic = "library.scan"
	TopicLibraryUpdate Topic = "library.update"
	TopicTorrent       Topic = "torrent"
	TopicPlayback      Topic = "playback"
	TopicSync          Topic = "sync"
	TopicNotification  Topic = "notification"
)

type Event struct {
	Topic     Topic          `json:"topic"`
	At        time.Time      `json:"at"`
	Payload   map[string]any `json:"payload,omitempty"`
	RequestID string         `json:"request_id,omitempty"`
}

type Hub struct {
	mu          sync.RWMutex
	subscribers map[int]*subscriber
	nextID      int
	bufferSize  int
}

type subscriber struct {
	channel chan Event
	topics  map[Topic]struct{}
	dropped uint64
}

func NewHub(bufferSize int) *Hub {
	if bufferSize < 1 {
		bufferSize = 64
	}

	return &Hub{
		subscribers: make(map[int]*subscriber),
		bufferSize:  bufferSize,
	}
}

func (h *Hub) Subscribe(topics ...Topic) (stream <-chan Event, unsubscribe func()) {
	filter := make(map[Topic]struct{}, len(topics))
	for _, topic := range topics {
		filter[topic] = struct{}{}
	}

	sub := &subscriber{
		channel: make(chan Event, h.bufferSize),
		topics:  filter,
	}

	h.mu.Lock()
	id := h.nextID
	h.nextID++
	h.subscribers[id] = sub
	h.mu.Unlock()

	return sub.channel, func() {
		h.mu.Lock()
		defer h.mu.Unlock()

		if existing, ok := h.subscribers[id]; ok {
			delete(h.subscribers, id)
			close(existing.channel)
		}
	}
}

func (h *Hub) Publish(topic Topic, payload map[string]any) {
	event := Event{Topic: topic, At: time.Now().UTC(), Payload: payload}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, sub := range h.subscribers {
		if len(sub.topics) > 0 {
			if _, wants := sub.topics[topic]; !wants {
				continue
			}
		}

		select {
		case sub.channel <- event:
		default:

			sub.dropped++
		}
	}
}

func (h *Hub) SubscriberCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	return len(h.subscribers)
}
