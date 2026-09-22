package service

import (
	"context"
	"slices"
	"strings"
	"testing"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

func TestParseListIDRoundTrips(t *testing.T) {
	cases := []struct {
		name string
		id   string
		want listRef
	}{
		{
			name: "anilist list",
			id:   aniListListID(MediaTypeAnime, "Rewatch"),
			want: listRef{provider: ListProviderAniList, mediaType: ListMediaTypeAnime, name: "Rewatch"},
		},
		{
			name: "a name with a colon stays whole",
			id:   aniListListID(MediaTypeManga, "Re:Zero picks"),
			want: listRef{provider: ListProviderAniList, mediaType: ListMediaTypeManga, name: "Re:Zero picks"},
		},
		{
			name: "local list",
			id:   localListID(7),
			want: listRef{provider: ListProviderLocal, localID: 7},
		},
	}

	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			got, err := parseListID(test.id)
			if err != nil {
				t.Fatalf("parse %q: %v", test.id, err)
			}

			if got != test.want {
				t.Fatalf("parse %q = %+v, want %+v", test.id, got, test.want)
			}
		})
	}
}

func TestParseListIDRejectsNonsense(t *testing.T) {
	for _, id := range []string{"", "local", "local:abc", "anilist:anime", "anilist:movie:Picks", "mal:anime:Picks"} {
		if _, err := parseListID(id); err == nil {
			t.Fatalf("parse %q must fail", id)
		}
	}
}

func TestNormalizeListName(t *testing.T) {
	clean, err := normalizeListName("  Watch later  ")
	if err != nil {
		t.Fatalf("normalize: %v", err)
	}

	if clean != "Watch later" {
		t.Fatalf("want trimmed name, got %q", clean)
	}

	if _, err := normalizeListName("   "); err == nil {
		t.Fatal("a blank name must be rejected")
	}

	if _, err := normalizeListName(strings.Repeat("a", maxListNameLength+1)); err == nil {
		t.Fatal("an over-long name must be rejected")
	}
}

func TestLocalListsLiveWithoutAniList(t *testing.T) {
	fake := newFakeAniList(t)
	h := newHarness(t, fake.server.URL)
	ctx := context.Background()

	created, err := h.svc.CreateList(ctx, ListMediaTypeMovie, "  Rainy Sunday  ")
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	if created.Provider != ListProviderLocal || created.Name != "Rainy Sunday" {
		t.Fatalf("unexpected list: %+v", created)
	}

	_, duplicateErr := h.svc.CreateList(ctx, ListMediaTypeMovie, "Rainy Sunday")
	if apperr.KindOf(duplicateErr) != apperr.KindConflict {
		t.Fatalf("a duplicate name must conflict, got %v", duplicateErr)
	}

	dorama, err := h.svc.CreateList(ctx, ListMediaTypeDorama, "K-drama picks")
	if err != nil {
		t.Fatalf("create dorama list: %v", err)
	}

	if dorama.MediaType != ListMediaTypeDorama {
		t.Fatalf("unexpected list: %+v", dorama)
	}

	lists, err := h.svc.Lists(ctx)
	if err != nil {
		t.Fatalf("lists: %v", err)
	}

	if len(lists) != 2 {
		t.Fatalf("unexpected lists: %+v", lists)
	}

	if err := h.svc.DeleteList(ctx, dorama.ID); err != nil {
		t.Fatalf("delete dorama list: %v", err)
	}

	renamed, err := h.svc.RenameList(ctx, created.ID, "Cosy evening")
	if err != nil {
		t.Fatalf("rename: %v", err)
	}

	if renamed.Name != "Cosy evening" {
		t.Fatalf("unexpected rename: %+v", renamed)
	}

	if deleteErr := h.svc.DeleteList(ctx, created.ID); deleteErr != nil {
		t.Fatalf("delete: %v", deleteErr)
	}

	remaining, err := h.svc.Lists(ctx)
	if err != nil {
		t.Fatalf("lists after delete: %v", err)
	}

	if len(remaining) != 0 {
		t.Fatalf("want no lists left, got %+v", remaining)
	}
}

func TestCreateAniListListKeepsTheOtherMediaTypesLists(t *testing.T) {
	fake := newFakeAniList(t)
	fake.setCustomLists([]string{"Rewatch"}, []string{"Hiatus"})

	h := newHarness(t, fake.server.URL)
	ctx := context.Background()

	if _, err := h.svc.SignIn(ctx, "token"); err != nil {
		t.Fatalf("sign in: %v", err)
	}

	created, err := h.svc.CreateList(ctx, ListMediaTypeAnime, "Comfort shows")
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	if created.Provider != ListProviderAniList || created.ID != aniListListID(MediaTypeAnime, "Comfort shows") {
		t.Fatalf("unexpected list: %+v", created)
	}

	anime, manga := fake.customLists()

	if !slices.Equal(anime, []string{"Rewatch", "Comfort shows"}) {
		t.Fatalf("anime lists = %v, want the existing one kept and the new one appended", anime)
	}

	if !slices.Equal(manga, []string{"Hiatus"}) {
		t.Fatalf("manga lists = %v, want them untouched by an anime change", manga)
	}
}

func TestDeleteAniListListLeavesTheRest(t *testing.T) {
	fake := newFakeAniList(t)
	fake.setCustomLists([]string{"Rewatch", "Comfort shows"}, nil)

	h := newHarness(t, fake.server.URL)
	ctx := context.Background()

	if _, err := h.svc.SignIn(ctx, "token"); err != nil {
		t.Fatalf("sign in: %v", err)
	}

	if err := h.svc.DeleteList(ctx, aniListListID(MediaTypeAnime, "Rewatch")); err != nil {
		t.Fatalf("delete: %v", err)
	}

	anime, _ := fake.customLists()

	if !slices.Equal(anime, []string{"Comfort shows"}) {
		t.Fatalf("anime lists = %v, want only the deleted one gone", anime)
	}

	if err := h.svc.DeleteList(ctx, aniListListID(MediaTypeAnime, "Never existed")); apperr.KindOf(err) != apperr.KindNotFound {
		t.Fatalf("deleting an unknown list must be a not-found, got %v", err)
	}
}

func TestAniListListsCarryCoversAndTheirNewestChange(t *testing.T) {
	fake := newFakeAniList(t)
	h := newHarness(t, fake.server.URL)
	ctx := context.Background()

	if _, err := h.svc.SignIn(ctx, "token"); err != nil {
		t.Fatalf("sign in: %v", err)
	}

	if _, err := h.svc.Entries(ctx, MediaTypeAnime); err != nil {
		t.Fatalf("entries: %v", err)
	}

	lists, err := h.svc.Lists(ctx)
	if err != nil {
		t.Fatalf("lists: %v", err)
	}

	var custom *CustomList

	for i := range lists {
		if lists[i].Name == "Favourites 2025" {
			custom = &lists[i]
		}
	}

	if custom == nil {
		t.Fatalf("the custom list must be listed, got %+v", lists)
	}

	if custom.Provider != ListProviderAniList || custom.MediaType != ListMediaTypeAnime || custom.Count != 1 {
		t.Fatalf("unexpected list: %+v", custom)
	}

	if custom.UpdatedAt == nil {
		t.Fatal("a list holding a title must carry that title's change time")
	}

	for _, list := range lists {
		if list.Name == "Watching" {
			t.Fatalf("a status list must never reach the custom lists: %+v", lists)
		}
	}
}

func findList(lists []CustomList, name string) *CustomList {
	for i := range lists {
		if lists[i].Name == name {
			return &lists[i]
		}
	}

	return nil
}

func TestDeleteAniListListEmptiesItFirstAndDropsItFromTheMirror(t *testing.T) {
	fake := newFakeAniList(t)
	fake.setCustomLists([]string{"Favourites 2025"}, nil)

	h := newHarness(t, fake.server.URL)
	ctx := context.Background()

	if _, err := h.svc.SignIn(ctx, "token"); err != nil {
		t.Fatalf("sign in: %v", err)
	}

	if _, err := h.svc.Entries(ctx, MediaTypeAnime); err != nil {
		t.Fatalf("entries: %v", err)
	}

	if err := h.svc.DeleteList(ctx, aniListListID(MediaTypeAnime, "Favourites 2025")); err != nil {
		t.Fatalf("delete: %v", err)
	}

	saved, ok := fake.savedMembership()[100]
	if !ok || len(saved) != 0 {
		t.Fatalf("the title in the deleted list must be taken out of it, got %v (saved: %v)", saved, ok)
	}

	lists, err := h.svc.Lists(ctx)
	if err != nil {
		t.Fatalf("lists: %v", err)
	}

	if list := findList(lists, "Favourites 2025"); list != nil {
		t.Fatalf("the deleted list must be gone without waiting for a refresh, got %+v", list)
	}
}

func TestCreatedAniListListStartsEmptyEvenWhenAniListRemembersTheName(t *testing.T) {
	fake := newFakeAniList(t)

	h := newHarness(t, fake.server.URL)
	ctx := context.Background()

	if _, err := h.svc.SignIn(ctx, "token"); err != nil {
		t.Fatalf("sign in: %v", err)
	}

	if _, err := h.svc.Entries(ctx, MediaTypeAnime); err != nil {
		t.Fatalf("entries: %v", err)
	}

	if _, err := h.svc.CreateList(ctx, ListMediaTypeAnime, "Favourites 2025"); err != nil {
		t.Fatalf("create: %v", err)
	}

	saved, ok := fake.savedMembership()[100]
	if !ok || len(saved) != 0 {
		t.Fatalf("a title left in the name by an earlier list must be taken out, got %v (saved: %v)", saved, ok)
	}

	lists, err := h.svc.Lists(ctx)
	if err != nil {
		t.Fatalf("lists: %v", err)
	}

	list := findList(lists, "Favourites 2025")
	if list == nil {
		t.Fatalf("the created list must show up without waiting for a refresh, got %+v", lists)
	}

	if list.Count != 0 || len(list.Covers) != 0 {
		t.Fatalf("a created list must start empty, got %+v", list)
	}
}
