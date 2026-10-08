package service

import (
	"context"
	"encoding/binary"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/parser"
	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/scanner"
	"github.com/mediaryorg/mediary-node/server/internal/modules/library/internal/store"
	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
	"github.com/mediaryorg/mediary-node/server/internal/platform/db"
	"github.com/mediaryorg/mediary-node/server/internal/platform/events"
)

type harness struct {
	svc    *Service
	hub    *events.Hub
	titles *fakeTitles
	now    time.Time
}

func newHarness(t *testing.T) *harness {
	t.Helper()

	ctx := context.Background()
	dir := t.TempDir()

	database, err := db.Open(ctx, filepath.Join(dir, "node.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	if err := db.Migrate(ctx, database, zerolog.Nop()); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	h := &harness{hub: events.NewHub(64), now: time.Now().UTC(), titles: &fakeTitles{}}
	h.svc = New(store.New(database), zerolog.Nop(), h.hub, Options{
		Titles: h.titles,
		Now:    func() time.Time { return h.now },
	})

	return h
}

// scan runs a scan and waits for it to finish. The scan outlives the request that
// starts it, so a test that only called StartScan would assert against an empty
// library.
func (h *harness) scan(t *testing.T, rootID int64) ScanStatus {
	t.Helper()

	stream, unsubscribe := h.hub.Subscribe(events.TopicLibraryScan)
	defer unsubscribe()

	if _, err := h.svc.StartScan(context.Background(), rootID); err != nil {
		t.Fatalf("start scan: %v", err)
	}

	deadline := time.After(20 * time.Second)

	for {
		select {
		case event := <-stream:
			if event.Payload["phase"] == "finished" {
				return h.svc.ScanState()
			}
		case <-deadline:
			t.Fatal("scan did not finish")
		}
	}
}

func (h *harness) files(t *testing.T) []File {
	t.Helper()

	page, err := h.svc.Files(context.Background(), FileQuery{})
	if err != nil {
		t.Fatalf("list files: %v", err)
	}

	return page.Items
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("create dir for %s: %v", path, err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func (h *harness) addRoot(t *testing.T, path string) *Root {
	t.Helper()

	root, err := h.svc.AddRoot(context.Background(), path, "")
	if err != nil {
		t.Fatalf("add root %s: %v", path, err)
	}

	return root
}

func TestScanRecordsFilesOnce(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	writeFile(t, filepath.Join(root, "Sousou no Frieren", "Season 1", "[SubsPlease] Sousou no Frieren - 01 (1080p).mkv"), "one")
	writeFile(t, filepath.Join(root, "Sousou no Frieren", "Season 1", "[SubsPlease] Sousou no Frieren - 02 (1080p).mkv"), "two")

	added := h.addRoot(t, root)

	status := h.scan(t, 0)
	if status.Found != 2 || status.Added != 2 {
		t.Fatalf("first scan found %d added %d, want 2 and 2", status.Found, status.Added)
	}
	if status.Running {
		t.Error("scan still marked running after the finished event")
	}

	files := h.files(t)
	if len(files) != 2 {
		t.Fatalf("recorded %d files, want 2", len(files))
	}
	if files[0].RootID != added.ID {
		t.Errorf("file root_id = %d, want %d", files[0].RootID, added.ID)
	}
	if files[0].Match != nil {
		t.Error("a freshly scanned file must start unmatched")
	}
	if files[0].Path != filepath.Join(root, "Sousou no Frieren", "Season 1", "[SubsPlease] Sousou no Frieren - 01 (1080p).mkv") {
		t.Errorf("absolute path = %q, want it rebuilt from the root", files[0].Path)
	}

	// An unmatched file still has to be presentable: the title comes off its name,
	// the season off the folder.
	parsed := files[0].Parsed
	if parsed.Title != "Sousou no Frieren" || parsed.Form != string(parser.FormSeries) {
		t.Errorf("parsed = %+v, want the series title read from the name", parsed)
	}
	if parsed.Episode == nil || *parsed.Episode != 1 {
		t.Errorf("parsed episode = %v, want 1", parsed.Episode)
	}
	if parsed.Season == nil || *parsed.Season != 1 {
		t.Errorf("parsed season = %v, want 1 from the folder", parsed.Season)
	}

	// The point of keying on (size, mtime): an unchanged library costs no writes.
	h.now = h.now.Add(time.Hour)

	rescan := h.scan(t, 0)
	if rescan.Added+rescan.Changed+rescan.Reparsed+rescan.Missing != 0 {
		t.Fatalf("rescan of an unchanged library wrote added=%d changed=%d reparsed=%d missing=%d, want none",
			rescan.Added, rescan.Changed, rescan.Reparsed, rescan.Missing)
	}
	if rescan.Found != 2 {
		t.Errorf("rescan found %d files, want 2", rescan.Found)
	}
}

func TestManualMatchSurvivesRescan(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	path := filepath.Join(root, "Show - 01.mkv")
	writeFile(t, path, "one")

	h.addRoot(t, root)
	h.scan(t, 0)

	file := h.files(t)[0]

	season, episode := 1, 1
	matched, err := h.svc.SetMatch(context.Background(), file.ID, "anilist:154587", &season, &episode)
	if err != nil {
		t.Fatalf("set match: %v", err)
	}
	if matched.Match == nil || matched.Match.Source != "manual" || matched.Match.Confidence != 1 {
		t.Fatalf("match after set = %+v, want a manual match with full confidence", matched.Match)
	}

	// Rewriting the file makes the scan update the row: the match still has to
	// stay, because the user decided it and a scan never overrules that.
	h.now = h.now.Add(time.Hour)
	writeFile(t, path, "one plus more bytes")

	status := h.scan(t, 0)
	if status.Changed != 1 {
		t.Fatalf("scan reported %d changed files, want 1", status.Changed)
	}

	after := h.files(t)[0]
	if after.Match == nil {
		t.Fatal("the manual match is gone after a rescan")
	}
	if after.Match.MediaRef != "anilist:154587" || after.Match.Source != "manual" {
		t.Errorf("match after rescan = %+v, want the manual one untouched", after.Match)
	}
	if after.Match.Season == nil || *after.Match.Season != 1 {
		t.Errorf("season after rescan = %v, want 1", after.Match.Season)
	}
}

func TestScanMarksFilesMissingWithoutForgettingThem(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	path := filepath.Join(root, "Show - 01.mkv")
	writeFile(t, path, "one")
	writeFile(t, filepath.Join(root, "Show - 02.mkv"), "two")

	h.addRoot(t, root)
	h.scan(t, 0)

	file := h.files(t)[0]
	if _, err := h.svc.SetMatch(context.Background(), file.ID, "anilist:1", nil, nil); err != nil {
		t.Fatalf("set match: %v", err)
	}

	if err := os.Remove(path); err != nil {
		t.Fatalf("remove file: %v", err)
	}

	h.now = h.now.Add(time.Hour)

	status := h.scan(t, 0)
	if status.Missing != 1 || status.Found != 1 {
		t.Fatalf("scan reported missing=%d found=%d, want 1 and 1", status.Missing, status.Found)
	}

	files := h.files(t)
	if len(files) != 2 {
		t.Fatalf("recorded %d files, want the missing one kept", len(files))
	}
	if !files[0].Missing {
		t.Error("the removed file is not marked missing")
	}
	if files[0].Match == nil {
		t.Error("the match of a missing file was dropped — an unplugged drive would cost the user their corrections")
	}

	// Same file back in place: the row is reused rather than duplicated.
	writeFile(t, path, "one")
	h.now = h.now.Add(time.Hour)

	back := h.scan(t, 0)
	if back.Missing != 0 {
		t.Errorf("scan after restoring the file reported missing=%d, want 0", back.Missing)
	}

	files = h.files(t)
	if len(files) != 2 {
		t.Fatalf("recorded %d files after the file returned, want 2", len(files))
	}
	if files[0].Missing {
		t.Error("the restored file is still marked missing")
	}
}

func TestScanSkipsARootItCannotRead(t *testing.T) {
	h := newHarness(t)
	root := filepath.Join(t.TempDir(), "library")

	writeFile(t, filepath.Join(root, "Show - 01.mkv"), "one")

	h.addRoot(t, root)
	h.scan(t, 0)

	if err := os.RemoveAll(root); err != nil {
		t.Fatalf("remove root: %v", err)
	}

	h.now = h.now.Add(time.Hour)

	status := h.scan(t, 0)
	if len(status.Roots) != 1 || status.Roots[0].Error == "" {
		t.Fatalf("scan of an unreadable root = %+v, want the failure reported", status.Roots)
	}
	if status.Missing != 0 {
		t.Errorf("scan marked %d files missing, want 0: a root that cannot be read says nothing about its files", status.Missing)
	}

	files := h.files(t)
	if len(files) != 1 || files[0].Missing {
		t.Errorf("files after an unreadable root = %+v, want the previous state kept", files)
	}
}

func TestAddRootRejectsOverlappingFolders(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()
	nested := filepath.Join(root, "Anime")

	if err := os.MkdirAll(nested, 0o755); err != nil {
		t.Fatalf("create nested dir: %v", err)
	}

	h.addRoot(t, root)

	for _, path := range []string{root, nested} {
		_, err := h.svc.AddRoot(context.Background(), path, "")
		if apperr.KindOf(err) != apperr.KindConflict {
			t.Errorf("adding %s again returned %v, want a conflict", path, err)
		}
	}

	_, err := h.svc.AddRoot(context.Background(), filepath.Join(root, "missing"), "")
	if apperr.KindOf(err) != apperr.KindInvalid {
		t.Errorf("adding a folder that does not exist returned %v, want invalid", err)
	}
}

func TestDeleteRootForgetsItsFilesAndMatches(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "Show - 01.mkv"), "one")

	added := h.addRoot(t, root)
	h.scan(t, 0)

	file := h.files(t)[0]
	if _, err := h.svc.SetMatch(context.Background(), file.ID, "anilist:1", nil, nil); err != nil {
		t.Fatalf("set match: %v", err)
	}

	if err := h.svc.DeleteRoot(context.Background(), added.ID); err != nil {
		t.Fatalf("delete root: %v", err)
	}

	if files := h.files(t); len(files) != 0 {
		t.Errorf("files after the root was removed = %+v, want none", files)
	}

	// The match hangs off the file row, so the cascade has to reach it too.
	if err := h.svc.DeleteMatch(context.Background(), file.ID); apperr.KindOf(err) != apperr.KindNotFound {
		t.Errorf("the match of a deleted file is still reachable: %v", err)
	}

	if err := h.svc.DeleteRoot(context.Background(), added.ID); apperr.KindOf(err) != apperr.KindNotFound {
		t.Errorf("deleting the root twice returned %v, want not found", err)
	}
}

func TestScanNeedsARoot(t *testing.T) {
	h := newHarness(t)

	_, err := h.svc.StartScan(context.Background(), 0)
	if apperr.KindOf(err) != apperr.KindPrecondition {
		t.Errorf("scanning without a root returned %v, want a precondition failure", err)
	}

	_, err = h.svc.StartScan(context.Background(), 404)
	if apperr.KindOf(err) != apperr.KindNotFound {
		t.Errorf("scanning an unknown root returned %v, want not found", err)
	}
}

func TestSetMatchChecksItsInput(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "Show - 01.mkv"), "one")

	h.addRoot(t, root)
	h.scan(t, 0)

	file := h.files(t)[0]

	if _, err := h.svc.SetMatch(context.Background(), file.ID, "154587", nil, nil); apperr.KindOf(err) != apperr.KindInvalid {
		t.Errorf("a media reference without a provider returned %v, want invalid", err)
	}

	if _, err := h.svc.SetMatch(context.Background(), 404, "anilist:1", nil, nil); apperr.KindOf(err) != apperr.KindNotFound {
		t.Errorf("matching a file that does not exist returned %v, want not found", err)
	}

	if _, err := h.svc.SetMatch(context.Background(), file.ID, "anilist:1", nil, nil); err != nil {
		t.Fatalf("set match: %v", err)
	}
	if err := h.svc.DeleteMatch(context.Background(), file.ID); err != nil {
		t.Fatalf("delete match: %v", err)
	}
	if h.files(t)[0].Match != nil {
		t.Error("the match is still there after being deleted")
	}
}

func TestDiffFilesClassifiesEveryChange(t *testing.T) {
	mtime := time.Unix(1_700_000_000, 0).UTC()

	known := []store.FileState{
		{ID: 1, RelPath: "same.mkv", Kind: "video", Size: 10, Mtime: mtime, ParserVersion: parser.Version},
		{ID: 2, RelPath: "resized.mkv", Kind: "video", Size: 10, Mtime: mtime, ParserVersion: parser.Version},
		{ID: 3, RelPath: "touched.mkv", Kind: "video", Size: 10, Mtime: mtime, ParserVersion: parser.Version},
		{ID: 4, RelPath: "gone.mkv", Kind: "video", Size: 10, Mtime: mtime, ParserVersion: parser.Version},
		{ID: 5, RelPath: "back.mkv", Kind: "video", Size: 10, Mtime: mtime, Missing: true, ParserVersion: parser.Version},
		{ID: 6, RelPath: "still-gone.mkv", Kind: "video", Size: 10, Mtime: mtime, Missing: true, ParserVersion: parser.Version},
	}

	found := []scanner.File{
		{RelPath: "same.mkv", Kind: scanner.KindVideo, Size: 10, ModTime: mtime},
		{RelPath: "resized.mkv", Kind: scanner.KindVideo, Size: 11, ModTime: mtime},
		{RelPath: "touched.mkv", Kind: scanner.KindVideo, Size: 10, ModTime: mtime.Add(time.Second)},
		{RelPath: "back.mkv", Kind: scanner.KindVideo, Size: 10, ModTime: mtime},
		{RelPath: "new.mkv", Kind: scanner.KindVideo, Size: 5, ModTime: mtime},
	}

	changes := diffFiles(known, found)

	if len(changes.Added) != 1 || changes.Added[0].RelPath != "new.mkv" {
		t.Errorf("added = %+v, want only new.mkv", changes.Added)
	}

	changedIDs := []int64{}
	for _, file := range changes.Changed {
		changedIDs = append(changedIDs, file.ID)
	}
	if len(changedIDs) != 2 {
		t.Errorf("changed = %v, want the resized and the touched file", changedIDs)
	}

	if len(changes.Returned) != 1 || changes.Returned[0] != 5 {
		t.Errorf("returned = %v, want the file that came back", changes.Returned)
	}

	// Already-missing files are not marked again, so the timestamp keeps saying
	// when the file actually disappeared.
	if len(changes.Missing) != 1 || changes.Missing[0] != 4 {
		t.Errorf("missing = %v, want only the file that disappeared this scan", changes.Missing)
	}
}

func TestDiffFilesNoticesAKindChange(t *testing.T) {
	mtime := time.Unix(1_700_000_000, 0).UTC()

	known := []store.FileState{
		{ID: 1, RelPath: "book.pdf", Kind: "video", Size: 10, Mtime: mtime, ParserVersion: parser.Version},
	}
	found := []scanner.File{{RelPath: "book.pdf", Kind: scanner.KindBook, Size: 10, ModTime: mtime}}

	changes := diffFiles(known, found)
	if len(changes.Changed) != 1 || changes.Changed[0].Kind != string(scanner.KindBook) {
		t.Errorf("changed = %+v, want the row rewritten with the new kind", changes.Changed)
	}
}

func TestDiffFilesOfAnUnchangedLibraryIsEmpty(t *testing.T) {
	mtime := time.Unix(1_700_000_000, 0).UTC()

	known := []store.FileState{
		{ID: 1, RelPath: "a.mkv", Kind: "video", Size: 10, Mtime: mtime, ParserVersion: parser.Version},
	}
	found := []scanner.File{{RelPath: "a.mkv", Kind: scanner.KindVideo, Size: 10, ModTime: mtime}}

	if !diffFiles(known, found).Empty() {
		t.Error("an unchanged library produced changes")
	}
}

// An improved parser has to reach the files already recorded, and it must do so
// without re-reading them: only the parsed columns are rewritten.
func TestDiffFilesReparsesRowsLeftByAnOlderParser(t *testing.T) {
	mtime := time.Unix(1_700_000_000, 0).UTC()

	known := []store.FileState{
		{ID: 7, RelPath: "Frieren - 01.mkv", Kind: "video", Size: 10, Mtime: mtime, ParserVersion: parser.Version - 1},
	}
	found := []scanner.File{{RelPath: "Frieren - 01.mkv", Kind: scanner.KindVideo, Size: 10, ModTime: mtime}}

	changes := diffFiles(known, found)

	if len(changes.Changed) != 0 || len(changes.Added) != 0 {
		t.Errorf("a file that did not move was rewritten: added=%+v changed=%+v", changes.Added, changes.Changed)
	}
	if len(changes.Reparsed) != 1 || changes.Reparsed[0].ID != 7 {
		t.Fatalf("reparsed = %+v, want the stale row", changes.Reparsed)
	}
	if changes.Reparsed[0].Parsed.Title != "Frieren" || changes.Reparsed[0].Parsed.Version != parser.Version {
		t.Errorf("reparsed row = %+v, want the current parser's reading", changes.Reparsed[0].Parsed)
	}
}

// The page the library shows needs three numbers the page itself cannot work
// out: it holds at most one page of files, and the tabs above it count the whole
// library.
func TestFilesCountsTheWholeLibraryNotThePage(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	writeFile(t, filepath.Join(root, "Frieren", "Frieren - 01.mkv"), "one")
	writeFile(t, filepath.Join(root, "Frieren", "Frieren - 02.mkv"), "two")
	writeFile(t, filepath.Join(root, "Frieren", "Frieren NCOP1.mkv"), "opening")

	h.addRoot(t, root)
	h.scan(t, 0)

	page, err := h.svc.Files(context.Background(), FileQuery{Limit: 1})
	if err != nil {
		t.Fatalf("list files: %v", err)
	}

	if len(page.Items) != 1 {
		t.Fatalf("page holds %d files, want the 1 that was asked for", len(page.Items))
	}
	if page.Counts.Total != 3 {
		t.Errorf("counts.total = %d, want every file in the library", page.Counts.Total)
	}

	// The opening belongs to no title by design, so counting it as waiting for one
	// would leave a number the user can never bring down to zero.
	if page.Counts.Unmatched != 2 {
		t.Errorf("counts.unmatched = %d, want the two episodes without the opening", page.Counts.Unmatched)
	}
	if page.Counts.Missing != 0 {
		t.Errorf("counts.missing = %d, want none", page.Counts.Missing)
	}
}

func TestFilesCountsFilesTheScanNoLongerFinds(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	path := filepath.Join(root, "Frieren", "Frieren - 01.mkv")
	writeFile(t, path, "one")

	h.addRoot(t, root)
	h.scan(t, 0)

	if err := os.Remove(path); err != nil {
		t.Fatalf("remove file: %v", err)
	}

	h.scan(t, 0)

	page, err := h.svc.Files(context.Background(), FileQuery{})
	if err != nil {
		t.Fatalf("list files: %v", err)
	}

	if page.Counts.Missing != 1 {
		t.Errorf("counts.missing = %d, want the file that went away", page.Counts.Missing)
	}
}

func TestFilesNamesTheTitlesItsMatchedFilesBelongTo(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	writeFile(t, filepath.Join(root, "Frieren", "Frieren - 01.mkv"), "one")
	writeFile(t, filepath.Join(root, "Frieren", "Frieren - 02.mkv"), "two")

	h.addRoot(t, root)
	h.scan(t, 0)

	cover := "https://img/frieren.jpg"
	h.titles.described = []TitleDescription{
		{MediaRef: "anilist:154587", MediaType: "anime", Title: "Sousou no Frieren", CoverImage: &cover},
	}

	for _, file := range h.files(t) {
		if _, err := h.svc.SetMatch(context.Background(), file.ID, "anilist:154587", nil, nil); err != nil {
			t.Fatalf("match file %d: %v", file.ID, err)
		}
	}

	page, err := h.svc.Files(context.Background(), FileQuery{})
	if err != nil {
		t.Fatalf("list files: %v", err)
	}

	// Two files, one title: a list of episodes must not become a request, or a
	// row, per episode.
	if len(page.Titles) != 1 {
		t.Fatalf("page carries %d titles, want the one both files share", len(page.Titles))
	}
	if page.Titles[0].Title != "Sousou no Frieren" || page.Titles[0].CoverImage == nil {
		t.Errorf("title = %+v, want the name and poster the node already holds", page.Titles[0])
	}
}

// A source that cannot answer costs the list its posters, never its files.
func TestFilesStillListWhenTheTitlesCannotBeNamed(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	writeFile(t, filepath.Join(root, "Frieren", "Frieren - 01.mkv"), "one")

	h.addRoot(t, root)
	h.scan(t, 0)

	file := h.files(t)[0]
	if _, err := h.svc.SetMatch(context.Background(), file.ID, "anilist:154587", nil, nil); err != nil {
		t.Fatalf("match file: %v", err)
	}

	h.titles.describeErr = errors.New("anilist mirror unreadable")

	page, err := h.svc.Files(context.Background(), FileQuery{})
	if err != nil {
		t.Fatalf("list files: %v", err)
	}

	if len(page.Items) != 1 {
		t.Fatalf("page holds %d files, want the one that was scanned", len(page.Items))
	}
	if len(page.Titles) != 0 {
		t.Errorf("page carries %d titles, want none it could not read", len(page.Titles))
	}
}

// mp4 is the smallest container the prober reads, so it is what the scan is
// tested against: ftyp, then a movie header saying 1437 units at 1000 a second.
func mp4(seconds uint32) string {
	mvhd := make([]byte, 20)
	binary.BigEndian.PutUint32(mvhd[12:16], 1000)
	binary.BigEndian.PutUint32(mvhd[16:20], seconds*1000)

	box := func(kind string, body []byte) []byte {
		head := make([]byte, 8, 8+len(body))
		binary.BigEndian.PutUint32(head[:4], uint32(len(body)+8))
		copy(head[4:8], kind)

		return append(head, body...)
	}

	return string(append(box("ftyp", []byte("isom")), box("moov", box("mvhd", mvhd))...))
}

func TestScanReadsHowLongVideoFilesRun(t *testing.T) {
	h := newHarness(t)
	root := t.TempDir()

	writeFile(t, filepath.Join(root, "Frieren", "Frieren - 01.mp4"), mp4(1437))

	// A container the prober does not read is not a failure, it is a file with no
	// duration — and it must not be reopened on every later scan either.
	writeFile(t, filepath.Join(root, "Frieren", "Frieren - 02.avi"), "not really an avi")

	h.addRoot(t, root)

	status := h.scan(t, 0)
	if status.Probed != 2 {
		t.Errorf("scan probed %d files, want both video files looked at once", status.Probed)
	}

	files := h.files(t)
	if len(files) != 2 {
		t.Fatalf("recorded %d files, want 2", len(files))
	}

	if files[0].DurationSeconds == nil || *files[0].DurationSeconds != 1437 {
		t.Errorf("duration = %v, want the 1437 seconds the header says", files[0].DurationSeconds)
	}
	if files[1].DurationSeconds != nil {
		t.Errorf("duration = %v, want nothing for a container the node cannot read", files[1].DurationSeconds)
	}

	h.now = h.now.Add(time.Hour)

	rescan := h.scan(t, 0)
	if rescan.Probed != 0 {
		t.Errorf("rescan probed %d files, want none reopened for an unchanged library", rescan.Probed)
	}
}
