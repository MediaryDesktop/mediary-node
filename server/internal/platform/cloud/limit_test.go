package cloud

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func withResponseLimit(t *testing.T, limit int64) {
	t.Helper()

	previous := maxResponseBytes
	maxResponseBytes = limit
	t.Cleanup(func() { maxResponseBytes = previous })
}

func serving(t *testing.T, body string) *Client {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/gzip")
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(server.Close)

	client, err := New(Options{BaseURL: server.URL, DeviceToken: "token"})
	if err != nil {
		t.Fatal(err)
	}

	return client
}

// The generated client reads a whole answer into memory, so the node stops one
// that goes on past what the cloud ever sends instead of holding all of it.
func TestAnAnswerPastTheLimitIsRefused(t *testing.T) {
	withResponseLimit(t, 16)

	client := serving(t, strings.Repeat("x", 17))

	_, err := client.API().DownloadBackupWithResponse(t.Context(), uuid.New())
	if !errors.Is(err, ErrResponseTooLarge) {
		t.Fatalf("download = %v, want ErrResponseTooLarge", err)
	}
}

func TestAnAnswerUpToTheLimitIsRead(t *testing.T) {
	withResponseLimit(t, 16)

	client := serving(t, strings.Repeat("x", 16))

	resp, err := client.API().DownloadBackupWithResponse(t.Context(), uuid.New())
	if err != nil {
		t.Fatalf("download = %v, want the whole answer", err)
	}

	if len(resp.Body) != 16 {
		t.Errorf("read %d bytes, want 16", len(resp.Body))
	}
}
