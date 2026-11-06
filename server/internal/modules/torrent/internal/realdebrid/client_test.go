package realdebrid

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/torrent/internal/debrid"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

func serve(t *testing.T, handler http.HandlerFunc) *Client {
	t.Helper()

	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	return New(Options{BaseURL: server.URL, Key: func() (string, error) { return "token", nil }})
}

func write(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

func TestAccountNeedsPremium(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer token" {
			t.Errorf("Authorization = %q", r.Header.Get("Authorization"))
		}
		write(w, map[string]any{"username": "u", "type": "free", "expiration": "2026-01-01T00:00:00.000Z"})
	})

	_, err := client.Account(context.Background())
	if apperr.KindOf(err) != apperr.KindPrecondition || !strings.Contains(err.Error(), "premium") {
		t.Fatalf("err = %v, want premium required", err)
	}
}

func TestBadTokenSaysSo(t *testing.T) {
	// The answer Real-Debrid gives a wrong token.
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"bad_token","error_code":8}`))
	})

	_, err := client.Account(context.Background())
	if err == nil || !strings.Contains(err.Error(), "API token") {
		t.Fatalf("err = %v", err)
	}
}

func TestTorrentLifecycle(t *testing.T) {
	var selected, deleted, unrestricted string

	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/torrents/addMagnet":
			_ = r.ParseForm()
			if !strings.HasPrefix(r.PostForm.Get("magnet"), "magnet:") {
				t.Errorf("magnet = %q", r.PostForm.Get("magnet"))
			}
			w.WriteHeader(http.StatusCreated)
			write(w, map[string]any{"id": "ABC", "uri": "x"})
		case r.Method == http.MethodGet && r.URL.Path == "/torrents":
			write(w, []map[string]any{
				{"id": "ABC", "filename": "Show", "hash": "AAAA", "progress": 100, "status": "downloaded"},
				{"id": "W", "filename": "Wait", "hash": "BBBB", "progress": 0, "status": "waiting_files_selection"},
				{"id": "D", "filename": "Dead", "hash": "CCCC", "progress": 0, "status": "magnet_error"},
			})
		case r.Method == http.MethodGet && r.URL.Path == "/torrents/info/ABC":
			write(w, map[string]any{
				"id": "ABC", "filename": "Show", "hash": "AAAA", "progress": 100, "status": "downloaded",
				"files": []map[string]any{
					{"id": 2, "path": "/Show/02.mkv", "bytes": 20, "selected": 1},
					{"id": 1, "path": "/Show/01.mkv", "bytes": 10, "selected": 1},
					{"id": 3, "path": "/Show/info.nfo", "bytes": 1, "selected": 0},
				},
				"links": []string{"https://rd/link1", "https://rd/link2"},
			})
		case r.Method == http.MethodPost && r.URL.Path == "/torrents/selectFiles/W":
			_ = r.ParseForm()
			selected = r.PostForm.Get("files")
			w.WriteHeader(http.StatusNoContent)
		case r.Method == http.MethodPost && r.URL.Path == "/unrestrict/link":
			_ = r.ParseForm()
			unrestricted = r.PostForm.Get("link")
			write(w, map[string]any{"download": "https://download/02.mkv"})
		case r.Method == http.MethodDelete && r.URL.Path == "/torrents/delete/ABC":
			deleted = "ABC"
			w.WriteHeader(http.StatusNoContent)
		default:
			body, _ := io.ReadAll(r.Body)
			t.Errorf("unexpected %s %s %s", r.Method, r.URL.Path, body)
		}
	})
	ctx := context.Background()

	id, err := client.Add(ctx, "magnet:?xt=urn:btih:aaaa", nil, "")
	if err != nil || id != "ABC" {
		t.Fatalf("add = %q, %v", id, err)
	}

	remotes, err := client.Remotes(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if r := remotes[0]; !r.Ready || !r.Partial || r.Hash != "aaaa" || r.Progress != 1 {
		t.Errorf("ready = %+v", r)
	}
	if r := remotes[1]; !r.Waiting || r.Ready {
		t.Errorf("waiting = %+v", r)
	}
	if r := remotes[2]; r.Failed == "" {
		t.Errorf("failed = %+v", r)
	}

	if startErr := client.Start(ctx, remotes[1]); startErr != nil || selected != "all" {
		t.Errorf("start: selected %q, %v", selected, startErr)
	}

	full, err := client.Detail(ctx, remotes[0])
	if err != nil {
		t.Fatal(err)
	}
	if len(full.Files) != 3 || full.Files[0].Path != "Show/01.mkv" || full.Files[0].ID != 1 {
		t.Errorf("files = %+v", full.Files)
	}

	// The second selected file takes the second link.
	link, err := client.Link(ctx, remotes[0], 2)
	if err != nil || link != "https://download/02.mkv" || unrestricted != "https://rd/link2" {
		t.Errorf("link = %q (unrestricted %q), %v", link, unrestricted, err)
	}

	if _, err := client.Link(ctx, remotes[0], 3); err == nil {
		t.Error("an unselected file got a link")
	}

	if _, err := client.Cached(ctx, []string{"aaaa"}); !errors.Is(err, debrid.ErrNoCacheCheck) {
		t.Errorf("cached err = %v", err)
	}

	if err := client.Delete(ctx, remotes[0]); err != nil || deleted != "ABC" {
		t.Errorf("delete: %v", err)
	}
}

func TestTorrentFileIsPutAsIs(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		if r.Method != http.MethodPut || r.URL.Path != "/torrents/addTorrent" || string(body) != "d4:infoe" {
			t.Errorf("%s %s %q", r.Method, r.URL.Path, body)
		}
		w.WriteHeader(http.StatusCreated)
		write(w, map[string]any{"id": "T"})
	})

	if id, err := client.Add(context.Background(), "", []byte("d4:infoe"), ""); err != nil || id != "T" {
		t.Fatalf("add = %q, %v", id, err)
	}
}
