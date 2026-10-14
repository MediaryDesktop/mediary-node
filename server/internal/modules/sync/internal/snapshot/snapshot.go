// Package snapshot is the backup format: what of the node's state travels to
// another device, and how it is encoded.
//
// The format is a contract between node versions, not between the node and the
// cloud — the cloud stores the bytes without reading them. A newer node reads
// every older FormatVersion; an older node refuses a newer one rather than
// restoring part of it.
//
// Only the user's own data and the references it hangs on are here: never
// names, posters or any other field from an external source, and nothing tied
// to this machine — library paths, downloads, client addresses, tokens.
// Anime and manga lists are absent because they live in the AniList account.
package snapshot

import (
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
)

// FormatVersion 1: the local tracker, local lists and list icons. Settings and
// custom media join in later versions.
const FormatVersion = 1

// maxDecoded bounds what a snapshot may expand to, so a hostile or corrupt body
// cannot exhaust memory while being gunzipped.
const maxDecoded = 512 << 20

var ErrNewerFormat = errors.New("snapshot was written by a newer version of Mediary")

type Document struct {
	FormatVersion   int              `json:"format_version"`
	TrackerEntries  []TrackerEntry   `json:"tracker_entries"`
	CustomLists     []CustomList     `json:"custom_lists"`
	CustomListItems []CustomListItem `json:"custom_list_items"`
	ListIcons       []ListIcon       `json:"list_icons"`
}

type TrackerEntry struct {
	MediaRef  string `json:"media_ref"`
	MediaType string `json:"media_type"`
	Status    string `json:"status"`
	Score     int64  `json:"score"`
	Progress  int64  `json:"progress"`
	Repeat    int64  `json:"repeat"`
	Private   bool   `json:"private"`
	Notes     string `json:"notes"`

	StartedYear    *int64 `json:"started_year,omitempty"`
	StartedMonth   *int64 `json:"started_month,omitempty"`
	StartedDay     *int64 `json:"started_day,omitempty"`
	CompletedYear  *int64 `json:"completed_year,omitempty"`
	CompletedMonth *int64 `json:"completed_month,omitempty"`
	CompletedDay   *int64 `json:"completed_day,omitempty"`

	CreatedAt int64 `json:"created_at"`
	UpdatedAt int64 `json:"updated_at"`
}

type CustomList struct {
	ID        int64  `json:"id"`
	MediaType string `json:"media_type"`
	Name      string `json:"name"`
	Position  int64  `json:"position"`
	CreatedAt int64  `json:"created_at"`
}

type CustomListItem struct {
	ListID   int64  `json:"list_id"`
	MediaRef string `json:"media_ref"`
	Position int64  `json:"position"`
	AddedAt  int64  `json:"added_at"`
}

type ListIcon struct {
	ListID string `json:"list_id"`
	Icon   string `json:"icon"`
}

// Encoded is a document ready to upload. Encoding the same state twice yields
// the same bytes — the document carries no timestamp of its own and gzip is
// written without a name or time — which is what lets an unchanged state be
// recognised by its hash alone.
type Encoded struct {
	Body   []byte
	Sha256 string
}

func Encode(doc Document) (Encoded, error) {
	doc.FormatVersion = FormatVersion

	payload, err := json.Marshal(doc)
	if err != nil {
		return Encoded{}, fmt.Errorf("encode snapshot: %w", err)
	}

	var buf bytes.Buffer

	writer, err := gzip.NewWriterLevel(&buf, gzip.BestCompression)
	if err != nil {
		return Encoded{}, fmt.Errorf("compress snapshot: %w", err)
	}

	if _, err := writer.Write(payload); err != nil {
		return Encoded{}, fmt.Errorf("compress snapshot: %w", err)
	}

	if err := writer.Close(); err != nil {
		return Encoded{}, fmt.Errorf("compress snapshot: %w", err)
	}

	return Encoded{Body: buf.Bytes(), Sha256: Hash(buf.Bytes())}, nil
}

func Decode(body []byte) (Document, error) {
	reader, err := gzip.NewReader(bytes.NewReader(body))
	if err != nil {
		return Document{}, fmt.Errorf("decompress snapshot: %w", err)
	}
	defer func() { _ = reader.Close() }()

	payload, err := io.ReadAll(io.LimitReader(reader, maxDecoded+1))
	if err != nil {
		return Document{}, fmt.Errorf("decompress snapshot: %w", err)
	}

	if len(payload) > maxDecoded {
		return Document{}, fmt.Errorf("snapshot expands beyond %d bytes", maxDecoded)
	}

	var doc Document
	if err := json.Unmarshal(payload, &doc); err != nil {
		return Document{}, fmt.Errorf("read snapshot: %w", err)
	}

	if doc.FormatVersion > FormatVersion {
		return Document{}, ErrNewerFormat
	}

	if doc.FormatVersion < 1 {
		return Document{}, fmt.Errorf("snapshot has no format version")
	}

	return doc, nil
}

func Hash(body []byte) string {
	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:])
}
