package claude

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/secrets"
)

type fakeAnthropic struct {
	server *httptest.Server

	mu       sync.Mutex
	bodies   []map[string]any
	betas    []string
	keys     []string
	paths    []string
	status   int
	response string
}

func newFakeAnthropic(t *testing.T) *fakeAnthropic {
	t.Helper()

	fake := &fakeAnthropic{status: http.StatusOK}

	fake.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)

		var body map[string]any
		_ = json.Unmarshal(raw, &body)

		fake.mu.Lock()
		fake.bodies = append(fake.bodies, body)
		fake.betas = append(fake.betas, r.Header.Get("anthropic-beta"))
		fake.keys = append(fake.keys, strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
		fake.paths = append(fake.paths, r.URL.Path)
		status, response := fake.status, fake.response
		fake.mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)

		if status != http.StatusOK {
			_, _ = w.Write([]byte(`{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}`))
			return
		}

		if strings.HasPrefix(r.URL.Path, "/v1/models/") {
			_, _ = w.Write([]byte(`{"id":"claude-opus-5-5","type":"model","display_name":"Claude Opus 5.5","created_at":"2026-01-01T00:00:00Z"}`))
			return
		}

		_, _ = w.Write([]byte(response))
	}))
	t.Cleanup(fake.server.Close)

	return fake
}

func message(model, stopReason, text string) string {
	encoded, _ := json.Marshal(text)

	return `{"id":"msg_1","type":"message","role":"assistant","model":"` + model + `","stop_reason":"` + stopReason +
		`","content":[{"type":"text","text":` + string(encoded) + `}],"usage":{"input_tokens":10,"output_tokens":10}}`
}

func newClient(t *testing.T, fake *fakeAnthropic) *Client {
	t.Helper()

	return New(Options{
		Endpoint: fake.server.URL,
		Timeout:  5 * time.Second,
		Store:    secrets.New(filepath.Join(t.TempDir(), "claude-secrets.json")),
	})
}

var schema = map[string]any{
	"type":                 "object",
	"properties":           map[string]any{"recognized": map[string]any{"type": "boolean"}},
	"required":             []any{"recognized"},
	"additionalProperties": false,
}

func TestNoKeyMeansNoRequest(t *testing.T) {
	fake := newFakeAnthropic(t)
	client := newClient(t, fake)

	if _, err := client.Structured(context.Background(), Request{Prompt: "x", Schema: schema}); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("without a key the node must not ask, got %v", err)
	}

	if len(fake.paths) != 0 {
		t.Fatalf("made %d requests without a key", len(fake.paths))
	}
}

func TestStructuredAsksForTheSchemaWithAFallback(t *testing.T) {
	fake := newFakeAnthropic(t)
	fake.response = message("claude-opus-5-5", "end_turn", `{"recognized":true}`)

	client := newClient(t, fake)
	if err := client.Keys().SetUserKey("sk-ant-test"); err != nil {
		t.Fatalf("store key: %v", err)
	}

	answer, err := client.Structured(context.Background(), Request{System: "sys", Prompt: "Name: x", Schema: schema})
	if err != nil {
		t.Fatalf("structured: %v", err)
	}

	if string(answer.JSON) != `{"recognized":true}` || answer.Model != "claude-opus-5-5" {
		t.Fatalf("answer %+v", answer)
	}

	body := fake.bodies[0]
	if body["model"] != "claude-opus-5-5" || fake.keys[0] != "sk-ant-test" {
		t.Fatalf("model %v key %q", body["model"], fake.keys[0])
	}

	output, _ := body["output_config"].(map[string]any)
	format, _ := output["format"].(map[string]any)
	if output["effort"] != "medium" || format["type"] != "json_schema" || format["schema"] == nil {
		t.Fatalf("output_config %v", output)
	}

	if body["fallbacks"] != "default" || !strings.Contains(fake.betas[0], "server-side-fallback-2026-07-01") {
		t.Fatalf("an Opus request hands a refusal on: fallbacks %v, betas %q", body["fallbacks"], fake.betas[0])
	}

	if _, ok := body["thinking"]; ok {
		t.Fatal("thinking is left to the model's default")
	}
}

func TestHaikuIsAskedWithoutAFallback(t *testing.T) {
	fake := newFakeAnthropic(t)
	fake.response = message("claude-haiku-5-5", "end_turn", `{"recognized":false}`)

	client := newClient(t, fake)
	_ = client.Keys().SetUserKey("sk-ant-test")

	if err := client.SetModel("claude-haiku-5-5"); err != nil {
		t.Fatalf("set model: %v", err)
	}
	if err := client.SetModel("gpt-5"); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("an unknown model is refused, got %v", err)
	}

	if _, err := client.Structured(context.Background(), Request{Prompt: "x", Schema: schema}); err != nil {
		t.Fatalf("structured: %v", err)
	}

	if _, ok := fake.bodies[0]["fallbacks"]; ok || strings.Contains(fake.betas[0], "fallback") {
		t.Fatalf("Haiku has no server-side fallback: %v %q", fake.bodies[0]["fallbacks"], fake.betas[0])
	}
}

func TestARefusalOrACutOffAnswerIsAnUpstreamFailure(t *testing.T) {
	for _, stop := range []string{"refusal", "max_tokens"} {
		fake := newFakeAnthropic(t)
		fake.response = message("claude-opus-5-5", stop, `{"recog`)

		client := newClient(t, fake)
		_ = client.Keys().SetUserKey("sk-ant-test")

		if _, err := client.Structured(context.Background(), Request{Prompt: "x", Schema: schema}); apperr.KindOf(err) != apperr.KindUpstream {
			t.Fatalf("%s: want upstream, got %v", stop, err)
		}
	}
}

func TestCheckLooksUpAModelAndARejectedKeyIsAPrecondition(t *testing.T) {
	fake := newFakeAnthropic(t)
	client := newClient(t, fake)

	if err := client.Check(context.Background(), "sk-ant-good"); err != nil {
		t.Fatalf("check: %v", err)
	}
	if !strings.HasPrefix(fake.paths[0], "/v1/models/") {
		t.Fatalf("a key is checked with a free model lookup, asked %s", fake.paths[0])
	}

	fake.status = http.StatusUnauthorized

	err := client.Check(context.Background(), "sk-ant-bad")
	if apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("a refused key is 428, never 401, got %v", err)
	}
}
