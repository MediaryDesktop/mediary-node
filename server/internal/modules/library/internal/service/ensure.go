package service

import (
	"context"
	"os"
	"path/filepath"
	"strings"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

// EnsureRoot makes a folder the node writes into part of the library: it creates
// the folder and adds it as a root of videos, unless a root already is or holds
// it. relDir is where the folder sits inside the root it ends up in, slash
// separated; empty when it is that root itself.
func (s *Service) EnsureRoot(ctx context.Context, path string) (rootID int64, relDir string, err error) {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return 0, "", apperr.Invalid("path", "%s is not a usable path", path)
	}
	cleaned := filepath.Clean(absolute)

	if err := os.MkdirAll(cleaned, 0o755); err != nil {
		return 0, "", apperr.Wrap(err, apperr.KindPrecondition, "create the folder %s", cleaned)
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

	root, err := s.AddRoot(ctx, cleaned, ContentAnime)
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
