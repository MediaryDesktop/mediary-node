package premiumize

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

func ok(w http.ResponseWriter, fields map[string]any) {
	fields["status"] = "success"
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(fields)
}

func TestBadKeySaysSo(t *testing.T) {
	// The answer Premiumize gives a wrong key, with HTTP 200.
	client := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"status":"error","message":"Not logged in.","code":"authentication_failed"}`))
	})

	_, err := client.Account(context.Background())
	if err == nil || !strings.Contains(err.Error(), "API key") {
		t.Fatalf("err = %v", err)
	}
}

const hash = "0123456789abcdef0123456789abcdef01234567"

func TestTransferLifecycle(t *testing.T) {
	var created, deleted string

	client := serve(t, func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()

		switch r.URL.Path {
		case "/transfer/create":
			created = r.PostForm.Get("src")
			ok(w, map[string]any{"id": "T1", "name": "Show"})
		case "/transfer/list":
			ok(w, map[string]any{"transfers": []map[string]any{
				{"id": "T1", "name": "Show", "status": "finished", "progress": 1, "folder_id": "F1"},
				{"id": "T2", "name": "Run", "status": "running", "progress": 0.25, "src": "magnet:?xt=urn:btih:" + hash},
				{"id": "T3", "name": "Bad", "status": "error", "message": "No seeds"},
			}})
		case "/folder/list":
			switch r.URL.Query().Get("id") {
			case "F1":
				ok(w, map[string]any{"content": []map[string]any{
					{"id": "a", "name": "02.mkv", "type": "file", "size": 20, "link": "https://pm/2"},
					{"id": "S", "name": "Extras", "type": "folder"},
				}})
			case "S":
				ok(w, map[string]any{"content": []map[string]any{
					{"id": "b", "name": "nc.mkv", "type": "file", "size": 5, "link": "https://pm/nc"},
				}})
			}
		case "/transfer/delete":
			deleted = r.PostForm.Get("id")
			ok(w, map[string]any{})
		case "/cache/check":
			items := r.PostForm["items[]"]
			response := make([]bool, len(items))
			for i, item := range items {
				response[i] = strings.Contains(item, hash)
			}
			ok(w, map[string]any{"response": response})
		default:
			t.Errorf("unexpected %s", r.URL.Path)
		}
	})
	ctx := context.Background()

	// A .torrent goes as the magnet of its hash.
	torrent := []byte("d4:infod6:lengthi1e4:name4:Show12:piece lengthi16384e6:pieces20:aaaaaaaaaaaaaaaaaaaaee")
	id, err := client.Add(ctx, "", torrent, "")
	if err != nil || id != "T1" || !strings.HasPrefix(created, "magnet:?xt=urn:btih:") || !strings.Contains(created, "dn=Show") {
		t.Fatalf("add = %q (src %q), %v", id, created, err)
	}

	remotes, err := client.Remotes(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if r := remotes[0]; !r.Ready || r.Hash != "" || !r.Partial {
		t.Errorf("finished = %+v, want no hash: Premiumize does not say it", r)
	}
	if r := remotes[1]; r.Hash != hash || r.Progress != 0.25 || r.Ready {
		t.Errorf("running = %+v, want the hash read from its magnet", r)
	}
	if r := remotes[2]; r.Failed != "Premiumize: No seeds" {
		t.Errorf("error = %+v", r)
	}

	full, err := client.Detail(ctx, remotes[0])
	if err != nil {
		t.Fatal(err)
	}
	var paths []string
	for _, f := range full.Files {
		paths = append(paths, f.Path)
	}
	if strings.Join(paths, ",") != "Show/02.mkv,Show/Extras/nc.mkv" {
		t.Errorf("paths = %v", paths)
	}

	link, err := client.Link(ctx, remotes[0], 1)
	if err != nil || link != "https://pm/nc" {
		t.Errorf("link = %q, %v", link, err)
	}

	cached, err := client.Cached(ctx, []string{hash, "ffff"})
	if err != nil || !cached[hash] || cached["ffff"] {
		t.Errorf("cached = %v, %v", cached, err)
	}

	if err := client.Delete(ctx, remotes[0]); err != nil || deleted != "T1" {
		t.Errorf("delete %q: %v", deleted, err)
	}
}

func TestNamesCannotMakeFolders(t *testing.T) {
	if got := cleanName("a/b\\c"); got != "a_b_c" {
		t.Errorf("cleanName = %q", got)
	}
}
