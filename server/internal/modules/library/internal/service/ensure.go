package service

import (
	"context"
	"os"
	"path/filepath"
	"strings"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// EnsureRoot makes a folder the node writes into part of the library: it creates
// the folder and adds it as a root of mixed videos, unless a root already is or
// holds it. relDir is where the folder sits inside the root it ends up in, slash
// separated; empty when it is that root itself.
func (s *Service) EnsureRoot(ctx context.Context, path string) (rootID int64, relDir string, err error) {
	return s.EnsureRootOf(ctx, path, ContentMixed)
}

// EnsureRootOf is EnsureRoot for a folder of one content, added as such when no
// root is or holds it yet. A root that already holds it is returned as it is,
// whatever it holds: the caller decides whether that will do.
func (s *Service) EnsureRootOf(ctx context.Context, path, content string) (rootID int64, relDir string, err error) {
	if !validContent(content) {
		return 0, "", apperr.Invalid("content", "unknown folder content %q", content)
	}

	absolute, err := filepath.Abs(path)
	if err != nil {
		return 0, "", apperr.Invalid("path", "%s is not a usable path", path)
	}
	cleaned := filepath.Clean(absolute)

	if mkdirErr := os.MkdirAll(cleaned, 0o755); mkdirErr != nil { //nolint:gosec // a media folder the user chose; other programs read it too
		return 0, "", apperr.Wrap(mkdirErr, apperr.KindPrecondition, "create the folder %s", cleaned)
	}

	roots, err := s.store.Roots(ctx)
	if err != nil {
		return 0, "", apperr.Wrap(err, apperr.KindInternal, "read library roots")
	}

	for _, root := range roots {
		if samePath(root.Path, cleaned) {
			return root.ID, "", nil
		}
		if isUnder(cleaned, root.Path) {
			return root.ID, insideOf(cleaned, root.Path), nil
		}
	}

	root, err := s.AddRoot(ctx, cleaned, content)
	if err != nil {
		return 0, "", err
	}

	return root.ID, "", nil
}

// insideOf is child's path below parent, in child's own spelling: the two may
// differ in case where the disk does not mind it.
func insideOf(child, parent string) string {
	rel, err := filepath.Rel(comparablePath(parent), comparablePath(child))
	if err != nil {
		return ""
	}

	depth := len(strings.Split(rel, string(filepath.Separator)))
	segments := strings.Split(child, string(filepath.Separator))

	return strings.Join(segments[len(segments)-depth:], "/")
}
