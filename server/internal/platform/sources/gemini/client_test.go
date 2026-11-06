package gemini

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/ai"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/secrets"
)

type fakeGemini struct {
	status int
	answer string
	path   string
	key    string
	body   map[string]any
}

func newClient(t *testing.T, fake *fakeGemini) *Client {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fake.path = r.URL.Path
		fake.key = r.Header.Get("x-goog-api-key")

		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &fake.body)

		w.WriteHeader(fake.status)
		_, _ = io.WriteString(w, fake.answer)
	}))
	t.Cleanup(server.Close)

	return New(Options{
		Endpoint: server.URL,
		Timeout:  5 * time.Second,
		Store:    secrets.New(filepath.Join(t.TempDir(), "ai-secrets.json")),
	})
}

func TestNoKeyMeansNoRequest(t *testing.T) {
	fake := &fakeGemini{status: http.StatusOK}
	client := newClient(t, fake)

	_, err := client.Structured(context.Background(), ai.Request{Prompt: "x", Schema: map[string]any{"type": "object"}})
	if apperr.KindOf(err) != apperr.KindPrecondition || fake.path != "" {
		t.Fatalf("without a key nothing is sent and the user is told to add one: %v (path %q)", err, fake.path)
	}
}

func TestStructuredAsksForTheSchemaWithTheKeyInAHeader(t *testing.T) {
	fake := &fakeGemini{
		status: http.StatusOK,
		answer: `{"candidates":[{"content":{"parts":[{"text":"{\"recognized\":true}"}]},"finishReason":"STOP"}],"modelVersion":"gemini-3.5-flash-001"}`,
	}
	client := newClient(t, fake)

	if err := client.Keys().SetUserKey("AIza-test"); err != nil {
		t.Fatalf("store key: %v", err)
	}

	answer, err := client.Structured(context.Background(), ai.Request{
		System: "be brief", Prompt: "Name: Frieren", Schema: map[string]any{"type": "object"},
	})
	if err != nil {
		t.Fatalf("structured: %v", err)
	}

	if string(answer.JSON) != `{"recognized":true}` || answer.Model != "gemini-3.5-flash-001" {
		t.Fatalf("answer %+v", answer)
	}

	if fake.path != "/v1beta/models/gemini-3.5-flash:generateContent" || fake.key != "AIza-test" {
		t.Fatalf("asked %q with key %q", fake.path, fake.key)
	}

	config, _ := fake.body["generationConfig"].(map[string]any)
	if config["responseJsonSchema"] == nil || config["responseMimeType"] != "application/json" {
		t.Fatalf("the schema was not asked for: %v", config)
	}
}

func TestAnInvalidKeyIsAPrecondition(t *testing.T) {
	fake := &fakeGemini{
		status: http.StatusBadRequest,
		answer: `{"error":{"code":400,"message":"API key not valid.","status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}`,
	}
	client := newClient(t, fake)

	if err := client.Check(context.Background(), "wrong"); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("a refused key is 428, got %v", err)
	}

	if fake.path != "/v1beta/models/gemini-3.5-flash" {
		t.Fatalf("checking a key reads a model and generates nothing: %q", fake.path)
	}
}

func TestACutOffAnswerIsAnUpstreamFailure(t *testing.T) {
	fake := &fakeGemini{
		status: http.StatusOK,
		answer: `{"candidates":[{"content":{"parts":[{"text":"{\"a\":"}]},"finishReason":"MAX_TOKENS"}]}`,
	}
	client := newClient(t, fake)
	_ = client.Keys().SetUserKey("AIza-test")

	_, err := client.Structured(context.Background(), ai.Request{Prompt: "x", Schema: map[string]any{"type": "object"}})
	if apperr.KindOf(err) != apperr.KindUpstream {
		t.Fatalf("a cut-off answer is 502, got %v", err)
	}
}
