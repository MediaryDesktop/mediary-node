package servers

import (
	"context"
	"errors"
	"io"
	"path"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/text/unicode/norm"

	"github.com/mediaryorg/mediary-node/server/internal/modules/booksource/internal/source"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/sources/opds"
)

const (
	prefix = "opds:"

	maxResults = 20
	// The same rule as the Gutenberg search: a long surname is matched by its
	// start, so a catalogue's "Dostoyevsky" is the work's "Dostoevsky".
	surnameStem = 5
	// The queue's own cap; a server is not trusted to say how large a file is.
	maxFileBytes = 200 << 20
)

// extensions are the book formats the library keeps, by the media types OPDS
// catalogues give them. Calibre-Web, Kavita and Standard Ebooks use these.
var extensions = map[string]string{
	"application/epub+zip":           ".epub",
	"application/pdf":                ".pdf",
	"application/x-mobipocket-ebook": ".mobi",
	"application/x-mobi8-ebook":      ".azw3",
	"application/vnd.amazon.ebook":   ".azw3",
	"application/x-fictionbook+xml":  ".fb2",
	"application/x-fictionbook":      ".fb2",
	"text/fb2+xml":                   ".fb2",
}

// canonical is the one type each format is named by, whatever the server
// called it, so a client always names a format the same way.
var canonical = map[string]string{
	".epub": "application/epub+zip",
	".pdf":  "application/pdf",
	".mobi": "application/x-mobipocket-ebook",
	".azw3": "application/x-mobi8-ebook",
	".fb2":  "application/x-fictionbook+xml",
}

// Sources are the saved servers, each a source. A server the node cannot list
// is left out of this search rather than failing it.
func (s *Servers) Sources(ctx context.Context) []source.Source {
	servers, err := s.List(ctx)
	if err != nil {
		s.logger.Warn().Err(err).Msg("list the book servers")
		return nil
	}

	out := make([]source.Source, 0, len(servers))
	for _, server := range servers {
		out = append(out, &serverSource{servers: s, id: server.ID, name: server.Name})
	}

	return out
}

type serverSource struct {
	servers *Servers
	id      int64
	name    string
}

func (s *serverSource) ID() string   { return prefix + strconv.FormatInt(s.id, 10) }
func (s *serverSource) Name() string { return s.name }

// Search runs the catalogue's own search. A catalogue without one takes no part
// in searches, rather than reporting the same failure every time.
func (s *serverSource) Search(ctx context.Context, query source.Query) ([]source.Edition, error) {
	text := strings.TrimSpace(query.Text)
	if text == "" {
		// Catalogue searches match a phrase, so a subtitle one edition lacks or a
		// surname beside the title would hide the book.
		title, _, _ := strings.Cut(query.Title, ":")
		text = strings.TrimSpace(title)
	}
	if text == "" {
		return []source.Edition{}, nil
	}

	_, server, err := s.servers.connection(ctx, s.id)
	if err != nil {
		return nil, err
	}

	publications, err := s.servers.client.SearchPublications(ctx, server, text)
	if errors.Is(err, opds.ErrNoSearch) {
		return []source.Edition{}, nil
	}
	if err != nil {
		return nil, describe(err, "")
	}

	stems := stemsOf(query.Authors)

	editions := make([]source.Edition, 0, len(publications))
	for i := range publications {
		pub := &publications[i]
		if !byAuthor(pub.Authors, stems) {
			continue
		}

		if edition, ok := s.edition(pub); ok {
			editions = append(editions, edition)
		}
		if len(editions) == maxResults {
			break
		}
	}

	return editions, nil
}

func (s *serverSource) edition(pub *opds.Publication) (source.Edition, bool) {
	var formats []source.Format

	seen := map[string]bool{}
	for _, file := range pub.Files {
		// The file's own name tells best: Standard Ebooks gives its AZW3 the MOBI
		// type. Calibre-Web's paths have no extension, and the type tells.
		ext := strings.ToLower(path.Ext(strings.Split(file.Path, "?")[0]))
		if _, named := canonical[ext]; !named {
			ext = extensions[file.Type]
		}
		kind, ok := canonical[ext]
		if !ok {
			continue
		}

		// Standard Ebooks offers two EPUBs; the first, the compatible one, is the
		// one any reader opens.
		if seen[kind] {
			continue
		}
		seen[kind] = true

		formats = append(formats, source.Format{Type: kind, Ext: ext, Size: file.Length, Location: file.Path})
	}

	key := pub.ID
	if key == "" && len(formats) > 0 {
		key = formats[0].Location
	}
	if key == "" || len(formats) == 0 {
		return source.Edition{}, false
	}

	return source.Edition{
		Ref:      source.Ref(s.ID(), key),
		Title:    pub.Title,
		Authors:  pub.Authors,
		Language: pub.Language,
		Year:     yearOf(pub.Issued),
		Formats:  formats,
		Source:   s.name,
	}, true
}

// Open fetches the file at location, a path the catalogue gave in the search.
// The client sends the server's password only to the server's own host.
func (s *serverSource) Open(ctx context.Context, _, location string) (io.ReadCloser, error) {
	_, server, err := s.servers.connection(ctx, s.id)
	if err != nil {
		return nil, err
	}

	body, _, err := s.servers.client.Open(ctx, server, location, maxFileBytes)
	if err != nil {
		return nil, describe(err, s.name)
	}

	return body, nil
}

// describe says in a sentence what went wrong with a server, named when the
// message is read away from the server's own row. The client's error, with its
// addresses and causes, stays in the log.
func describe(err error, name string) error {
	if errors.Is(err, context.Canceled) {
		return err
	}

	var message string
	switch {
	case errors.Is(err, opds.ErrUnauthorized):
		message = "the server refused the user name or password"
	case errors.Is(err, opds.ErrOtherHost):
		message = "the server sent the file from another address, which Mediary does not follow"
	case errors.Is(err, opds.ErrNotOPDS):
		message = "the server no longer has this file or catalogue"
	default:
		message = "the server could not be reached"
	}

	if name != "" {
		message = name + ": " + message
	}

	return apperr.Wrap(err, apperr.KindUpstream, "%s", message)
}

// byAuthor keeps a publication by one of the work's authors. One that names no
// author is kept: the catalogue matched it by title and has nothing to say.
func byAuthor(authors, stems []string) bool {
	if len(stems) == 0 || len(authors) == 0 {
		return true
	}

	for _, author := range authors {
		for _, word := range wordsOf(author) {
			for _, stem := range stems {
				if word == stem || (utf8.RuneCountInString(stem) == surnameStem && strings.HasPrefix(word, stem)) {
					return true
				}
			}
		}
	}

	return false
}

func stemsOf(authors []string) []string {
	var stems []string

	for _, author := range authors {
		words := wordsOf(author)
		for i := len(words) - 1; i >= 0; i-- {
			if utf8.RuneCountInString(words[i]) <= 2 || words[i] == "jr" || words[i] == "sr" {
				continue
			}

			stem := words[i]
			if utf8.RuneCountInString(stem) > surnameStem {
				stem = string([]rune(stem)[:surnameStem])
			}
			stems = append(stems, stem)

			break
		}
	}

	return stems
}

// wordsOf splits a name into words without their accents, so the work's
// "Bronte" is the catalogue's "Brontë".
func wordsOf(text string) []string {
	var folded strings.Builder
	for _, r := range norm.NFD.String(strings.ToLower(text)) {
		if !unicode.Is(unicode.Mn, r) {
			folded.WriteRune(r)
		}
	}

	return strings.FieldsFunc(folded.String(), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	})
}

// yearOf reads the year from dc:issued: "1818", "2014-05-06".
func yearOf(issued string) int {
	if len(issued) < 4 {
		return 0
	}

	year, err := strconv.Atoi(issued[:4])
	if err != nil || year < 1 {
		return 0
	}

	return year
}
