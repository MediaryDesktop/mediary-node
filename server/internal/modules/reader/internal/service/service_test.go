package service

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/MediaryDesktop/mediary-node/server/internal/modules/reader/internal/archive"
	"github.com/MediaryDesktop/mediary-node/server/internal/modules/reader/internal/ref"
	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

type fakeLibrary struct {
	file *PlayableFile
	err  error
}

func (f fakeLibrary) Playable(context.Context, int64) (*PlayableFile, error) {
	return f.file, f.err
}

type fakeProgress struct {
	marked    []int
	fractions []float64
	mediaRef  string
	err       error
}

func (f *fakeProgress) MarkReadFraction(_ context.Context, mediaRef string, fraction float64) error {
	if f.err != nil {
		return f.err
	}
	f.mediaRef = mediaRef
	f.fractions = append(f.fractions, fraction)

	return nil
}

func (f *fakeProgress) MarkRead(_ context.Context, mediaRef string, chapter int) error {
	if f.err != nil {
		return f.err
	}
	f.mediaRef = mediaRef
	f.marked = append(f.marked, chapter)

	return nil
}

func comic(t *testing.T, name string, pages int) string {
	t.Helper()

	var buf bytes.Buffer
	writer := zip.NewWriter(&buf)
	for i := range pages {
		entry, err := writer.Create(fmt.Sprintf("pages/%02d.jpg", i))
		if err != nil {
			t.Fatal(err)
		}
		if _, err := entry.Write([]byte{0xff, 0xd8, byte(i)}); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	path := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(path, buf.Bytes(), 0o600); err != nil {
		t.Fatal(err)
	}

	return path
}

func intp(n int) *int { return &n }

func TestCountsAsReadOnlyOnTheLastPage(t *testing.T) {
	tests := []struct {
		page, total int
		want        bool
	}{
		{0, 1, true},
		{0, 20, false},
		{18, 20, false},
		{19, 20, true},
		{25, 20, true},
		{0, 0, false},
	}

	for _, tt := range tests {
		if got := CountsAsRead(tt.page, tt.total); got != tt.want {
			t.Errorf("CountsAsRead(%d, %d) = %v, want %v", tt.page, tt.total, got, tt.want)
		}
	}
}

func TestReachingTheLastPageMarksTheChapterOnce(t *testing.T) {
	path := comic(t, "ch.cbz", 3)
	progress := &fakeProgress{}
	svc := New(Options{
		Library:  fakeLibrary{file: &PlayableFile{ID: 4, Path: path, MediaRef: "anilist:9", Chapter: intp(12)}},
		Progress: progress,
	})

	for _, page := range []int{0, 1} {
		counted, err := svc.ReportPage(context.Background(), ref.Local(4), page)
		if err != nil || counted {
			t.Fatalf("page %d: counted=%v err=%v; want not yet", page, counted, err)
		}
	}

	for range 3 {
		counted, err := svc.ReportPage(context.Background(), ref.Local(4), 2)
		if err != nil || !counted {
			t.Fatalf("last page: counted=%v err=%v; want counted", counted, err)
		}
	}

	if len(progress.marked) != 1 || progress.marked[0] != 12 || progress.mediaRef != "anilist:9" {
		t.Errorf("tracker told %v about %s, want once about chapter 12", progress.marked, progress.mediaRef)
	}
}

func TestAnUnmatchedChapterIsReadButNotRecorded(t *testing.T) {
	path := comic(t, "ch.cbz", 1)
	progress := &fakeProgress{}
	svc := New(Options{
		Library:  fakeLibrary{file: &PlayableFile{ID: 4, Path: path}},
		Progress: progress,
	})

	counted, err := svc.ReportPage(context.Background(), ref.Local(4), 0)
	if err != nil || counted || len(progress.marked) != 0 {
		t.Errorf("unmatched chapter: counted=%v err=%v marked=%v", counted, err, progress.marked)
	}
}

func TestChapterListsPagesAndRefusesOtherFormats(t *testing.T) {
	path := comic(t, "ch.cbz", 2)
	svc := New(Options{Library: fakeLibrary{file: &PlayableFile{ID: 4, Path: path, Title: "Ch", Chapter: intp(1)}}})

	chapter, err := svc.Chapter(context.Background(), ref.Local(4))
	if err != nil {
		t.Fatalf("chapter: %v", err)
	}
	if len(chapter.Pages) != 2 || chapter.Title != "Ch" {
		t.Errorf("chapter = %+v", chapter)
	}

	cbr := New(Options{Library: fakeLibrary{file: &PlayableFile{ID: 5, Path: filepath.Join(t.TempDir(), "ch.cbr")}}})
	if _, err := cbr.Chapter(context.Background(), ref.Local(5)); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Errorf("cbr error kind = %v (%v), want precondition", apperr.KindOf(err), err)
	}
}

func TestMissingFileIsAPreconditionNotAPage(t *testing.T) {
	svc := New(Options{Library: fakeLibrary{file: &PlayableFile{ID: 4, Path: "/gone/ch.cbz", Missing: true}}})

	if _, err := svc.Chapter(context.Background(), ref.Local(4)); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Errorf("missing file error kind = %v, want precondition", apperr.KindOf(err))
	}
}

func TestProgressChapterCountsOnlyWholeChapters(t *testing.T) {
	tests := []struct {
		number string
		want   int
		whole  bool
	}{
		{"12", 12, true},
		{" 7 ", 7, true},
		{"12.0", 12, true},
		{"12.5", 0, false},
		{"", 0, false},
		{"0", 0, false},
		{"-1", 0, false},
		{"Extra", 0, false},
	}

	for _, tt := range tests {
		got, whole := ProgressChapter(tt.number)
		if got != tt.want || whole != tt.whole {
			t.Errorf("ProgressChapter(%q) = %d, %v; want %d, %v", tt.number, got, whole, tt.want, tt.whole)
		}
	}
}

// fakeSource stands in for an online source, which the reader treats the same way.
type fakeSource struct {
	chapter *Chapter
}

func (f fakeSource) Chapter(context.Context, ref.ChapterRef) (*Chapter, error) {
	return f.chapter, nil
}

func (f fakeSource) Page(context.Context, ref.ChapterRef, int) (archive.Image, error) {
	return archive.Image{}, nil
}

func TestAnExtraChapterIsReadButDoesNotMoveProgress(t *testing.T) {
	chapterRef, err := ref.Parse("plugin:example-comics:eyJzIjoiZnJpZXJlbi8xIiwiYyI6ImM6MSJ9")
	if err != nil {
		t.Fatal(err)
	}

	progress := &fakeProgress{}
	svc := New(Options{Progress: progress})
	pages := []archive.Page{{Index: 0}, {Index: 1}}

	svc.sources[ref.SourcePlugin] = fakeSource{chapter: &Chapter{Ref: chapterRef, MediaRef: "anilist:9", Number: "12.5", Pages: pages}}
	if counted, err := svc.ReportPage(context.Background(), chapterRef, 1); err != nil || counted || len(progress.marked) != 0 {
		t.Errorf("extra: counted=%v err=%v marked=%v", counted, err, progress.marked)
	}

	svc.sources[ref.SourcePlugin] = fakeSource{chapter: &Chapter{Ref: chapterRef, MediaRef: "anilist:9", Number: "13", Pages: pages}}
	if counted, err := svc.ReportPage(context.Background(), chapterRef, 1); err != nil || !counted || len(progress.marked) != 1 || progress.marked[0] != 13 {
		t.Errorf("whole chapter: counted=%v err=%v marked=%v", counted, err, progress.marked)
	}
}

func TestASourceTheNodeDoesNotHaveIsAPrecondition(t *testing.T) {
	chapterRef, err := ref.Parse("opds:1:urn:x")
	if err != nil {
		t.Fatal(err)
	}

	svc := New(Options{Library: fakeLibrary{}})
	if _, err := svc.Chapter(context.Background(), chapterRef); apperr.KindOf(err) != apperr.KindPrecondition {
		t.Errorf("unknown source error kind = %v (%v), want precondition", apperr.KindOf(err), err)
	}
}
