package service

import (
	"bytes"
	"context"
	"database/sql"
	"image/color"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/backup"
)

func manualSnapshot(t *testing.T, h *detailsHarness) backup.Document {
	t.Helper()

	tx, err := h.db.BeginTx(t.Context(), &sql.TxOptions{ReadOnly: true})
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback() }()

	var doc backup.Document
	if err := h.svc.ManualBackupPart().Snapshot(t.Context(), tx, &doc); err != nil {
		t.Fatal(err)
	}

	return doc
}

// manualRestore runs the part's restore and either commits or rolls back, as
// the sync module would after the other parts succeeded or failed.
func manualRestore(ctx context.Context, t *testing.T, h *detailsHarness, doc backup.Document, commit bool) error {
	t.Helper()

	tx, err := h.db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}

	finish, err := h.svc.ManualBackupPart().Restore(ctx, tx, &doc)
	if err != nil {
		_ = tx.Rollback()
		return err
	}

	committed := false
	if commit {
		if commitErr := tx.Commit(); commitErr != nil {
			t.Fatal(commitErr)
		}
		committed = true
	} else {
		_ = tx.Rollback()
	}

	finish(committed)

	return nil
}

func postersIn(t *testing.T, dir string) []string {
	t.Helper()

	entries, err := os.ReadDir(dir)
	if err != nil && !os.IsNotExist(err) {
		t.Fatal(err)
	}

	var names []string
	for _, e := range entries {
		names = append(names, e.Name())
	}

	return names
}

// A manual title and its poster go into the backup and come back on another
// node: the title the user described exists nowhere else.
func TestAManualTitleAndItsPosterReachAnotherNode(t *testing.T) {
	home := newDetailsHarness(t)
	withCovers(t, home)
	ctx := context.Background()

	created, err := home.svc.CreateManual(ctx, ManualDraft{MediaType: "anime", Title: "Our Club's Short Film"})
	if err != nil {
		t.Fatal(err)
	}
	id := idOf(t, created)

	if _, err = home.svc.SetManualCover(ctx, id, CoverSource{Data: pngOf(t, 600, 900, color.RGBA{G: 180, A: 255})}); err != nil {
		t.Fatal(err)
	}

	doc := manualSnapshot(t, home)
	if len(doc.ManualTitles) != 1 || doc.ManualTitles[0].ID != id || !bytes.HasPrefix(doc.ManualTitles[0].Cover, jpegMagic) {
		t.Fatalf("the snapshot does not carry the title and its poster: %+v", doc.ManualTitles)
	}

	laptop := newDetailsHarness(t)
	laptopDir := withCovers(t, laptop)

	if restoreErr := manualRestore(ctx, t, laptop, doc, true); restoreErr != nil {
		t.Fatal(restoreErr)
	}

	restored, err := laptop.svc.ManualTitles(ctx, "anime")
	if err != nil || len(restored) != 1 || restored[0].Title.UserPreferred == nil ||
		*restored[0].Title.UserPreferred != "Our Club's Short Film" || restored[0].CoverImage == nil {
		t.Fatalf("restored titles %+v, %v", restored, err)
	}

	path, err := laptop.svc.ManualCoverPath(ctx, id)
	if err != nil {
		t.Fatal(err)
	}

	onDisk, err := os.ReadFile(path)
	if err != nil || !bytes.Equal(onDisk, doc.ManualTitles[0].Cover) {
		t.Fatalf("the restored poster differs from the backed-up one: %v", err)
	}

	if posters := postersIn(t, laptopDir); len(posters) != 1 {
		t.Fatalf("posters on the restored node: %v, want just the one", posters)
	}
}

// After a committed restore the posters of the titles it replaced are gone;
// after a rolled-back one, the new posters are, and the old ones are intact.
func TestARestoreKeepsOnlyThePostersOfTheSideThatWon(t *testing.T) {
	ctx := context.Background()

	source := newDetailsHarness(t)
	withCovers(t, source)

	other, err := source.svc.CreateManual(ctx, ManualDraft{MediaType: "movie", Title: "Backed Up"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = source.svc.SetManualCover(ctx, idOf(t, other), CoverSource{Data: pngOf(t, 300, 450, color.RGBA{B: 200, A: 255})}); err != nil {
		t.Fatal(err)
	}
	doc := manualSnapshot(t, source)

	for _, commit := range []bool{false, true} {
		h := newDetailsHarness(t)
		dir := withCovers(t, h)

		current, err := h.svc.CreateManual(ctx, ManualDraft{MediaType: "movie", Title: "Already Here"})
		if err != nil {
			t.Fatal(err)
		}
		if _, err = h.svc.SetManualCover(ctx, idOf(t, current), CoverSource{Data: pngOf(t, 300, 450, color.RGBA{R: 200, A: 255})}); err != nil {
			t.Fatal(err)
		}
		before := postersIn(t, dir)

		if err := manualRestore(ctx, t, h, doc, commit); err != nil {
			t.Fatal(err)
		}

		after := postersIn(t, dir)
		if len(after) != 1 {
			t.Fatalf("commit=%v: posters %v, want exactly one", commit, after)
		}

		kept := slices.Equal(after, before)
		if commit == kept {
			t.Errorf("commit=%v: posters before %v, after %v", commit, before, after)
		}
	}
}

// The document came over the network and its ids become file names: one that
// is not an id refuses the restore and leaves no file behind.
func TestARestoreRefusesAMalformedID(t *testing.T) {
	h := newDetailsHarness(t)
	dir := withCovers(t, h)

	doc := backup.Document{ManualTitles: []backup.ManualTitle{
		{ID: "0123456789abcdef0123", MediaType: "movie", Details: `{}`, Cover: append(slices.Clone(jpegMagic), 0xE0)},
		{ID: "../../evil", MediaType: "movie", Details: `{}`, Cover: append(slices.Clone(jpegMagic), 0xE0)},
	}}

	if err := manualRestore(context.Background(), t, h, doc, true); err == nil {
		t.Fatal("a malformed id was restored")
	}

	if posters := postersIn(t, dir); len(posters) != 0 {
		t.Errorf("a refused restore left posters behind: %v", posters)
	}

	if _, err := os.Stat(filepath.Join(dir, "..", "..", "evil")); !os.IsNotExist(err) {
		t.Error("a file was written outside the posters folder")
	}
}

// A poster that is not a JPEG the node would have saved is dropped; the title
// is still restored.
func TestARestoreDropsAPosterThatIsNotAJPEG(t *testing.T) {
	h := newDetailsHarness(t)
	dir := withCovers(t, h)
	ctx := context.Background()

	doc := backup.Document{ManualTitles: []backup.ManualTitle{{
		ID: "0123456789abcdef0123", MediaType: "movie", Details: `{"title":"Kept"}`,
		CreatedAt: 1, UpdatedAt: 1, Cover: []byte("<svg onload=alert(1)>"),
	}}}

	if err := manualRestore(ctx, t, h, doc, true); err != nil {
		t.Fatal(err)
	}

	if posters := postersIn(t, dir); len(posters) != 0 {
		t.Errorf("a poster that is not a JPEG was written: %v", posters)
	}

	if restored := manualSnapshot(t, h); len(restored.ManualTitles) != 1 || restored.ManualTitles[0].Cover != nil {
		t.Errorf("restored %+v, want the title without a poster", restored.ManualTitles)
	}
}
