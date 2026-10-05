package download

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"mime"
	"os"
	"strings"
	"time"
)

// comicInfo is the ComicInfo.xml most comic readers understand, so the file
// describes itself outside Mediary too.
type comicInfo struct {
	XMLName   xml.Name `xml:"ComicInfo"`
	Series    string   `xml:"Series,omitempty"`
	Number    string   `xml:"Number,omitempty"`
	Title     string   `xml:"Title,omitempty"`
	PageCount int      `xml:"PageCount,omitempty"`
	Notes     string   `xml:"Notes,omitempty"`
}

// PageFetcher returns one page of the chapter being written.
type PageFetcher func(ctx context.Context, index int) (data []byte, contentType string, err error)

const pageAttempts = 3

// retryPause grows with each attempt; a variable so tests need not wait for it.
var retryPause = time.Second

// writePages builds a CBZ at path from the chapter's pages, in order, calling
// progress after each. A page that fails three times fails the whole chapter: a
// chapter with a hole in it is worse than one that says it needs another try.
func writePages(ctx context.Context, path string, info comicInfo, pages int, fetch PageFetcher, progress func(done int)) error {
	out, err := os.Create(path) //nolint:gosec // the node builds the path inside a library folder
	if err != nil {
		return fmt.Errorf("create %s: %w", path, err)
	}

	archive := zip.NewWriter(out)

	writeErr := func() error {
		if err := writeComicInfo(archive, info); err != nil {
			return err
		}

		for i := range pages {
			data, contentType, err := fetchPage(ctx, fetch, i)
			if err != nil {
				return fmt.Errorf("page %d: %w", i+1, err)
			}

			// Pages are already compressed images; storing them is faster and no larger.
			entry, err := archive.CreateHeader(&zip.FileHeader{
				Name:     fmt.Sprintf("%04d%s", i+1, extension(contentType, data)),
				Method:   zip.Store,
				Modified: time.Now(),
			})
			if err != nil {
				return err
			}
			if _, err := entry.Write(data); err != nil {
				return err
			}

			progress(i + 1)
		}

		return archive.Close()
	}()

	closeErr := out.Close()
	if writeErr != nil {
		return writeErr
	}

	return closeErr
}

func fetchPage(ctx context.Context, fetch PageFetcher, index int) (data []byte, contentType string, err error) {
	for attempt := range pageAttempts {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return nil, "", ctx.Err()
			case <-time.After(retryPause * time.Duration(attempt)):
			}
		}

		data, contentType, err = fetch(ctx, index)
		if err == nil {
			return data, contentType, nil
		}
		if ctx.Err() != nil {
			return nil, "", ctx.Err()
		}
	}

	return nil, "", err
}

func writeComicInfo(archive *zip.Writer, info comicInfo) error {
	data, err := xml.MarshalIndent(info, "", "  ")
	if err != nil {
		return err
	}

	entry, err := archive.Create("ComicInfo.xml")
	if err != nil {
		return err
	}

	_, err = entry.Write(append([]byte(xml.Header), data...))

	return err
}

// copyArchive keeps the server's own archive as it is, after checking it is one:
// a login page saved as a .cbz would sit in the library as a broken chapter.
func copyArchive(path string, body io.Reader, limit int64) error {
	out, err := os.Create(path) //nolint:gosec // the node builds the path inside a library folder
	if err != nil {
		return fmt.Errorf("create %s: %w", path, err)
	}

	written, copyErr := io.Copy(out, io.LimitReader(body, limit+1))
	closeErr := out.Close()

	switch {
	case copyErr != nil:
		return copyErr
	case closeErr != nil:
		return closeErr
	case written > limit:
		return fmt.Errorf("the archive is larger than %d bytes", limit)
	}

	reader, err := zip.OpenReader(path)
	if err != nil {
		return fmt.Errorf("the server did not send a comic archive: %w", err)
	}

	return reader.Close()
}

func extension(contentType string, data []byte) string {
	if contentType == "" || !strings.HasPrefix(contentType, "image/") {
		contentType = httpDetect(data)
	}

	switch strings.Split(contentType, ";")[0] {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	case "image/avif":
		return ".avif"
	}

	if exts, err := mime.ExtensionsByType(contentType); err == nil && len(exts) > 0 {
		return exts[0]
	}

	return ".jpg"
}

func httpDetect(data []byte) string {
	switch {
	case bytes.HasPrefix(data, []byte{0xff, 0xd8, 0xff}):
		return "image/jpeg"
	case bytes.HasPrefix(data, []byte("\x89PNG")):
		return "image/png"
	case len(data) > 12 && bytes.Equal(data[:4], []byte("RIFF")) && bytes.Equal(data[8:12], []byte("WEBP")):
		return "image/webp"
	case bytes.HasPrefix(data, []byte("GIF8")):
		return "image/gif"
	}

	return ""
}
