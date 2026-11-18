package pace

import (
	"context"
	"net/http"
	"testing"
	"time"
)

func TestWaitSpacesCallersOneIntervalApart(t *testing.T) {
	pacer := New(40 * time.Millisecond)
	start := time.Now()

	for range 3 {
		if err := pacer.Wait(context.Background()); err != nil {
			t.Fatal(err)
		}
	}

	if elapsed := time.Since(start); elapsed < 80*time.Millisecond {
		t.Fatalf("three calls took %v, want at least two intervals", elapsed)
	}
}

func TestBlockUntilHoldsTheNextCallBack(t *testing.T) {
	pacer := New(time.Millisecond)
	pacer.BlockUntil(time.Now().Add(50 * time.Millisecond))
	pacer.BlockUntil(time.Now())

	start := time.Now()
	if err := pacer.Wait(context.Background()); err != nil {
		t.Fatal(err)
	}

	if elapsed := time.Since(start); elapsed < 40*time.Millisecond {
		t.Fatalf("waited %v, the longer block should stand", elapsed)
	}
}

func TestWaitEndsWithTheContext(t *testing.T) {
	pacer := New(time.Millisecond)
	pacer.BlockUntil(time.Now().Add(time.Hour))

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if err := pacer.Wait(ctx); err == nil {
		t.Fatal("a cancelled wait should fail")
	}
}

func TestRetryAt(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)

	cases := map[string]time.Time{
		"30":                            now.Add(30 * time.Second),
		"Thu, 01 Jan 2026 12:05:00 GMT": now.Add(5 * time.Minute),
		"soon":                          now.Add(10 * time.Second),
	}

	for raw, want := range cases {
		headers := http.Header{"Retry-After": []string{raw}}
		if got := RetryAt(headers, now, 10*time.Second); !got.Equal(want) {
			t.Errorf("Retry-After %q: got %v, want %v", raw, got, want)
		}
	}
}
