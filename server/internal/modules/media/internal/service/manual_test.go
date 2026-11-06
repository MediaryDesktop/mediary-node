package service

import (
	"context"
	"strings"
	"testing"

	"github.com/MediaryDesktop/mediary-node/server/internal/platform/apperr"
)

type recordingForgetter struct {
	forgotten []string
}

func (r *recordingForgetter) Forget(_ context.Context, mediaRef string) error {
	r.forgotten = append(r.forgotten, mediaRef)
	return nil
}

func intOf(value int) *int { return &value }

func stringOf(value string) *string { return &value }

func TestManualTitleIsReadWithoutTheNetwork(t *testing.T) {
	h := newDetailsHarness(t)
	ctx := context.Background()

	created, err := h.svc.CreateManual(ctx, ManualDraft{
		MediaType:     "anime",
		Title:         "  Obscure OVA  ",
		OriginalTitle: stringOf("Obscure OVA"),
		Synonyms:      []string{"Неясна OVA", "Obscure OVA", ""},
		Format:        stringOf("OVA"),
		Year:          intOf(1994),
		Episodes:      intOf(2),
		Chapters:      intOf(10),
		Duration:      intOf(30),
		Genres:        []string{"Drama", "Drama"},
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	if !strings.HasPrefix(created.MediaRef, "manual:") || !created.Editable {
		t.Fatalf("a manual title is editable under manual:<id>, got %+v", created)
	}
	if *created.Title.UserPreferred != "Obscure OVA" || created.Title.Native != nil {
		t.Fatalf("the name is trimmed and an original equal to it dropped: %+v", created.Title)
	}
	if len(created.Synonyms) != 1 || created.Synonyms[0] != "Неясна OVA" {
		t.Fatalf("synonyms = %v", created.Synonyms)
	}
	if len(created.Genres) != 1 {
		t.Fatalf("genres must be unique, got %v", created.Genres)
	}
	if created.Chapters != nil {
		t.Fatal("an anime has no chapters")
	}

	read, err := h.svc.Details(ctx, created.MediaRef)
	if err != nil {
		t.Fatalf("details: %v", err)
	}
	if read.Episodes == nil || *read.Episodes != 2 || *read.Format != "OVA" {
		t.Fatalf("read back %+v", read)
	}

	cached, err := h.svc.CachedDetails(ctx, created.MediaRef)
	if err != nil || cached == nil {
		t.Fatalf("cached: %v %v", cached, err)
	}

	episodes, err := h.svc.Episodes(ctx, created.MediaRef)
	if err != nil {
		t.Fatalf("episodes: %v", err)
	}
	if len(episodes.Episodes) != 2 || *episodes.Episodes[1].RuntimeMinutes != 30 {
		t.Fatalf("episodes = %+v", episodes.Episodes)
	}

	if h.requests.Load() != 0 {
		t.Fatalf("a manual title must never reach a source, made %d requests", h.requests.Load())
	}
}

func TestManualTitleDefaultsAndKindRules(t *testing.T) {
	h := newDetailsHarness(t)
	ctx := context.Background()

	movie, err := h.svc.CreateManual(ctx, ManualDraft{MediaType: "movie", Title: "Home Video", Episodes: intOf(12)})
	if err != nil {
		t.Fatalf("create movie: %v", err)
	}
	if *movie.Format != "MOVIE" || movie.Episodes == nil || *movie.Episodes != 1 {
		t.Fatalf("a movie is one episode of format MOVIE, got %+v", movie)
	}

	manga, err := h.svc.CreateManual(ctx, ManualDraft{MediaType: "manga", Title: "Doujin", Chapters: intOf(5), Episodes: intOf(3)})
	if err != nil {
		t.Fatalf("create manga: %v", err)
	}
	if manga.Episodes != nil || manga.Chapters == nil || *manga.Chapters != 5 {
		t.Fatalf("a manga counts chapters, got %+v", manga)
	}
	if _, err := h.svc.Episodes(ctx, manga.MediaRef); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("a manga has no episodes, got %v", err)
	}

	for name, draft := range map[string]ManualDraft{
		"blank title":  {MediaType: "anime", Title: "   "},
		"unknown kind": {MediaType: "podcast", Title: "x"},
		"wrong format": {MediaType: "movie", Title: "x", Format: stringOf("OVA")},
		"bad status":   {MediaType: "anime", Title: "x", Status: stringOf("AIRING")},
		"bad year":     {MediaType: "anime", Title: "x", Year: intOf(1066)},
		"negative":     {MediaType: "anime", Title: "x", Episodes: intOf(-1)},
		"month alone":  {MediaType: "anime", Title: "x", StartMonth: intOf(4)},
		"day alone":    {MediaType: "anime", Title: "x", Year: intOf(2020), StartDay: intOf(4)},
		"bad month":    {MediaType: "anime", Title: "x", Year: intOf(2020), StartMonth: intOf(13)},
		"no feb 30":    {MediaType: "anime", Title: "x", Year: intOf(2021), StartMonth: intOf(2), StartDay: intOf(30)},
		"end first":    {MediaType: "anime", Title: "x", Year: intOf(2020), EndYear: intOf(2019)},
		"end day first": {
			MediaType: "anime", Title: "x",
			Year: intOf(2020), StartMonth: intOf(5), StartDay: intOf(10),
			EndYear: intOf(2020), EndMonth: intOf(5), EndDay: intOf(9),
		},
		"high score": {MediaType: "anime", Title: "x", Score: intOf(101)},
	} {
		if _, err := h.svc.CreateManual(ctx, draft); apperr.KindOf(err) != apperr.KindInvalid {
			t.Errorf("%s: want invalid, got %v", name, err)
		}
	}
}

func TestManualTitleDatesScoreAndSeasons(t *testing.T) {
	h := newDetailsHarness(t)
	ctx := context.Background()

	series, err := h.svc.CreateManual(ctx, ManualDraft{
		MediaType: "series", Title: "Long Runner",
		Year: intOf(2024), StartMonth: intOf(2), StartDay: intOf(29),
		EndYear: intOf(2025), EndMonth: intOf(3),
		Score: intOf(85), Seasons: intOf(3),
	})
	if err != nil {
		t.Fatalf("create series: %v", err)
	}
	if *series.StartDate.Month != 2 || *series.StartDate.Day != 29 || *series.EndDate.Year != 2025 ||
		*series.EndDate.Month != 3 || series.EndDate.Day != nil {
		t.Fatalf("dates are shown as given, got %+v / %+v", series.StartDate, series.EndDate)
	}
	if *series.AverageScore != 85 || *series.Seasons != 3 {
		t.Fatalf("score and seasons are shown, got %v / %v", series.AverageScore, series.Seasons)
	}

	book, err := h.svc.CreateManual(ctx, ManualDraft{MediaType: "book", Title: "Tome", Seasons: intOf(2), Score: intOf(0)})
	if err != nil {
		t.Fatalf("create book: %v", err)
	}
	if book.Seasons != nil || book.AverageScore != nil {
		t.Fatalf("a book has no seasons and a zero score is none, got %v / %v", book.Seasons, book.AverageScore)
	}
}

func TestManualTitleUpdateAndDelete(t *testing.T) {
	h := newDetailsHarness(t)
	ctx := context.Background()

	forgetter := &recordingForgetter{}
	h.svc.opts.Forget = forgetter

	created, err := h.svc.CreateManual(ctx, ManualDraft{MediaType: "series", Title: "Local Show", Episodes: intOf(6)})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	id := strings.TrimPrefix(created.MediaRef, "manual:")

	updated, err := h.svc.UpdateManual(ctx, id, ManualDraft{MediaType: "series", Title: "Local Show", Episodes: intOf(8)})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if *updated.Episodes != 8 || updated.MediaRef != created.MediaRef {
		t.Fatalf("updated = %+v", updated)
	}

	if _, err := h.svc.UpdateManual(ctx, id, ManualDraft{MediaType: "movie", Title: "Local Show"}); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("a title cannot change kind, got %v", err)
	}

	if err := h.svc.DeleteManual(ctx, id); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if len(forgetter.forgotten) != 1 || forgetter.forgotten[0] != created.MediaRef {
		t.Fatalf("deleting must forget the reference elsewhere, forgot %v", forgetter.forgotten)
	}

	if _, err := h.svc.Details(ctx, created.MediaRef); apperr.KindOf(err) != apperr.KindNotFound {
		t.Fatalf("a deleted title is not found, got %v", err)
	}
	if cached, err := h.svc.CachedDetails(ctx, created.MediaRef); err != nil || cached != nil {
		t.Fatalf("a deleted title is not cached either, got %v %v", cached, err)
	}
	if err := h.svc.DeleteManual(ctx, id); apperr.KindOf(err) != apperr.KindNotFound {
		t.Fatalf("deleting twice is not found, got %v", err)
	}
}

func TestManualReferenceMustBeWellFormed(t *testing.T) {
	for _, ref := range []string{"manual:", "manual:xyz", "manual:0123456789ABCDEF0123", "manual:0123456789abcdef01234"} {
		if _, err := parseRef(ref); err == nil {
			t.Errorf("%q must be refused", ref)
		}
	}

	if _, err := parseRef("manual:0123456789abcdef0123"); err != nil {
		t.Fatalf("a well-formed reference is refused: %v", err)
	}
}

func TestSearchListsMatchingManualTitlesFirst(t *testing.T) {
	h := newDetailsHarness(t)
	ctx := context.Background()

	if _, err := h.svc.CreateManual(ctx, ManualDraft{MediaType: "anime", Title: "Hidden Gem", Synonyms: []string{"Прихований скарб"}}); err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, err := h.svc.CreateManual(ctx, ManualDraft{MediaType: "movie", Title: "Hidden Gem Movie"}); err != nil {
		t.Fatalf("create: %v", err)
	}

	found := h.svc.searchManual(ctx, "anime", "скарб")
	if len(found) != 1 || !found[0].Editable {
		t.Fatalf("a synonym in any script is searched, and only within the kind: %+v", found)
	}

	if none := h.svc.searchManual(ctx, "anime", "  "); len(none) != 0 {
		t.Fatalf("an empty query browses the source, not the user's titles: %+v", none)
	}
}
