package service

import (
	"context"
	"testing"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

const manualAnime = "manual:0123456789abcdef0123"

func TestAManualAnimeIsKeptOnTheNodeBesideAniList(t *testing.T) {
	h, titles := newLocalHarness(t)
	ctx := context.Background()

	titles.source[manualAnime] = localTitleOf(MediaTypeAnime, "Obscure OVA", 2)

	if _, err := h.svc.SignIn(ctx, "token"); err != nil {
		t.Fatalf("sign in: %v", err)
	}

	current, progress := "CURRENT", 1

	entry, err := h.svc.UpdateEntry(ctx, manualAnime, EntryPatch{Status: &current})
	if err != nil {
		t.Fatalf("add: %v", err)
	}
	if entry.Provider != ProviderLocal || entry.MediaType != MediaTypeAnime {
		t.Fatalf("a manual anime is a local entry, got %+v", entry)
	}

	if watchErr := h.svc.MarkWatched(ctx, manualAnime, progress); watchErr != nil {
		t.Fatalf("mark watched: %v", watchErr)
	}

	collection, err := h.svc.Entries(ctx, MediaTypeAnime)
	if err != nil {
		t.Fatalf("entries: %v", err)
	}

	if len(collection.Entries) != 2 {
		t.Fatalf("the AniList entry and the manual one, got %+v", collection.Entries)
	}

	manual := collection.Entries[1]
	if manual.MediaRef != manualAnime || manual.Progress != 1 {
		t.Fatalf("manual entry %+v", manual)
	}

	for _, list := range collection.Lists {
		if list.Status != nil && *list.Status == "CURRENT" && list.Count != 2 {
			t.Fatalf("the manual entry counts under the AniList list of its status, got %+v", list)
		}
	}

	tracked, err := h.svc.TrackedTitles(ctx, MediaTypeAnime)
	if err != nil {
		t.Fatalf("tracked: %v", err)
	}
	if len(tracked) != 2 {
		t.Fatalf("files can be matched to the manual anime too, got %+v", tracked)
	}

	favourites := []string{"Favourites 2025"}
	if _, err := h.svc.UpdateEntry(ctx, manualAnime, EntryPatch{CustomLists: &favourites}); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("AniList's custom lists cannot hold a title AniList does not have, got %v", err)
	}

	if err := h.svc.DeleteEntry(ctx, manualAnime); err != nil {
		t.Fatalf("delete: %v", err)
	}
}

func TestAnAniListAnimeIsStillNotKeptOnTheNode(t *testing.T) {
	h, titles := newLocalHarness(t)
	ctx := context.Background()

	titles.source["tmdb:tv:99"] = localTitleOf(MediaTypeAnime, "Animated Show", 12)

	planning := "PLANNING"
	if _, err := h.svc.UpdateEntry(ctx, "tmdb:tv:99", EntryPatch{Status: &planning}); apperr.KindOf(err) != apperr.KindInvalid {
		t.Fatalf("only a manual anime may be kept on the node, got %v", err)
	}
}
