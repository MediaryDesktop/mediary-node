package service

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestEnsureRootAddsTheFolderOnce(t *testing.T) {
	svc := newHarness(t).svc
	ctx := context.Background()

	folder := filepath.Join(t.TempDir(), "Downloads", "Mediary")

	id, inside, err := svc.EnsureRoot(ctx, folder)
	if err != nil {
		t.Fatal(err)
	}
	if inside != "" {
		t.Fatalf("inside = %q, want the folder itself", inside)
	}
	if info, statErr := os.Stat(folder); statErr != nil || !info.IsDir() {
		t.Fatalf("the folder was not created: %v", statErr)
	}

	again, _, err := svc.EnsureRoot(ctx, folder)
	if err != nil {
		t.Fatal(err)
	}
	if again != id {
		t.Fatalf("second call made root %d, want %d", again, id)
	}

	roots, err := svc.Roots(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(roots) != 1 || roots[0].Content != ContentMixed {
		t.Fatalf("roots = %+v", roots)
	}
}

func TestEnsureRootOfAddsTheFolderAsItsContent(t *testing.T) {
	svc := newHarness(t).svc
	ctx := context.Background()

	folder := filepath.Join(t.TempDir(), "books")

	id, _, err := svc.EnsureRootOf(ctx, folder, ContentBooks)
	if err != nil {
		t.Fatal(err)
	}

	roots, err := svc.Roots(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(roots) != 1 || roots[0].ID != id || roots[0].Content != ContentBooks {
		t.Fatalf("roots = %+v", roots)
	}

	if _, _, err := svc.EnsureRootOf(ctx, folder, "comics"); err == nil {
		t.Fatal("an unknown content was accepted")
	}
}

func TestEnsureRootInsideAnotherRoot(t *testing.T) {
	svc := newHarness(t).svc
	ctx := context.Background()

	home := t.TempDir()
	root, err := svc.AddRoot(ctx, home, ContentMoviesAndShows)
	if err != nil {
		t.Fatal(err)
	}

	id, inside, err := svc.EnsureRoot(ctx, filepath.Join(home, "Downloads", "Mediary"))
	if err != nil {
		t.Fatal(err)
	}
	if id != root.ID || inside != "Downloads/Mediary" {
		t.Fatalf("got root %d at %q, want root %d at Downloads/Mediary", id, inside, root.ID)
	}
}
