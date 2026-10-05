// Package ref names a chapter wherever it comes from: a library file, a chapter on
// the user's OPDS server, a chapter on MangaDex. The name is one string, because it
// travels in a route of the desktop and in the address of a page image.
package ref

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

const (
	SourceLocal    = "local"
	SourceOPDS     = "opds"
	SourceMangaDex = "mangadex"
)

// ChapterRef is a chapter's address. Key is whatever the source needs to find the
// chapter again: a file id, a server id and entry id, a chapter uuid.
type ChapterRef struct {
	Source string
	Key    string
}

var uuidPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// Parse reads "local:42", "opds:3:<entry id>" or "mangadex:<uuid>". Everything
// else is refused here, so no source ever sees a key it did not make.
func Parse(raw string) (ChapterRef, error) {
	source, key, ok := strings.Cut(raw, ":")
	if !ok || key == "" {
		return ChapterRef{}, fmt.Errorf("chapter reference %q has no source prefix", raw)
	}

	switch source {
	case SourceLocal:
		if _, err := parsePositive(key); err != nil {
			return ChapterRef{}, fmt.Errorf("chapter reference %q: file id %w", raw, err)
		}

	case SourceOPDS:
		server, entry, ok := strings.Cut(key, ":")
		if !ok || entry == "" {
			return ChapterRef{}, fmt.Errorf("chapter reference %q: want opds:<server>:<entry>", raw)
		}
		if _, err := parsePositive(server); err != nil {
			return ChapterRef{}, fmt.Errorf("chapter reference %q: server id %w", raw, err)
		}

	case SourceMangaDex:
		if !uuidPattern.MatchString(key) {
			return ChapterRef{}, fmt.Errorf("chapter reference %q: not a MangaDex chapter id", raw)
		}

	default:
		return ChapterRef{}, fmt.Errorf("chapter reference %q: unknown source %q", raw, source)
	}

	return ChapterRef{Source: source, Key: key}, nil
}

func Local(fileID int64) ChapterRef {
	return ChapterRef{Source: SourceLocal, Key: strconv.FormatInt(fileID, 10)}
}

// FileID is the library file of a local chapter.
func (r ChapterRef) FileID() (int64, bool) {
	if r.Source != SourceLocal {
		return 0, false
	}

	id, err := parsePositive(r.Key)

	return id, err == nil
}

func (r ChapterRef) String() string {
	return r.Source + ":" + r.Key
}

func parsePositive(raw string) (int64, error) {
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 || strconv.FormatInt(id, 10) != raw {
		return 0, fmt.Errorf("%q is not a positive number", raw)
	}

	return id, nil
}
