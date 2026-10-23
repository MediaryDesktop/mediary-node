// Package source is what a source of free copies of books looks like to the
// rest of the module: Project Gutenberg's catalogue, an OPDS server the user
// added.
package source

import (
	"context"
	"io"
	"strings"
)

// Source finds copies of a book and hands one over as a file.
type Source interface {
	// ID is the prefix of the source's references: "gutenberg", "opds:2".
	ID() string
	// Name is what the user sees: "Project Gutenberg", the server's own name.
	Name() string
	Search(ctx context.Context, query Query) ([]Edition, error)
	// Open fetches the file at location, which the source itself put in a
	// Format. The caller closes it.
	Open(ctx context.Context, ref, location string) (io.ReadCloser, error)
}

// Query is what to look for: the work's title and authors when the search
// starts on a book's page, or the text the user typed.
type Query struct {
	Text    string
	Title   string
	Authors []string
}

// Edition is one copy of a book in a source.
type Edition struct {
	// Ref is the source's ID and the copy's key in it: "gutenberg:84",
	// "opds:2:urn:uuid:…".
	Ref      string
	Title    string
	Authors  []string
	Language string
	Year     int
	Formats  []Format
	// Source is the source's name for the user.
	Source string
}

// Format is one file a copy comes as.
type Format struct {
	// Type is the media type: application/epub+zip, application/pdf.
	Type string
	// Ext is the extension the file is saved with: ".epub", ".azw3".
	Ext string
	// Size is in bytes, 0 when the source does not say.
	Size int64
	// Location is where the source fetches the file from. It stays on the
	// node: a client names a format by its type, never by an address.
	Location string
}

// SourceOf is the ID of the source a reference belongs to: "gutenberg" for
// "gutenberg:84", "opds:2" for "opds:2:urn:uuid:…". It is "" for a reference
// that has no key after the source.
func SourceOf(ref string) string {
	kind, rest, ok := strings.Cut(ref, ":")
	if !ok || kind == "" || rest == "" {
		return ""
	}

	if kind != "opds" {
		return kind
	}

	server, key, ok := strings.Cut(rest, ":")
	if !ok || server == "" || key == "" {
		return ""
	}

	return kind + ":" + server
}

// Ref joins a source's ID and a copy's key into a reference.
func Ref(sourceID, key string) string {
	return sourceID + ":" + key
}
