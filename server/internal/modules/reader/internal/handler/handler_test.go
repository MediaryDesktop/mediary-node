package handler

import (
	"archive/zip"
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/danielgtaylor/huma/v2/humatest"

	"github.com/mediaryorg/mediary-node/server/internal/modules/reader/internal/service"
)

type library struct {
	file *service.PlayableFile
}

func (l library) Playable(_ context.Context, id int64) (*service.PlayableFile, error) {
	if l.file == nil || l.file.ID != id {
		return nil, nil
	}

	return l.file, nil
}

func cbz(t *testing.T, pages int) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), "ch.cbz")
	out, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}

	writer := zip.NewWriter(out)
	for i := range pages {
		entry, err := writer.Create(filepath.ToSlash(filepath.Join("p", string(rune('a'+i))+".png")))
		if err != nil {
			t.Fatal(err)
		}
		if _, err := entry.Write([]byte{0x89, 'P', 'N', 'G'}); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	if err := out.Close(); err != nil {
		t.Fatal(err)
	}

	return path
}

func newAPI(t *testing.T) humatest.TestAPI {
	t.Helper()

	chapter := 3
	svc := service.New(service.Options{Library: library{file: &service.PlayableFile{
		ID: 4, Path: cbz(t, 2), Title: "Ch 3", MediaRef: "anilist:1", Chapter: &chapter,
	}}})

	_, api := humatest.New(t)
	New(svc).Register(api)

	return api
}

func TestChapterByRefMatchesChapterByFile(t *testing.T) {
	api := newAPI(t)

	for _, path := range []string{
		"/v1/reader/chapters/local:4",
		"/v1/reader/chapters/local%3A4",
		"/v1/reader/files/4/chapter",
	} {
		resp := api.Get(path)
		if resp.Code != http.StatusOK {
			t.Fatalf("GET %s = %d: %s", path, resp.Code, resp.Body.String())
		}

		var body struct {
			Chapter ChapterBody `json:"chapter"`
		}
		if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}

		got := body.Chapter
		if got.Ref != "local:4" || got.FileID != 4 || got.Number != "3" || len(got.Pages) != 2 {
			t.Errorf("GET %s = %+v", path, got)
		}
	}
}

func TestPageByRef(t *testing.T) {
	api := newAPI(t)

	resp := api.Get("/v1/reader/chapters/local:4/pages/1")
	if resp.Code != http.StatusOK || !strings.HasPrefix(resp.Body.String(), "\x89PNG") {
		t.Errorf("page = %d %q", resp.Code, resp.Body.String())
	}
}

func TestABadRefIsRefused(t *testing.T) {
	api := newAPI(t)

	for path, want := range map[string]int{
		"/v1/reader/chapters/42":           http.StatusUnprocessableEntity,
		"/v1/reader/chapters/comick:1":     http.StatusUnprocessableEntity,
		"/v1/reader/chapters/opds:1:entry": http.StatusPreconditionRequired,
		"/v1/reader/chapters/local:99":     http.StatusNotFound,
	} {
		if resp := api.Get(path); resp.Code != want {
			t.Errorf("GET %s = %d, want %d: %s", path, resp.Code, want, resp.Body.String())
		}
	}
}
