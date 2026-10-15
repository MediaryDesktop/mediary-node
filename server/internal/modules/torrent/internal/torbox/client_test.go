package torbox

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

func serve(t *testing.T, handler http.HandlerFunc) *Client {
	t.Helper()

	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	return New(Options{BaseURL: server.URL, Key: StaticKey("secret-key"), UserAgent: "test"})
}

func reply(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "error": nil, "detail": "ok", "data": data})
}

func TestMeSendsTheKeyAndReadsThePlan(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/user/me" {
			t.Errorf("path = %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer secret-key" {
			t.Errorf("Authorization = %q", got)
		}
		reply(w, map[string]any{"email": "a@b.c", "plan": 0})
	})

	account, err := NewProvider(client).Account(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if account != "TorBox · Free plan" {
		t.Errorf("account = %q", account)
	}
}

func TestRejectedKeySaysSo(t *testing.T) {
	// Both shapes TorBox answers with: a missing key, and a wrong one.
	for _, answer := range []struct {
		status int
		body   string
	}{
		{http.StatusForbidden, `{"detail":"Not authenticated"}`},
		{http.StatusForbidden, `{"success":false,"error":"AUTH_ERROR","detail":"An error occurred while verifying your token. Please try again.","data":null}`},
		{http.StatusOK, `{"success":false,"error":"AUTH_ERROR","detail":"An error occurred while verifying your token.","data":null}`},
	} {
		client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(answer.status)
			_, _ = w.Write([]byte(answer.body))
		})

		_, err := client.Me(context.Background())
		if err == nil || !strings.Contains(err.Error(), "API key") {
			t.Errorf("%d %s: err = %v, want one about the key", answer.status, answer.body, err)
		}
	}
}

func TestUnsuccessfulAnswerIsAnErrorEvenWithOK(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"success":false,"error":"DOWNLOAD_LIMIT","detail":"You have reached your monthly download limit.","data":null}`))
	})

	_, err := client.Create(context.Background(), "magnet:?xt=urn:btih:abc", nil, "")
	if err == nil || !strings.Contains(err.Error(), "monthly download limit") {
		t.Fatalf("err = %v, want TorBox's detail", err)
	}
	if apperr.KindOf(err) != apperr.KindUpstream {
		t.Errorf("kind = %s", apperr.KindOf(err))
	}
}

func TestNoKeyIsAPrecondition(t *testing.T) {
	client := New(Options{BaseURL: "http://127.0.0.1:1", Key: StaticKey("")})

	_, err := client.Torrents(context.Background())
	if apperr.KindOf(err) != apperr.KindPrecondition {
		t.Fatalf("err = %v, want a precondition", err)
	}
}

func TestCreateSendsTheMagnetAsAForm(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/torrents/createtorrent" {
			t.Errorf("%s %s", r.Method, r.URL.Path)
		}
		if err := r.ParseMultipartForm(1 << 20); err != nil {
			t.Fatal(err)
		}
		if got := r.FormValue("magnet"); got != "magnet:?xt=urn:btih:abc" {
			t.Errorf("magnet = %q", got)
		}
		if got := r.FormValue("name"); got != "Show" {
			t.Errorf("name = %q", got)
		}
		reply(w, map[string]any{"queued_id": 9, "hash": "abc"})
	})

	created, err := client.Create(context.Background(), "magnet:?xt=urn:btih:abc", nil, "Show")
	if err != nil {
		t.Fatal(err)
	}
	if created.QueuedID != 9 || created.TorrentID != 0 {
		t.Errorf("created = %+v, want a queued torrent", created)
	}
}

func TestRemotesJoinTorrentsAndQueue(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/torrents/mylist":
			if r.URL.Query().Get("bypass_cache") != "true" {
				t.Errorf("mylist without bypass_cache")
			}
			reply(w, []map[string]any{{
				"id": 5, "hash": "aaa", "name": "Show", "download_present": true, "progress": 1,
				"files": []map[string]any{{"id": 0, "name": "Show/01.mkv", "size": 100}},
			}})
		case "/queued/getqueued":
			reply(w, []map[string]any{{"id": 7, "hash": "bbb", "name": "Other"}})
		default:
			t.Errorf("unexpected %s", r.URL.Path)
		}
	})

	remotes, err := NewProvider(client).Remotes(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(remotes) != 2 {
		t.Fatalf("remotes = %+v", remotes)
	}
	if r := remotes[0]; r.ID != "5" || !r.Ready || r.Queued || len(r.Files) != 1 || r.Files[0].Path != "Show/01.mkv" {
		t.Errorf("torrent = %+v", r)
	}
	if r := remotes[1]; r.ID != "7" || !r.Queued || r.Ready {
		t.Errorf("queued = %+v", r)
	}
}

func TestCachedAsksInBatchesAndReadsTheList(t *testing.T) {
	var batches []string
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if r.URL.Path != "/torrents/checkcached" || q.Get("format") != "list" {
			t.Errorf("%s %s", r.URL.Path, r.URL.RawQuery)
		}
		batches = append(batches, q.Get("hash"))
		reply(w, []map[string]any{{"hash": "H5", "name": "held"}})
	})

	hashes := make([]string, 150)
	for i := range hashes {
		hashes[i] = "h" + strconv.Itoa(i)
	}

	cached, err := client.Cached(context.Background(), hashes)
	if err != nil {
		t.Fatal(err)
	}
	if len(batches) != 2 || strings.Count(batches[0], ",") != 99 || strings.Count(batches[1], ",") != 49 {
		t.Errorf("batches = %d, want 100 then 50 hashes", len(batches))
	}
	if !cached["h5"] || cached["h6"] {
		t.Errorf("cached = %v", cached)
	}
}

func TestLinkPassesTheKeyAsToken(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("token") != "secret-key" || q.Get("torrent_id") != "5" || q.Get("file_id") != "3" {
			t.Errorf("query = %s", r.URL.RawQuery)
		}
		reply(w, "https://cdn.example/file?token=x")
	})

	link, err := client.Link(context.Background(), 5, 3)
	if err != nil {
		t.Fatal(err)
	}
	if link != "https://cdn.example/file?token=x" {
		t.Errorf("link = %q", link)
	}
}

func TestDeleteQueuedUsesTheQueueEndpoint(t *testing.T) {
	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/queued/controlqueued" {
			t.Errorf("path = %s", r.URL.Path)
		}
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body["queued_id"] != float64(7) || body["operation"] != "delete" {
			t.Errorf("body = %v", body)
		}
		reply(w, nil)
	})

	if err := client.Delete(context.Background(), 7, true); err != nil {
		t.Fatal(err)
	}
}
