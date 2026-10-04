// Package archive reads comic pages out of CBZ files, which are plain zip archives.
package archive

import (
	"archive/zip"
	"fmt"
	"io"
	"path"
	"sort"
	"strconv"
	"strings"
)

// A page bigger than this is refused rather than read into memory; a scanned
// page is a few megabytes, and a much larger entry is more likely a corrupt or
// hostile archive than a page.
const MaxPageBytes = 64 << 20

// MaxPages bounds the listing of one archive for the same reason.
const MaxPages = 5000

var imageTypes = map[string]string{
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".png":  "image/png",
	".webp": "image/webp",
	".gif":  "image/gif",
	".avif": "image/avif",
	".bmp":  "image/bmp",
}

type Page struct {
	Index int    `json:"index" doc:"Position in reading order, starting at 0."`
	Name  string `json:"name" doc:"File name inside the archive."`
}

// Pages lists the images of a CBZ archive in reading order.
func Pages(archivePath string) ([]Page, error) {
	archive, err := open(archivePath)
	if err != nil {
		return nil, err
	}
	defer func() { _ = archive.reader.Close() }()

	pages := make([]Page, len(archive.entries))
	for i, entry := range archive.entries {
		pages[i] = Page{Index: i, Name: path.Base(entry.Name)}
	}

	return pages, nil
}

// Image is one page's bytes with the media type it is served as.
type Image struct {
	Data        []byte
	ContentType string
}

// ReadPage returns one page of the archive.
func ReadPage(archivePath string, index int) (Image, error) {
	archive, err := open(archivePath)
	if err != nil {
		return Image{}, err
	}
	defer func() { _ = archive.reader.Close() }()

	entries := archive.entries
	if index < 0 || index >= len(entries) {
		return Image{}, fmt.Errorf("page %d is out of range (archive has %d)", index, len(entries))
	}

	entry := entries[index]
	if entry.UncompressedSize64 > MaxPageBytes {
		return Image{}, fmt.Errorf("page %s is %d bytes, over the %d limit", entry.Name, entry.UncompressedSize64, MaxPageBytes)
	}

	source, err := entry.Open()
	if err != nil {
		return Image{}, fmt.Errorf("open page %s: %w", entry.Name, err)
	}
	defer func() { _ = source.Close() }()

	// The header's size can lie; the read is what bounds memory.
	data, err := io.ReadAll(io.LimitReader(source, MaxPageBytes+1))
	if err != nil {
		return Image{}, fmt.Errorf("read page %s: %w", entry.Name, err)
	}
	if len(data) > MaxPageBytes {
		return Image{}, fmt.Errorf("page %s is over the %d limit", entry.Name, MaxPageBytes)
	}

	return Image{Data: data, ContentType: ContentType(entry.Name)}, nil
}

// ContentType is the media type a page is served as, judged from its name.
func ContentType(name string) string {
	if kind, ok := imageTypes[strings.ToLower(path.Ext(name))]; ok {
		return kind
	}

	return "application/octet-stream"
}

// opened is an archive with its pages already put in reading order.
type opened struct {
	reader  *zip.ReadCloser
	entries []*zip.File
}

func open(archivePath string) (opened, error) {
	reader, err := zip.OpenReader(archivePath)
	if err != nil {
		return opened{}, fmt.Errorf("open archive: %w", err)
	}

	entries := imageEntries(reader.File)
	if len(entries) == 0 {
		_ = reader.Close()

		return opened{}, fmt.Errorf("archive holds no images")
	}
	if len(entries) > MaxPages {
		_ = reader.Close()

		return opened{}, fmt.Errorf("archive holds %d pages, over the %d limit", len(entries), MaxPages)
	}

	return opened{reader: reader, entries: entries}, nil
}

func imageEntries(files []*zip.File) []*zip.File {
	entries := make([]*zip.File, 0, len(files))

	for _, file := range files {
		if file.FileInfo().IsDir() || skipped(file.Name) {
			continue
		}
		if _, ok := imageTypes[strings.ToLower(path.Ext(file.Name))]; !ok {
			continue
		}
		entries = append(entries, file)
	}

	sort.SliceStable(entries, func(i, j int) bool {
		return naturalLess(entries[i].Name, entries[j].Name)
	})

	return entries
}

// skipped drops what archivers add that is not part of the comic: the macOS
// resource forks and dot-files.
func skipped(name string) bool {
	base := path.Base(name)

	return strings.HasPrefix(name, "__MACOSX/") || strings.HasPrefix(base, ".")
}

// naturalLess compares names chunk by chunk, numbers by value, so that page 2
// precedes page 10 and "01" and "1" are the same page number.
func naturalLess(a, b string) bool {
	left, right := chunks(strings.ToLower(a)), chunks(strings.ToLower(b))

	for i := 0; i < len(left) && i < len(right); i++ {
		l, r := left[i], right[i]
		if l == r {
			continue
		}

		ln, lerr := strconv.ParseUint(l, 10, 64)
		rn, rerr := strconv.ParseUint(r, 10, 64)
		if lerr == nil && rerr == nil {
			if ln != rn {
				return ln < rn
			}
			continue
		}

		return l < r
	}

	if len(left) != len(right) {
		return len(left) < len(right)
	}

	return a < b
}

func chunks(s string) []string {
	var out []string

	start := 0
	for i := 1; i <= len(s); i++ {
		if i == len(s) || isDigit(s[i]) != isDigit(s[i-1]) {
			out = append(out, s[start:i])
			start = i
		}
	}

	return out
}

func isDigit(b byte) bool {
	return b >= '0' && b <= '9'
}
