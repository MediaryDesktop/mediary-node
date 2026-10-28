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

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/secrets"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/claude"
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

	h.svc.opts.Claude = client

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

func TestSuggestingNeedsClaude(t *testing.T) {
	h := newDetailsHarness(t)

	if _, err := h.svc.SuggestManual(context.Background(), ManualHint{MediaType: "movie", Title: "x"}); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("a node with Claude off answers 428, got %v", err)
	}

	settings, err := h.svc.AISettings()
	if err != nil || settings.Enabled || settings.KeySource != "none" || len(settings.Models) == 0 {
		t.Fatalf("settings %+v %v", settings, err)
	}
}

func TestSettingsStoreTheModelAndForgetTheKey(t *testing.T) {
	h := newDetailsHarness(t)
	withClaude(t, h, knownTitle)

	haiku, empty := "claude-haiku-5-5", ""

	settings, err := h.svc.SetAISettings(context.Background(), &empty, &haiku)
	if err != nil {
		t.Fatalf("set: %v", err)
	}
	if settings.Model != haiku || settings.KeySource != "none" {
		t.Fatalf("settings %+v", settings)
	}
}
