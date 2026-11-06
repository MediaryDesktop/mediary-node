// Package backup is the backup format: what of the node's state travels to
// another device, and how it is encoded.
//
// The format is a contract between node versions, not between the node and the
// cloud — the cloud stores the bytes without reading them. A newer node reads
// every older FormatVersion; an older node refuses a newer one rather than
// restoring part of it.
//
// Only the user's own data and the references it hangs on are here: never
// names, posters or any other field from an external source, and nothing tied
// to this machine — library paths, downloads, client addresses, tokens. A
// manual title is the user's own, poster included: no source holds it, so
// leaving it out would lose it. Anime and manga lists are absent because they
// live in the AniList account.
//
// Each section belongs to the module whose tables it comes from. That module
// reads it into a Document and writes it back, as a Part; the sync module only
// runs the parts in one transaction and moves the encoded bytes.
package backup

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
)

// FormatVersion 1: the local tracker, local lists and list icons.
// FormatVersion 2: manual titles with their posters. A version 1 document is
// read as one with no manual titles. Settings join in a later version.
//
// Raise it whenever a node of the previous version could not restore what this
// one writes — a new section, or a value its tables would refuse — so that node
// says it needs updating instead of failing halfway.
const FormatVersion = 2

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
	ManualTitles    []ManualTitle    `json:"manual_titles,omitempty"`
}

// Empty says whether the document holds none of the user's data — what a new
// computer's node looks like before its first restore.
func (d *Document) Empty() bool {
	return len(d.TrackerEntries) == 0 && len(d.CustomLists) == 0 && len(d.ManualTitles) == 0
}

// ManualTitle is a title the user described by hand. Details is the module's
// own JSON, kept as it is. Cover is the poster itself, as JPEG — encoded as
// base64 in the document.
type ManualTitle struct {
	ID           string `json:"id"`
	MediaType    string `json:"media_type"`
	Details      string `json:"details"`
	CreatedAt    int64  `json:"created_at"`
	UpdatedAt    int64  `json:"updated_at"`
	CoverColor   string `json:"cover_color,omitempty"`
	CoverVersion int64  `json:"cover_version,omitempty"`
	Cover        []byte `json:"cover,omitempty"`
}

// Part is one module's share of a backup. Snapshot adds the module's data to
// doc; Restore replaces the module's data with doc's. Both run inside the
// transaction tx, the same one for every part, so a restore that fails in one
// module leaves every module as it was.
//
// What a part keeps outside the database — a poster file — cannot be rolled
// back with tx. Restore writes such files under fresh names before it returns,
// and finish, called once tx has been committed or rolled back, removes
// whichever set is no longer needed: the old files after a commit, the new ones
// after a rollback.
type Part interface {
	Snapshot(ctx context.Context, tx *sql.Tx, doc *Document) error
	Restore(ctx context.Context, tx *sql.Tx, doc *Document) (finish func(committed bool), err error)
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
