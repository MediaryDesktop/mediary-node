package service

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/secrets"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/sources/claude"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/sources/openai"
)

// withClaude points the harness at a fake Anthropic that answers every message
// with the given JSON, and returns what it was asked.
func withClaude(t *testing.T, h *detailsHarness, answer string) *[]map[string]any {
	t.Helper()

	asked := &[]map[string]any{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)

		var body map[string]any
		_ = json.Unmarshal(raw, &body)
		*asked = append(*asked, body)

		text, _ := json.Marshal(answer)

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"msg_1","type":"message","role":"assistant","model":"claude-opus-5-5",` +
			`"stop_reason":"end_turn","content":[{"type":"text","text":` + string(text) + `}],` +
			`"usage":{"input_tokens":1,"output_tokens":1}}`))
	}))
	t.Cleanup(server.Close)

	client := claude.New(claude.Options{
		Endpoint: server.URL,
		Timeout:  5 * time.Second,
		Store:    secrets.New(filepath.Join(t.TempDir(), "claude-secrets.json")),
	})
	if err := client.Keys().SetUserKey("sk-ant-test"); err != nil {
		t.Fatalf("store key: %v", err)
	}

	h.svc.opts.AI = AIProviders{
		Store:  secrets.New(filepath.Join(t.TempDir(), "ai-secrets.json")),
		Claude: client,
	}

	return asked
}

const knownTitle = `{"recognized":true,"original_title":"ホームビデオ","synonyms":["HV"],
"description":"A family films itself.","format":"MOVIE","status":"FINISHED","year":1999,
"episodes":3,"chapters":null,"volumes":null,"pages":null,"duration":95,
"genres":["Drama","Drama"],"studios":["Studio X"],"authors":[],"country_of_origin":"jp","is_adult":false}`

func TestASuggestionKeepsTheUsersWordsAndCleansTheRest(t *testing.T) {
	h := newDetailsHarness(t)
	asked := withClaude(t, h, knownTitle)

	year := 2001
	suggestion, err := h.svc.SuggestManual(context.Background(), ManualHint{
		MediaType: "movie", Title: " Home Video ", Year: &year, Note: "Japanese", Language: "uk",
	})
	if err != nil {
		t.Fatalf("suggest: %v", err)
	}

	draft := suggestion.Draft
	if !suggestion.Recognized || suggestion.Model != "claude-opus-5-5" {
		t.Fatalf("suggestion %+v", suggestion)
	}
	if draft.Title != "Home Video" || draft.MediaType != "movie" || *draft.Year != 2001 {
		t.Fatalf("the kind, the name and the year are the user's: %+v", draft)
	}
	if *draft.Episodes != 1 || *draft.Duration != 95 || len(draft.Genres) != 1 || *draft.CountryOfOrigin != "JP" {
		t.Fatalf("the answer is cleaned like a typed draft: %+v", draft)
	}

	body := (*asked)[0]
	prompt, _ := json.Marshal(body["messages"])
	if !strings.Contains(string(prompt), "Ukrainian") || !strings.Contains(string(prompt), "Japanese") {
		t.Fatalf("the prompt carries the language and the note: %s", prompt)
	}

	output, _ := body["output_config"].(map[string]any)
	format, _ := output["format"].(map[string]any)
	schema, _ := json.Marshal(format["schema"])
	if !strings.Contains(string(schema), `"enum":["MOVIE"]`) {
		t.Fatalf("a movie's answer may only be a MOVIE: %s", schema)
	}

	if h.requests.Load() != 0 {
		t.Fatal("suggesting never reaches a catalog")
	}
}

func TestAnUnknownTitleGetsNothingInvented(t *testing.T) {
	h := newDetailsHarness(t)
	withClaude(t, h, strings.Replace(knownTitle, `"recognized":true`, `"recognized":false`, 1))

	suggestion, err := h.svc.SuggestManual(context.Background(), ManualHint{MediaType: "series", Title: "Nobody Knows"})
	if err != nil {
		t.Fatalf("suggest: %v", err)
	}

	draft := suggestion.Draft
	if suggestion.Recognized || draft.Description != "" || len(draft.Genres) != 0 || draft.Episodes != nil {
		t.Fatalf("what comes with an unknown title is a guess and is dropped: %+v", draft)
	}
	if draft.Title != "Nobody Knows" {
		t.Fatalf("the user's own name stays: %+v", draft)
	}
}

func TestAnAnswerOutOfRangeFallsBackToTheHint(t *testing.T) {
	h := newDetailsHarness(t)
	withClaude(t, h, strings.Replace(knownTitle, `"year":1999`, `"year":3000`, 1))

	suggestion, err := h.svc.SuggestManual(context.Background(), ManualHint{MediaType: "movie", Title: "Home Video"})
	if err != nil {
		t.Fatalf("suggest: %v", err)
	}
	if suggestion.Draft.Year != nil || suggestion.Draft.Description != "" {
		t.Fatalf("an impossible answer is not handed on: %+v", suggestion.Draft)
	}
}

func TestTheFreeAIIsTheDefaultAndNeedsACloudAccount(t *testing.T) {
	h := newDetailsHarness(t)

	if _, err := h.svc.SuggestManual(context.Background(), ManualHint{MediaType: "movie", Title: "x"}); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("a node that cannot reach any AI answers 428, got %v", err)
	}

	settings, err := h.svc.AISettings(context.Background())
	if err != nil || settings.Provider != ProviderCloud || settings.Ready || settings.Cloud.Linked {
		t.Fatalf("with nothing set up the free AI is chosen and not ready: %+v %v", settings, err)
	}
	if len(settings.Claude.Models) == 0 || len(settings.Gemini.Models) == 0 {
		t.Fatalf("the models are listed even before a key is saved: %+v", settings)
	}
}

func TestASavedClaudeKeyKeepsClaudeUntilTheUserChoosesAgain(t *testing.T) {
	h := newDetailsHarness(t)
	withClaude(t, h, knownTitle)

	settings, err := h.svc.AISettings(context.Background())
	if err != nil || settings.Provider != ProviderClaude || !settings.Ready {
		t.Fatalf("someone who already saved a Claude key keeps Claude: %+v %v", settings, err)
	}

	cloudChoice := ProviderCloud

	settings, err = h.svc.SetAISettings(context.Background(), AISettingsUpdate{Provider: &cloudChoice})
	if err != nil || settings.Provider != ProviderCloud || !settings.Claude.Configured {
		t.Fatalf("choosing the free AI keeps the Claude key for later: %+v %v", settings, err)
	}
}

func TestSettingsStoreTheModelAndForgetTheKey(t *testing.T) {
	h := newDetailsHarness(t)
	withClaude(t, h, knownTitle)

	haiku, empty := "claude-haiku-5-5", ""

	settings, err := h.svc.SetAISettings(context.Background(), AISettingsUpdate{
		Claude: &AIKeyUpdate{APIKey: &empty, Model: &haiku},
	})
	if err != nil {
		t.Fatalf("set: %v", err)
	}
	if settings.Claude.Model != haiku || settings.Claude.Configured {
		t.Fatalf("settings %+v", settings.Claude)
	}
	if settings.Provider != ProviderCloud {
		t.Fatalf("without a Claude key or a choice, the free AI answers: %s", settings.Provider)
	}
}

func TestAnOpenAICompatibleEndpointFillsInATitle(t *testing.T) {
	h := newDetailsHarness(t)

	var asked map[string]any

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.URL.Path == "/v1/models" {
			_, _ = w.Write([]byte(`{"data":[]}`))
			return
		}

		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &asked)

		text, _ := json.Marshal("```json\n" + knownTitle + "\n```")
		_, _ = w.Write([]byte(`{"model":"llama-test","choices":[{"finish_reason":"stop","message":{"content":` + string(text) + `}}]}`))
	}))
	t.Cleanup(server.Close)

	store := secrets.New(filepath.Join(t.TempDir(), "ai-secrets.json"))
	h.svc.opts.AI = AIProviders{Store: store, OpenAI: openai.New(openai.Options{Timeout: 5 * time.Second, Store: store})}

	choice, endpoint, model := ProviderOpenAI, server.URL+"/v1/", "llama-test"

	settings, err := h.svc.SetAISettings(context.Background(), AISettingsUpdate{
		Provider: &choice,
		OpenAI:   &OpenAIUpdate{Endpoint: &endpoint, Model: &model},
	})
	if err != nil || !settings.Ready || settings.OpenAI.HasKey || settings.OpenAI.Endpoint != server.URL+"/v1" {
		t.Fatalf("a local endpoint needs no key: %+v %v", settings, err)
	}

	suggestion, err := h.svc.SuggestManual(context.Background(), ManualHint{MediaType: "movie", Title: "Home Video"})
	if err != nil || !suggestion.Recognized || suggestion.Model != "llama-test" {
		t.Fatalf("suggestion %+v %v", suggestion, err)
	}

	format, _ := asked["response_format"].(map[string]any)
	if format["type"] != "json_schema" {
		t.Fatalf("the schema is asked for: %v", asked["response_format"])
	}
}
