// Package scanner walks a library root and reports the media files in it. It
// knows nothing about the database, the event bus or which title a file belongs
// to: the only question it answers is "what is on disk right now".
package scanner

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Kind is the form of media a file holds, as far as its extension can tell.
// Which title it belongs to — and whether it is a movie or an episode — is
// decided later, from the name and the source.
type Kind string

const (
	KindVideo Kind = "video"
	KindManga Kind = "manga"
	KindBook  Kind = "book"
)

var extensionKinds = map[string]Kind{
	".mkv": KindVideo, ".mp4": KindVideo, ".avi": KindVideo, ".mov": KindVideo,
	".m4v": KindVideo, ".webm": KindVideo, ".ts": KindVideo, ".m2ts": KindVideo,
	".mts": KindVideo, ".mpg": KindVideo, ".mpeg": KindVideo, ".mpe": KindVideo,
	".m2v": KindVideo, ".wmv": KindVideo, ".flv": KindVideo, ".f4v": KindVideo,
	".ogv": KindVideo, ".ogm": KindVideo, ".rm": KindVideo, ".rmvb": KindVideo,
	".asf": KindVideo, ".vob": KindVideo, ".3gp": KindVideo, ".3g2": KindVideo,
	".divx": KindVideo, ".mxf": KindVideo,

	// Comic archives only. A plain .zip or .rar says nothing about what is
	// inside it, and guessing wrong fills the library with junk.
	".cbz": KindManga, ".cbr": KindManga, ".cb7": KindManga, ".cbt": KindManga,

	".epub": KindBook, ".pdf": KindBook, ".mobi": KindBook, ".azw3": KindBook,
	".fb2": KindBook, ".djvu": KindBook,
}

// Directories that belong to the filesystem or to another program, never to the
// user's library. Anything starting with a dot is skipped as well.
var skippedDirs = map[string]struct{}{
	"@eadir":                    {},
	"#recycle":                  {},
	"$recycle.bin":              {},
	"system volume information": {},
	"lost+found":                {},
}

type File struct {
	RelPath string
	Kind    Kind
	Size    int64
	ModTime time.Time
}

type Options struct {
	// FollowSymlinks applies to directories only. Off by default: a symlink
	// loop turns a scan into a hang, and the cost of that is a library that
	// never finishes scanning. Symlinked files are always resolved — they
	// cannot form a cycle.
	FollowSymlinks bool

	OnFile func(found int)
}

// Walk returns every media file under root, with paths relative to it and
// separated by forward slashes so that a row written on Windows still matches
// after the library is read on another platform.
func Walk(ctx context.Context, root string, opts Options) ([]File, error) {
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return nil, fmt.Errorf("resolve library root %s: %w", root, err)
	}

	info, err := os.Stat(absRoot)
	if err != nil {
		return nil, fmt.Errorf("open library root %s: %w", absRoot, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("library root %s is not a directory", absRoot)
	}

	w := &walker{
		root:    absRoot,
		opts:    opts,
		visited: make(map[string]struct{}),
		files:   make([]File, 0, 128),
	}

	if err := w.walkDir(ctx, absRoot, absRoot); err != nil {
		return nil, err
	}

	return w.files, nil
}

type walker struct {
	root    string
	opts    Options
	visited map[string]struct{}
	files   []File
}

// walkDir walks physical and reports what it finds under logical. The two differ
// once a directory symlink has been followed: the file lives elsewhere on disk,
// but its place in the library is the path the user sees under the root, and that
// is what rel_path has to stay stable against.
func (w *walker) walkDir(ctx context.Context, physical, logical string) error {
	if resolved, err := filepath.EvalSymlinks(physical); err == nil {
		physical = resolved
	}

	key := strings.ToLower(physical)
	if _, seen := w.visited[key]; seen {
		return nil
	}
	w.visited[key] = struct{}{}

	return filepath.WalkDir(physical, func(path string, entry fs.DirEntry, walkErr error) error {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		// An unreadable subdirectory is skipped rather than fatal: one folder
		// the user has no rights to must not cost them the whole scan.
		if walkErr != nil {
			return nil //nolint:nilerr // see above
		}

		logicalPath, err := rebase(physical, logical, path)
		if err != nil {
			return nil //nolint:nilerr // outside the tree being walked
		}

		if entry.IsDir() {
			if path != physical && isSkippedDir(entry.Name()) {
				return fs.SkipDir
			}
			return nil
		}

		if entry.Type()&fs.ModeSymlink != 0 {
			return w.visitSymlink(ctx, path, logicalPath)
		}

		if info, infoErr := entry.Info(); infoErr == nil {
			w.appendFile(logicalPath, info)
		}

		return nil
	})
}

func (w *walker) visitSymlink(ctx context.Context, path, logicalPath string) error {
	target, err := os.Stat(path)
	if err != nil {
		return nil //nolint:nilerr // a broken link is not a library file
	}

	if target.IsDir() {
		if !w.opts.FollowSymlinks {
			return nil
		}
		return w.walkDir(ctx, path, logicalPath)
	}

	w.appendFile(logicalPath, target)

	return nil
}

func (w *walker) appendFile(logicalPath string, info os.FileInfo) {
	kind, ok := classify(filepath.Base(logicalPath))
	if !ok {
		return
	}

	// A zero-byte file is an interrupted copy, not media.
	if info.Size() == 0 {
		return
	}

	relPath, err := filepath.Rel(w.root, logicalPath)
	if err != nil {
		return
	}

	w.files = append(w.files, File{
		RelPath: filepath.ToSlash(relPath),
		Kind:    kind,
		Size:    info.Size(),
		ModTime: info.ModTime(),
	})

	if w.opts.OnFile != nil {
		w.opts.OnFile(len(w.files))
	}
}

func rebase(physical, logical, path string) (string, error) {
	if physical == logical {
		return path, nil
	}

	rel, err := filepath.Rel(physical, path)
	if err != nil {
		return "", err
	}

	return filepath.Join(logical, rel), nil
}

func classify(name string) (Kind, bool) {
	// A dotfile is configuration or an AppleDouble sidecar, which carries the
	// extension of the file it describes.
	if strings.HasPrefix(name, ".") {
		return "", false
	}

	kind, ok := extensionKinds[strings.ToLower(filepath.Ext(name))]

	return kind, ok
}

func isSkippedDir(name string) bool {
	if strings.HasPrefix(name, ".") {
		return true
	}

	_, skipped := skippedDirs[strings.ToLower(name)]

	return skipped
}

// Describe is Walk for one file the node has just written itself, so that it can
// join the library without a walk of the whole root. It reports false for a file
// Walk would not list either.
func Describe(root, relPath string) (File, bool, error) {
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return File{}, false, fmt.Errorf("resolve library root %s: %w", root, err)
	}

	path := filepath.Join(absRoot, filepath.FromSlash(relPath))

	info, err := os.Stat(path)
	if err != nil {
		return File{}, false, fmt.Errorf("read %s: %w", path, err)
	}

	kind, ok := classify(filepath.Base(path))
	if !ok || !info.Mode().IsRegular() || info.Size() == 0 {
		return File{}, false, nil
	}

	return File{
		RelPath: filepath.ToSlash(relPath),
		Kind:    kind,
		Size:    info.Size(),
		ModTime: info.ModTime(),
	}, true, nil
}
