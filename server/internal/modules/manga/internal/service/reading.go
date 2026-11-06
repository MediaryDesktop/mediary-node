package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"strings"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

// chapterKey is everything the node needs to open an OPDS chapter again, carried
// in the chapter's reference rather than kept somewhere: an OPDS catalogue has no
// way to fetch one entry by its id, and the reference has to keep working after
// a restart. The node writes it when it lists chapters and checks it on the way
// back in; every path in it is still fetched only from the server's own host.
type chapterKey struct {
	Series   string `json:"s"`
	Template string `json:"p"`
	Pages    int    `json:"n"`
	Title    string `json:"t,omitempty"`
	Number   string `json:"c,omitempty"`
	// Archive is the book's own CBZ on the server, for a download to keep as it is.
	Archive string `json:"a,omitempty"`
}

// The largest page count a chapter may claim, the same as a local archive.
const maxChapterPages = 5000

func encodeKey(key chapterKey) (string, error) {
	data, err := json.Marshal(key)
	if err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(data), nil
}

func decodeKey(raw string) (chapterKey, error) {
	invalid := apperr.Invalid("ref", "not a chapter reference this node wrote")

	data, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return chapterKey{}, invalid
	}

	var key chapterKey
	if err := json.Unmarshal(data, &key); err != nil {
		return chapterKey{}, invalid
	}

	if !strings.HasPrefix(key.Series, "/") || !strings.HasPrefix(key.Template, "/") ||
		!strings.Contains(key.Template, "{pageNumber}") || key.Pages <= 0 || key.Pages > maxChapterPages ||
		(key.Archive != "" && !strings.HasPrefix(key.Archive, "/")) {
		return chapterKey{}, invalid
	}

	return key, nil
}

// ReadChapter is an OPDS chapter as the reader needs it.
type ReadChapter struct {
	Title    string
	MediaRef string
	// SourceName and Groups are the credit the reader shows.
	SourceName string
	Groups     []string
	Number     string
	Pages      int
}

// Chapter describes a chapter on a server. Its title is whichever title is linked
// to the chapter's series now, so progress goes where the user last pointed it.
func (s *Service) Chapter(ctx context.Context, serverID int64, rawKey string) (*ReadChapter, error) {
	key, err := decodeKey(rawKey)
	if err != nil {
		return nil, err
	}

	row, err := s.store.Server(ctx, serverID)
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, apperr.New(apperr.KindNotFound, "OPDS server %d does not exist", serverID)
	}

	chapter := &ReadChapter{Title: key.Title, Number: key.Number, Pages: key.Pages, SourceName: row.Name}

	link, err := s.store.LinkBySeries(ctx, sourceID(serverID), key.Series)
	if err != nil {
		return nil, err
	}
	if link != nil {
		chapter.MediaRef = link.MediaRef
		if link.SeriesTitle != "" {
			chapter.Title = link.SeriesTitle
		}
	}

	return chapter, nil
}

// Page fetches one page of a chapter from its server.
func (s *Service) Page(ctx context.Context, serverID int64, rawKey string, index int) (data []byte, contentType string, err error) {
	key, err := decodeKey(rawKey)
	if err != nil {
		return nil, "", err
	}
	if index < 0 || index >= key.Pages {
		return nil, "", apperr.New(apperr.KindNotFound, "the chapter has no page %d", index)
	}

	row, server, err := s.connection(ctx, serverID)
	if err != nil {
		return nil, "", err
	}

	data, contentType, err = s.opts.Client.Page(ctx, server, key.Template, index)
	if err != nil {
		return nil, "", upstream(err, row.Name)
	}

	return data, contentType, nil
}
