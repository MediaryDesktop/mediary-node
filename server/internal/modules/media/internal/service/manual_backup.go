package service

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/media/internal/store"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/backup"
)

// jpegMagic opens every JPEG file; the node saves posters only as JPEG.
var jpegMagic = []byte{0xFF, 0xD8, 0xFF}

// ManualBackupPart is the manual titles' share of a backup, posters included:
// a title the user described by hand exists nowhere else, so a backup without
// it would lose it for good.
func (s *Service) ManualBackupPart() backup.Part {
	return manualBackup{s: s}
}

type manualBackup struct {
	s *Service
}

var _ backup.Part = manualBackup{}

func (m manualBackup) Snapshot(ctx context.Context, tx *sql.Tx, doc *backup.Document) error {
	titles, err := store.SnapshotManualTitles(ctx, tx)
	if err != nil {
		return err
	}

	doc.ManualTitles = make([]backup.ManualTitle, 0, len(titles))

	for i := range titles {
		t := &titles[i]

		doc.ManualTitles = append(doc.ManualTitles, backup.ManualTitle{
			ID:           t.ID,
			MediaType:    t.MediaType,
			Details:      string(t.Details),
			CreatedAt:    t.CreatedAt.UnixMilli(),
			UpdatedAt:    t.UpdatedAt.UnixMilli(),
			CoverColor:   t.Cover.Color,
			CoverVersion: t.Cover.Version,
			Cover:        m.readCover(t.ID, t.Cover.File),
		})
	}

	return nil
}

// readCover is the poster's bytes, or nil when there is none to read. A file
// gone from disk loses only the poster: the title itself is still backed up.
func (m manualBackup) readCover(id, file string) []byte {
	if file == "" || m.s.opts.CoverDir == "" {
		return nil
	}

	data, err := os.ReadFile(filepath.Join(m.s.opts.CoverDir, filepath.Base(file)))
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			m.s.logger.Warn().Err(err).Str("id", id).Msg("read a manual poster for the backup")
		}

		return nil
	}

	return data
}

// Restore replaces the manual titles with the document's. The posters are
// written first, under fresh names, so the current ones stay untouched until
// the transaction commits; finish then removes whichever set lost.
//
// The document came from the network. Its ids name files on this disk, so a
// malformed one refuses the restore outright; a poster that is not a JPEG of a
// sane size is dropped and the title kept without it.
func (m manualBackup) Restore(ctx context.Context, tx *sql.Tx, doc *backup.Document) (func(bool), error) {
	current, err := store.SnapshotManualTitles(ctx, tx)
	if err != nil {
		return nil, err
	}

	var previous []string
	for i := range current {
		if file := current[i].Cover.File; file != "" {
			previous = append(previous, file)
		}
	}

	var written []string
	removeWritten := func() {
		for _, file := range written {
			m.s.removeCoverFile(file)
		}
	}

	titles := make([]store.ManualTitle, 0, len(doc.ManualTitles))

	for i := range doc.ManualTitles {
		t := &doc.ManualTitles[i]

		if !manualID.MatchString(t.ID) {
			removeWritten()
			return nil, fmt.Errorf("manual title id %q is malformed", t.ID)
		}

		cover := store.ManualCover{Color: t.CoverColor, Version: t.CoverVersion}

		if data := m.usableCover(t); data != nil {
			file, writeErr := m.s.writeCoverFile(t.ID, data)
			if writeErr != nil {
				removeWritten()
				return nil, fmt.Errorf("write the poster of %s: %w", t.ID, writeErr)
			}

			written = append(written, file)
			cover.File = file
		}

		titles = append(titles, store.ManualTitleAt(t.ID, t.MediaType, []byte(t.Details), t.CreatedAt, t.UpdatedAt, cover))
	}

	if err := store.ReplaceManualTitles(ctx, tx, titles); err != nil {
		removeWritten()
		return nil, err
	}

	return func(committed bool) {
		if !committed {
			removeWritten()
			return
		}

		for _, file := range previous {
			m.s.removeCoverFile(file)
		}
	}, nil
}

// usableCover is the poster to write, or nil: none in the document, posters
// turned off on this node, or bytes that are not a JPEG the node would have
// saved itself.
func (m manualBackup) usableCover(t *backup.ManualTitle) []byte {
	if len(t.Cover) == 0 || m.s.opts.CoverDir == "" {
		return nil
	}

	if len(t.Cover) > maxCoverBytes || !bytes.HasPrefix(t.Cover, jpegMagic) {
		m.s.logger.Warn().Str("id", t.ID).Int("bytes", len(t.Cover)).Msg("dropped a backed-up poster that is not a JPEG of a usable size")
		return nil
	}

	return t.Cover
}
