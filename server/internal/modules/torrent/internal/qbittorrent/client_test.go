package qbittorrent

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

type fakeWebUI struct {
	server *httptest.Server

	mu       sync.Mutex
	apiVer   string
	password string
	// v5 signs in with 204 and refuses with 401; v4 with 200 "Ok." or "Fails.".
	v5Login bool
	// hostCheck answers every call with 401, as qBittorrent does to a Host header
	// it does not expect.
	hostCheck bool
	calls     []string
	forms     []map[string]string
	files     map[string][]byte
}

func newFakeWebUI(t *testing.T, apiVer string) *fakeWebUI {
	t.Helper()

	f := &fakeWebUI{apiVer: apiVer, password: "secret", files: map[string][]byte{}}
	f.server = httptest.NewServer(http.HandlerFunc(f.serve))
	t.Cleanup(f.server.Close)

	return f
}

func (f *fakeWebUI) serve(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()

	endpoint := strings.TrimPrefix(r.URL.Path, "/api/v2/")
	f.calls = append(f.calls, endpoint)

	if f.hostCheck {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte("Unauthorized"))
		return
	}

	if endpoint == "auth/login" {
		_ = r.ParseForm()
		ok := r.PostForm.Get("password") == f.password

		switch {
		case f.v5Login && ok:
			http.SetCookie(w, &http.Cookie{Name: "SID", Value: "s1", Path: "/"})
			w.WriteHeader(http.StatusNoContent)
		case f.v5Login:
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte("Unauthorized"))
		case ok:
			http.SetCookie(w, &http.Cookie{Name: "SID", Value: "s1", Path: "/"})
			_, _ = w.Write([]byte("Ok."))
		default:
			_, _ = w.Write([]byte("Fails."))
		}
		return
	}

	if cookie, err := r.Cookie("SID"); err != nil || cookie.Value != "s1" {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte("Forbidden"))
		return
	}

	switch endpoint {
	case "app/version":
		_, _ = w.Write([]byte("v5.0.2"))
	case "app/webapiVersion":
		_, _ = w.Write([]byte(f.apiVer))
	case "torrents/add":
		_ = r.ParseMultipartForm(1 << 20)
		form := map[string]string{}
		for key, values := range r.MultipartForm.Value {
			form[key] = values[0]
		}
		if headers := r.MultipartForm.File["torrents"]; len(headers) > 0 {
			file, _ := headers[0].Open()
			data, _ := io.ReadAll(file)
			f.files["torrents"] = data
		}
		f.forms = append(f.forms, form)
		_, _ = w.Write([]byte("Ok."))
	case "torrents/info":
		_, _ = w.Write([]byte(`[{"hash":"ABCDEF","name":"Frieren","state":"downloading","progress":0.5,"dlspeed":1000,"num_seeds":4,"eta":60}]`))
	case "torrents/files":
		_, _ = w.Write([]byte(`[{"index":0,"name":"Frieren\\Frieren - 01.mkv","size":10,"progress":1,"priority":1}]`))
	default:
		_ = r.ParseForm()
		form := map[string]string{}
		for key, values := range r.PostForm {
			form[key] = values[0]
		}
		f.forms = append(f.forms, form)
		_, _ = w.Write([]byte("Ok."))
	}
}

func (f *fakeWebUI) called(endpoint string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()

	for _, call := range f.calls {
		if call == endpoint {
			return true
		}
	}

	return false
}

func newClient(t *testing.T, f *fakeWebUI, password string) *Client {
	t.Helper()

	client, err := New(Options{URL: f.server.URL + "/", Username: "admin", Password: password})
	if err != nil {
		t.Fatal(err)
	}

	return client
}

func TestSignsInWhenAskedAndThenReads(t *testing.T) {
	f := newFakeWebUI(t, "2.11.2")
	client := newClient(t, f, "secret")

	version, err := client.Version(context.Background())
	if err != nil || version != "v5.0.2" {
		t.Fatalf("Version = %q, %v", version, err)
	}
	if !f.called("auth/login") {
		t.Fatal("a 403 must lead to a sign-in")
	}

	torrents, err := client.Torrents(context.Background(), []string{"abcdef"})
	if err != nil {
		t.Fatal(err)
	}
	if len(torrents) != 1 || torrents[0].Hash != "abcdef" || torrents[0].Progress != 0.5 || torrents[0].Seeds != 4 {
		t.Fatalf("torrents = %+v", torrents)
	}

	files, err := client.Files(context.Background(), "abcdef")
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 1 || files[0].Name != "Frieren/Frieren - 01.mkv" {
		t.Fatalf("files = %+v, want forward slashes", files)
	}
}

func TestQBittorrent5SignsInWithoutABody(t *testing.T) {
	f := newFakeWebUI(t, "2.15.1")
	f.v5Login = true

	if _, err := newClient(t, f, "secret").Version(context.Background()); err != nil {
		t.Fatalf("a 204 sign-in is a sign-in: %v", err)
	}
}

func TestAWrongPasswordIsAnUpstreamError(t *testing.T) {
	for _, v5 := range []bool{false, true} {
		f := newFakeWebUI(t, "2.11.2")
		f.v5Login = v5

		_, err := newClient(t, f, "wrong").Version(context.Background())
		if apperr.KindOf(err) != apperr.KindUpstream || !strings.Contains(err.Error(), "password") {
			t.Errorf("v5 %v: err = %v, want an upstream error about the password", v5, err)
		}
	}
}

func TestAHostHeaderMismatchSaysWhatToChange(t *testing.T) {
	f := newFakeWebUI(t, "2.15.1")
	f.hostCheck = true

	_, err := newClient(t, f, "secret").Version(context.Background())
	if apperr.KindOf(err) != apperr.KindUpstream || !strings.Contains(err.Error(), "Host header") {
		t.Fatalf("err = %v, want the Host header explained", err)
	}
}

func TestAnUnreachableClientIsUnavailable(t *testing.T) {
	f := newFakeWebUI(t, "2.11.2")
	client := newClient(t, f, "secret")
	f.server.Close()

	if _, err := client.Version(context.Background()); apperr.KindOf(err) != apperr.KindUnavailable {
		t.Fatalf("err = %v, want unavailable", err)
	}
}

func TestAddSendsTheFolderAndKeepsAutomaticManagementOff(t *testing.T) {
	f := newFakeWebUI(t, "2.11.2")
	client := newClient(t, f, "secret")

	err := client.Add(context.Background(), AddRequest{
		Magnet:   "magnet:?xt=urn:btih:abc",
		SavePath: "/downloads/Frieren",
		Category: "mediary",
		Tags:     []string{"mediary"},
	})
	if err != nil {
		t.Fatal(err)
	}

	if !f.called("torrents/createCategory") {
		t.Fatal("the category must be created before it is used")
	}

	add := f.forms[len(f.forms)-1]
	if add["urls"] != "magnet:?xt=urn:btih:abc" || add["savepath"] != "/downloads/Frieren" || add["autoTMM"] != "false" || add["category"] != "mediary" {
		t.Fatalf("add form = %v", add)
	}

	if err := client.Add(context.Background(), AddRequest{Torrent: []byte("d4:infod4:name1:aee"), SavePath: "/d"}); err != nil {
		t.Fatal(err)
	}
	if string(f.files["torrents"]) != "d4:infod4:name1:aee" {
		t.Fatalf("the .torrent file must be uploaded, got %q", f.files["torrents"])
	}
}

func TestPauseFollowsTheAPIVersion(t *testing.T) {
	for ver, want := range map[string]string{"2.9.3": "torrents/pause", "2.11.0": "torrents/stop"} {
		f := newFakeWebUI(t, ver)
		client := newClient(t, f, "secret")

		if err := client.Pause(context.Background(), "abc"); err != nil {
			t.Fatal(err)
		}
		if !f.called(want) {
			t.Errorf("API %s: want %s, calls %v", ver, want, f.calls)
		}
	}
}

func TestOnlyHTTPAddressesAreAccepted(t *testing.T) {
	for _, raw := range []string{"", "localhost:8080", "ftp://host"} {
		if _, err := New(Options{URL: raw}); apperr.KindOf(err) != apperr.KindInvalid {
			t.Errorf("New(%q) = %v, want invalid", raw, err)
		}
	}
}

func TestHoldStopsATorrentFileAndAMagnetAtItsMetadata(t *testing.T) {
	for ver, want := range map[string]string{"2.9.3": "paused", "2.11.0": "stopped"} {
		f := newFakeWebUI(t, ver)
		client := newClient(t, f, "secret")

		if err := client.Add(context.Background(), AddRequest{Torrent: []byte("d4:infod4:name1:aee"), SavePath: "/d", Hold: true}); err != nil {
			t.Fatal(err)
		}
		if form := f.forms[len(f.forms)-1]; form[want] != "true" {
			t.Errorf("API %s: add form = %v, want %s", ver, form, want)
		}
	}

	f := newFakeWebUI(t, "2.11.0")
	if err := newClient(t, f, "secret").Add(context.Background(), AddRequest{Magnet: "magnet:?xt=urn:btih:abc", SavePath: "/d", Hold: true}); err != nil {
		t.Fatal(err)
	}
	if form := f.forms[len(f.forms)-1]; form["stopCondition"] != "MetadataReceived" || form["stopped"] != "" {
		t.Errorf("magnet add form = %v", form)
	}
}

func TestSetFilePrioritySendsTheIndices(t *testing.T) {
	f := newFakeWebUI(t, "2.11.0")

	if err := newClient(t, f, "secret").SetFilePriority(context.Background(), "abc", []int{0, 3, 4}, PrioritySkip); err != nil {
		t.Fatal(err)
	}

	form := f.forms[len(f.forms)-1]
	if form["hash"] != "abc" || form["id"] != "0|3|4" || form["priority"] != "0" {
		t.Fatalf("filePrio form = %v", form)
	}
}
