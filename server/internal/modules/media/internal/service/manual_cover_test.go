package service

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/safehttp"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/sources/imagesearch"
)

func pngOf(t *testing.T, width, height int, fill color.Color) []byte {
	t.Helper()

	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := range height {
		for x := range width {
			img.Set(x, y, fill)
		}
	}

	var encoded bytes.Buffer
	if err := png.Encode(&encoded, img); err != nil {
		t.Fatalf("encode png: %v", err)
	}

	return encoded.Bytes()
}

func withCovers(t *testing.T, h *detailsHarness) string {
	t.Helper()

	dir := filepath.Join(t.TempDir(), "manual-covers")
	h.svc.opts.CoverDir = dir
	h.svc.opts.Fetch = safehttp.NewClient(5 * time.Second)
	h.svc.opts.CoverURL = func(id string, version int64) string {
		return fmt.Sprintf("http://node/v1/media/manual/%s/cover?v=%d", id, version)
	}

	return dir
}

func idOf(t *testing.T, details *MediaDetails) string {
	t.Helper()

	return strings.TrimPrefix(details.MediaRef, "manual:")
}

func TestAPosterIsTheNodesOwnScaledCopy(t *testing.T) {
	h := newDetailsHarness(t)
	dir := withCovers(t, h)
	ctx := context.Background()

	created, err := h.svc.CreateManual(ctx, ManualDraft{MediaType: "movie", Title: "Home Video"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	id := idOf(t, created)

	if created.CoverImage != nil {
		t.Fatal("a new title has no poster")
	}

	withPoster, err := h.svc.SetManualCover(ctx, id, CoverSource{Data: pngOf(t, 1200, 1800, color.RGBA{R: 200, G: 20, B: 20, A: 255})})
	if err != nil {
		t.Fatalf("set cover: %v", err)
	}

	if withPoster.CoverImage == nil || !strings.HasSuffix(*withPoster.CoverImage, "?v=1") {
		t.Fatalf("the poster's address carries its version, got %v", withPoster.CoverImage)
	}
	if withPoster.CoverColor == nil || !strings.HasPrefix(*withPoster.CoverColor, "#c") {
		t.Fatalf("the colour behind it is the poster's own, got %v", withPoster.CoverColor)
	}

	path, err := h.svc.ManualCoverPath(ctx, id)
	if err != nil {
		t.Fatalf("cover path: %v", err)
	}

	stored, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read poster: %v", err)
	}

	config, format, err := image.DecodeConfig(bytes.NewReader(stored))
	if err != nil || format != "jpeg" || config.Width != coverWidth || config.Height != 900 {
		t.Fatalf("stored as a %d-wide JPEG keeping its shape, got %s %dx%d %v", coverWidth, format, config.Width, config.Height, err)
	}

	replaced, err := h.svc.SetManualCover(ctx, id, CoverSource{Data: pngOf(t, 300, 450, color.White)})
	if err != nil {
		t.Fatalf("replace cover: %v", err)
	}
	if !strings.HasSuffix(*replaced.CoverImage, "?v=2") {
		t.Fatalf("a new poster gets a new address, got %s", *replaced.CoverImage)
	}

	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatal("the old poster file is removed once replaced")
	}

	if err := h.svc.DeleteManual(ctx, id); err != nil {
		t.Fatalf("delete: %v", err)
	}

	left, _ := os.ReadDir(dir)
	if len(left) != 0 {
		t.Fatalf("deleting the title deletes its poster, left %d files", len(left))
	}
}

func TestOnlyAPictureBecomesAPoster(t *testing.T) {
	h := newDetailsHarness(t)
	withCovers(t, h)
	ctx := context.Background()

	created, _ := h.svc.CreateManual(ctx, ManualDraft{MediaType: "anime", Title: "x"})
	id := idOf(t, created)

	for name, source := range map[string]CoverSource{
		"not a picture": {Data: []byte("<html>hello</html>")},
		"too small":     {Data: pngOf(t, 10, 10, color.Black)},
		"nothing":       {},
		"both":          {Data: pngOf(t, 100, 150, color.Black), URL: "https://example.com/a.jpg"},
		"the node":      {URL: "http://127.0.0.1:43711/v1/tracker/entries"},
		"a file":        {URL: "file:///etc/passwd"},
	} {
		if _, err := h.svc.SetManualCover(ctx, id, source); apperr.KindOf(err) != apperr.KindInvalid {
			t.Errorf("%s: want invalid, got %v", name, err)
		}
	}

	if _, err := h.svc.SetManualCover(ctx, "0123456789abcdef0123", CoverSource{Data: pngOf(t, 100, 150, color.Black)}); apperr.KindOf(err) != apperr.KindNotFound {
		t.Fatalf("only an existing manual title has a poster, got %v", err)
	}
}

func TestCandidatesAreSearchedForAndPosterShaped(t *testing.T) {
	h := newDetailsHarness(t)
	withCovers(t, h)
	ctx := context.Background()

	var query string

	commons := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		query = r.URL.Query().Get("gsrsearch")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"query":{"pages":{
			"1":{"index":2,"imageinfo":[{"url":"https://upload/wide.jpg","thumburl":"https://t/wide.jpg","width":1600,"height":900,"mime":"image/jpeg"}]},
			"2":{"index":1,"imageinfo":[{"url":"https://upload/poster.jpg","thumburl":"https://t/poster.jpg","width":600,"height":900,"mime":"image/jpeg","descriptionurl":"https://commons/File:P"}]},
			"3":{"index":3,"imageinfo":[{"url":"https://upload/logo.svg","width":600,"height":900,"mime":"image/svg+xml"}]}
		}}}`))
	}))
	t.Cleanup(commons.Close)

	h.svc.opts.Images = imagesearch.New(imagesearch.Options{
		WikimediaEndpoint: commons.URL,
		Timeout:           5 * time.Second,
	})

	year := 1994
	candidates, err := h.svc.SearchCovers(ctx, CoverSearch{MediaType: "anime", Title: " Rare OVA ", Year: &year})
	if err != nil {
		t.Fatalf("candidates: %v", err)
	}

	if query != "Rare OVA poster" {
		t.Fatalf("searched for %q", query)
	}
	if len(candidates) != 1 || candidates[0].URL != "https://upload/poster.jpg" || candidates[0].Source != "wikimedia" {
		t.Fatalf("only the poster-shaped raster picture is offered, got %+v", candidates)
	}
}
