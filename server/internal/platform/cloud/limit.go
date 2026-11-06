package cloud

import (
	"errors"
	"io"
	"net/http"
)

// maxResponseBytes bounds any one answer from the cloud. The generated client
// reads every body whole into memory, and the largest legitimate one is a
// backup snapshot, which the cloud caps at 50 MB; this leaves room above that.
// A variable so a test can lower it.
var maxResponseBytes int64 = 64 << 20

// ErrResponseTooLarge is an answer that went on past maxResponseBytes — a
// misbehaving cloud or a proxy in between, never a real backup.
var ErrResponseTooLarge = errors.New("the cloud's answer is larger than any it sends")

// limitedTransport hands back bodies that refuse to be read past the limit. It
// fails rather than truncating: a truncated snapshot or JSON document would
// only fail later, further from the cause.
type limitedTransport struct {
	next http.RoundTripper
}

func (t limitedTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	resp, err := t.next.RoundTrip(req)
	if err != nil {
		return nil, err
	}

	resp.Body = &limitedBody{body: resp.Body, left: maxResponseBytes}

	return resp, nil
}

type limitedBody struct {
	body io.ReadCloser
	left int64
}

func (b *limitedBody) Read(p []byte) (int, error) {
	if b.left <= 0 {
		// At the limit: anything more is too much, an end is fine.
		var probe [1]byte

		n, err := b.body.Read(probe[:])
		if n > 0 {
			return 0, ErrResponseTooLarge
		}

		return 0, err
	}

	if int64(len(p)) > b.left {
		p = p[:b.left]
	}

	n, err := b.body.Read(p)
	b.left -= int64(n)

	return n, err
}

func (b *limitedBody) Close() error {
	return b.body.Close()
}
