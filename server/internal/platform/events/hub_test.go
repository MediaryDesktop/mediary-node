package events

import (
	"sync"
	"testing"
)

// Publish runs from many goroutines at once — scans, downloads, playback — and a
// subscriber that does not read fills up. What is dropped must be counted
// without a race; run with -race.
func TestConcurrentPublishToAFullSubscriberCountsWhatItDrops(t *testing.T) {
	hub := NewHub(1)
	_, unsubscribe := hub.Subscribe()
	defer unsubscribe()

	const publishers, each = 8, 100

	var wg sync.WaitGroup
	for range publishers {
		wg.Go(func() {
			for range each {
				hub.Publish(TopicLibraryScan, nil)
			}
		})
	}
	wg.Wait()

	hub.mu.RLock()
	defer hub.mu.RUnlock()

	for _, sub := range hub.subscribers {
		if got := sub.dropped.Load(); got != publishers*each-1 {
			t.Errorf("dropped = %d, want %d: one event fits the buffer", got, publishers*each-1)
		}
	}
}
