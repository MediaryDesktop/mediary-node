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
// live in the AniList account — but where the user is in their episodes and
// chapters is not, since AniList keeps one number per title, so that state is
// here for every title alike.
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
// read as one with no manual titles.
// FormatVersion 3: where the user is in each episode, chapter and book. An older
// document is read as one with none. Settings join in a later version.
//
// Raise it whenever a node of the previous version could not restore what this
// one writes — a new section, or a value its tables would refuse — so that node
// says it needs updating instead of failing halfway.
const FormatVersion = 3

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
	WatchStates     []WatchState     `json:"watch_states,omitempty"`
	ChapterStates   []ChapterState   `json:"chapter_states,omitempty"`
	BookStates      []BookState      `json:"book_states,omitempty"`
}

// Empty says whether the document holds none of the user's data — what a new
// computer's node looks like before its first restore.
func (d *Document) Empty() bool {
	return len(d.TrackerEntries) == 0 && len(d.CustomLists) == 0 && len(d.ManualTitles) == 0 &&
		len(d.WatchStates) == 0 && len(d.ChapterStates) == 0 && len(d.BookStates) == 0
}

// WatchState is where the user is in one episode or film. It names the episode
// by its title and number, or the file by its content key — never by anything
// of this computer's, so it finds its file again on another. Times are Unix
// milliseconds.
type WatchState struct {
	MediaRef   string `json:"media_ref,omitempty"`
	Episode    *int64 `json:"episode,omitempty"`
	ContentKey string `json:"content_key,omitempty"`

	Position      float64 `json:"position"`
	Duration      float64 `json:"duration"`
	Watched       bool    `json:"watched"`
	WatchCount    int64   `json:"watch_count"`
	PassCounted   bool    `json:"pass_counted"`
	LastWatchedAt *int64  `json:"last_watched_at,omitempty"`
	UpdatedAt     int64   `json:"updated_at"`
}

// ChapterState is where the user is in one chapter: by title and chapter
// number, or by a source reference that means the same on every computer.
type ChapterState struct {
	MediaRef  string `json:"media_ref,omitempty"`
	Chapter   string `json:"chapter,omitempty"`
	SourceRef string `json:"source_ref,omitempty"`

	Page      int64  `json:"page"`
	Pages     int64  `json:"pages"`
	Read      bool   `json:"read"`
	ReadAt    *int64 `json:"read_at,omitempty"`
	UpdatedAt int64  `json:"updated_at"`
}

// BookState is where the reader left one book file, by what the file holds.
type BookState struct {
	ContentKey string  `json:"content_key"`
	MediaRef   string  `json:"media_ref,omitempty"`
	Locator    string  `json:"locator"`
	Fraction   float64 `json:"fraction"`
	UpdatedAt  int64   `json:"updated_at"`
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
