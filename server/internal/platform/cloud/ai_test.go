package cloud

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/ai"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

func newTestClient(t *testing.T, token string, handler http.HandlerFunc) *Client {
	t.Helper()

	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	client, err := New(Options{BaseURL: server.URL, DeviceToken: token})
	if err != nil {
		t.Fatalf("build client: %v", err)
	}

	return client
}

var request = ai.Request{System: "s", Prompt: "Name: Frieren", Schema: map[string]any{"type": "object"}}

func TestAnUnpairedNodeIsToldToSignIn(t *testing.T) {
	called := false
	client := newTestClient(t, "", func(http.ResponseWriter, *http.Request) { called = true })

	if _, err := client.Structured(context.Background(), request); apperr.KindOf(err) != apperr.KindPrecondition || called {
		t.Fatalf("without pairing nothing is sent and the user is told to sign in: %v", err)
	}
}

func TestTheCloudAnswersWithTheDeviceToken(t *testing.T) {
	var token string

	client := newTestClient(t, "device-token", func(w http.ResponseWriter, r *http.Request) {
		token = r.Header.Get(DeviceTokenHeader)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"json":"{\"recognized\":true}","model":"gemini-3.5-flash","quota":{"enabled":true,"limit":20,"used":1,"remaining":19,"resets_at":"2026-10-31T00:00:00Z"}}`)
	})

	answer, err := client.Structured(context.Background(), request)
	if err != nil {
		t.Fatalf("structured: %v", err)
	}

	if string(answer.JSON) != `{"recognized":true}` || answer.Model != "gemini-3.5-flash" || token != "device-token" {
		t.Fatalf("answer %+v, token %q", answer, token)
	}
}

func TestASpentAllowanceKeepsTheCloudsWords(t *testing.T) {
	client := newTestClient(t, "device-token", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/problem+json")
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = io.WriteString(w, `{"status":429,"title":"Too Many Requests","detail":"today's 20 AI requests are used up; they renew at 00:00 UTC"}`)
	})

	_, err := client.Structured(context.Background(), request)
	if apperr.KindOf(err) != apperr.KindRateLimited {
		t.Fatalf("a spent allowance is 429, got %v", err)
	}

	var appErr *apperr.Error
	if !errors.As(err, &appErr) || appErr.Message != "today's 20 AI requests are used up; they renew at 00:00 UTC" {
		t.Fatalf("the renewal time reaches the user: %v", err)
	}
}
