package handler

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type readSeekCloser struct {
	io.ReadSeeker
	closed bool
}

func (r *readSeekCloser) Close() error {
	r.closed = true
	return nil
}

// A stream from the node's own client is read as it downloads; the player
// seeks in it with ranges, as in a file on disk.
func TestStreamFromTheBuiltInClientServesRanges(t *testing.T) {
	content := strings.Repeat("0123456789", 100)
	reader := &readSeekCloser{ReadSeeker: strings.NewReader(content)}

	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/v1/playback/files/-1/direct", http.NoBody)
	req.Header.Set("Range", "bytes=990-")
	rec := httptest.NewRecorder()

	writeStream(t.Context(), rec, req, func(context.Context) (io.ReadSeekCloser, error) { return reader, nil },
		"Frieren - 02.mkv", "video/x-matroska")

	if rec.Code != http.StatusPartialContent || rec.Body.String() != content[990:] {
		t.Fatalf("status = %d, body = %q", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("Content-Range"); got != "bytes 990-999/1000" {
		t.Errorf("Content-Range = %q", got)
	}
	if !reader.closed {
		t.Error("the reader was left open")
	}
}
