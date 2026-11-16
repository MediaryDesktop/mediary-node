package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

// contentChunk is how much of each end of a file the key reads. Two mebibytes
// in all is quick even off a network drive, and a video, an archive or a book
// that differs anywhere near its ends — a different encode, another release,
// another edition — gets another key.
const contentChunk = 1 << 20

// ContentKey names what a file holds rather than where it is: "<size>:<hash>",
// the same for the same file on any computer. It is computed the first time
// something asks and kept until a scan sees the file change. A file the library
// does not have is a not-found error; one missing from disk is a precondition.
func (s *Service) ContentKey(ctx context.Context, fileID int64) (string, error) {
	file, err := s.store.ContentFile(ctx, fileID)
	if err != nil {
		return "", apperr.Wrap(err, apperr.KindInternal, "read library file")
	}
	if file == nil {
		return "", apperr.New(apperr.KindNotFound, "library file %d does not exist", fileID)
	}
	if file.Key != "" {
		return file.Key, nil
	}
	if file.Missing {
		return "", apperr.New(apperr.KindPrecondition, "the last scan did not find library file %d", fileID)
	}

	key, err := computeContentKey(filepath.Join(file.RootPath, filepath.FromSlash(file.RelPath)), file.Size)
	if err != nil {
		return "", apperr.Wrap(err, apperr.KindUnavailable, "read library file %d", fileID)
	}

	if err := s.store.SetContentKey(ctx, fileID, file.Size, key); err != nil {
		return "", apperr.Wrap(err, apperr.KindInternal, "store content key")
	}

	return key, nil
}

// computeContentKey hashes the first and the last contentChunk of the file,
// which for a small file is the whole of it. The size goes into the key as
// well, both as a cheap first difference and so that the two ends of a file
// barely bigger than a chunk are not mistaken for another file's.
func computeContentKey(path string, size int64) (string, error) {
	file, err := os.Open(path) //nolint:gosec // a library file resolved by id, never a path the client chose
	if err != nil {
		return "", err
	}
	defer func() { _ = file.Close() }()

	hash := sha256.New()

	if _, err := io.CopyN(hash, file, min(size, contentChunk)); err != nil {
		return "", fmt.Errorf("read the start: %w", err)
	}

	if size > contentChunk {
		tail := max(size-contentChunk, contentChunk)

		if _, err := file.Seek(tail, io.SeekStart); err != nil {
			return "", fmt.Errorf("seek to the end: %w", err)
		}

		if _, err := io.CopyN(hash, file, size-tail); err != nil {
			return "", fmt.Errorf("read the end: %w", err)
		}
	}

	return fmt.Sprintf("%d:%s", size, hex.EncodeToString(hash.Sum(nil)[:16])), nil
}
