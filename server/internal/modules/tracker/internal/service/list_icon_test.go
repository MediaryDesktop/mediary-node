package service

import (
	"context"
	"strings"
	"testing"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

func iconOf(lists []CustomList, id string) (string, bool) {
	for _, list := range lists {
		if list.ID == id {
			return list.Icon, true
		}
	}

	return "", false
}

func strp(s string) *string { return &s }

func TestListIconIsKeptChangedAndDropped(t *testing.T) {
	fake := newFakeAniList(t)
	h := newHarness(t, fake.server.URL)
	ctx := context.Background()

	created, err := h.svc.CreateList(ctx, ListMediaTypeMovie, "Rainy Sunday", "heart")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if created.Icon != "heart" {
		t.Fatalf("created icon = %q, want heart", created.Icon)
	}

	lists, err := h.svc.Lists(ctx)
	if err != nil {
		t.Fatalf("lists: %v", err)
	}
	if icon, _ := iconOf(lists, created.ID); icon != "heart" {
		t.Fatalf("listed icon = %q, want heart", icon)
	}

	// A rename that says nothing about the icon keeps it.
	renamed, err := h.svc.UpdateList(ctx, created.ID, "Cosy evening", nil)
	if err != nil {
		t.Fatalf("rename: %v", err)
	}
	if renamed.Icon != "heart" {
		t.Fatalf("icon after rename = %q, want it kept", renamed.Icon)
	}

	// An empty icon goes back to the default.
	cleared, err := h.svc.UpdateList(ctx, created.ID, "Cosy evening", strp(""))
	if err != nil {
		t.Fatalf("clear icon: %v", err)
	}
	if cleared.Icon != "" {
		t.Fatalf("icon after clearing = %q, want default", cleared.Icon)
	}

	if _, err = h.svc.UpdateList(ctx, created.ID, "Cosy evening", strp("star")); err != nil {
		t.Fatalf("set icon: %v", err)
	}
	if err = h.svc.DeleteList(ctx, created.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}

	icons, err := h.svc.store.ListIcons(ctx)
	if err != nil {
		t.Fatalf("icons: %v", err)
	}
	if len(icons) != 0 {
		t.Fatalf("a deleted list left its icon behind: %v", icons)
	}
}

func TestAniListListIconFollowsARename(t *testing.T) {
	fake := newFakeAniList(t)
	fake.setCustomLists([]string{"Rewatch"}, nil)

	h := newHarness(t, fake.server.URL)
	ctx := context.Background()

	if _, err := h.svc.SignIn(ctx, "token"); err != nil {
		t.Fatalf("sign in: %v", err)
	}

	id := aniListListID(MediaTypeAnime, "Rewatch")

	if _, err := h.svc.UpdateList(ctx, id, "Rewatch", strp("star")); err != nil {
		t.Fatalf("set icon: %v", err)
	}

	renamed, err := h.svc.UpdateList(ctx, id, "Again", nil)
	if err != nil {
		t.Fatalf("rename: %v", err)
	}

	if renamed.ID != aniListListID(MediaTypeAnime, "Again") || renamed.Icon != "star" {
		t.Fatalf("renamed = %+v, want the icon to follow the new id", renamed)
	}

	icons, err := h.svc.store.ListIcons(ctx)
	if err != nil {
		t.Fatalf("icons: %v", err)
	}
	if _, left := icons[id]; left {
		t.Fatalf("the old id kept an icon: %v", icons)
	}
}

// AniList never sees an icon, so changing only the icon must not touch the
// account. The fake holds no list of this name: a rewrite would answer not found.
func TestIconOnlyChangeLeavesAniListAlone(t *testing.T) {
	fake := newFakeAniList(t)
	h := newHarness(t, fake.server.URL)
	ctx := context.Background()

	if _, err := h.svc.SignIn(ctx, "token"); err != nil {
		t.Fatalf("sign in: %v", err)
	}

	id := aniListListID(MediaTypeAnime, "Not on AniList")

	list, err := h.svc.UpdateList(ctx, id, "Not on AniList", strp("flame"))
	if err != nil {
		t.Fatalf("icon-only change reached AniList: %v", err)
	}
	if list.Icon != "flame" {
		t.Fatalf("icon = %q, want flame", list.Icon)
	}
}

func TestListIconMustBeAPlainName(t *testing.T) {
	for _, bad := range []string{"Heart", "heart!", "../x", "a b", strings.Repeat("a", maxListIconLength+1)} {
		if _, err := normalizeListIcon(bad); apperr.KindOf(err) != apperr.KindInvalid {
			t.Errorf("icon %q accepted", bad)
		}
	}

	for _, good := range []string{"", "heart", "book-open", "number-1"} {
		if _, err := normalizeListIcon(good); err != nil {
			t.Errorf("icon %q rejected: %v", good, err)
		}
	}
}
