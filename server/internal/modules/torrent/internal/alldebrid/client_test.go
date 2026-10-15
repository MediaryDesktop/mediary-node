package alldebrid

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func serve(t *testing.T, handler http.HandlerFunc) *Client {
	t.Helper()

	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	return New(Options{BaseURL: server.URL, Key: func() (string, error) { return "key", nil }})
}

func ok(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"status": "success", "data": data})
}

func TestBadKeySaysSo(t *testing.T) {
	// The answer AllDebrid gives a wrong key, with HTTP 200.
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"status":"error","error":{"code":"AUTH_BAD_APIKEY","message":"The auth apikey is invalid"}}`))
	})

	_, err := client.Account(context.Background())
	if err == nil || !strings.Contains(err.Error(), "API key") {
		t.Fatalf("err = %v", err)
	}
}

func TestEveryCallNamesTheAgent(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("agent") != agent || r.Header.Get("Authorization") != "Bearer key" {
			t.Errorf("query %s, auth %q", r.URL.RawQuery, r.Header.Get("Authorization"))
		}
		ok(w, map[string]any{"user": map[string]any{"username": "u", "isPremium": true, "premiumUntil": 1893456000}})
	})

	account, err := client.Account(context.Background())
	if err != nil || account != "AllDebrid · Premium until 2030-01-01" {
		t.Fatalf("account = %q, %v", account, err)
	}
}

func TestMagnetLifecycle(t *testing.T) {
	var unlocked, deleted string

	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()

		switch r.URL.Path {
		case "/magnet/upload":
			if r.PostForm.Get("magnets[]") == "" {
				t.Error("no magnet sent")
			}
			ok(w, map[string]any{"magnets": []map[string]any{{"id": 42, "hash": "aaaa", "ready": false}}})
		case "/magnet/status":
			ok(w, map[string]any{"magnets": []map[string]any{
				{"id": 42, "filename": "Show", "hash": "AAAA", "size": 100, "downloaded": 100, "status": "Ready", "statusCode": 4},
				{"id": 43, "filename": "Q", "hash": "BBBB", "size": 100, "downloaded": 0, "status": "In Queue", "statusCode": 0},
				{"id": 44, "filename": "E", "hash": "CCCC", "size": 100, "status": "No peer after 30 minutes", "statusCode": 8},
			}})
		case "/magnet/files":
			if r.PostForm.Get("id[]") != "42" {
				t.Errorf("files of %q", r.PostForm.Get("id[]"))
			}
			ok(w, map[string]any{"magnets": []map[string]any{{"id": "42", "files": []map[string]any{
				{"n": "Show", "e": []map[string]any{
					{"n": "02.mkv", "s": 20, "l": "https://ad/2"},
					{"n": "01.mkv", "s": 10, "l": "https://ad/1"},
				}},
			}}}})
		case "/link/unlock":
			unlocked = r.PostForm.Get("link")
			ok(w, map[string]any{"link": "https://download/" + strings.TrimPrefix(unlocked, "https://ad/")})
		case "/magnet/delete":
			deleted = r.PostForm.Get("id")
			ok(w, map[string]any{"message": "deleted"})
		default:
			t.Errorf("unexpected %s", r.URL.Path)
		}
	})
	ctx := context.Background()

	id, err := client.Add(ctx, "magnet:?xt=urn:btih:aaaa", nil, "")
	if err != nil || id != "42" {
		t.Fatalf("add = %q, %v", id, err)
	}

	remotes, err := client.Remotes(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if r := remotes[0]; !r.Ready || r.Hash != "aaaa" || r.Progress != 1 || !r.Partial {
		t.Errorf("ready = %+v", r)
	}
	if r := remotes[1]; !r.Queued {
		t.Errorf("queued = %+v", r)
	}
	if r := remotes[2]; !strings.Contains(r.Failed, "No peer") {
		t.Errorf("failed = %+v", r)
	}

	full, err := client.Detail(ctx, remotes[0])
	if err != nil {
		t.Fatal(err)
	}
	if len(full.Files) != 2 || full.Files[0].Path != "Show/01.mkv" || full.Files[1].Size != 20 {
		t.Errorf("files = %+v", full.Files)
	}

	link, err := client.Link(ctx, remotes[0], 1)
	if err != nil || unlocked != "https://ad/2" || link != "https://download/2" {
		t.Errorf("link = %q (unlocked %q), %v", link, unlocked, err)
	}

	if err := client.Delete(ctx, remotes[0]); err != nil || deleted != "42" {
		t.Errorf("delete %q: %v", deleted, err)
	}
}
