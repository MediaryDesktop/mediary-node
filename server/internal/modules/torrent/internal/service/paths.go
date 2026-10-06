package service

import (
	"path/filepath"
	"strings"
	"unicode"
)

// The longest folder name the node makes for a title; Windows paths still have a
// 260-character limit in places.
const maxFolderRunes = 120

// folderName turns a title into a folder name every system accepts.
func folderName(title string) string {
	var b strings.Builder

	for _, r := range strings.TrimSpace(title) {
		switch {
		case strings.ContainsRune(`<>:"/\|?*`, r), unicode.IsControl(r):
			b.WriteRune(' ')
		default:
			b.WriteRune(r)
		}
	}

	name := strings.Join(strings.Fields(b.String()), " ")
	if runes := []rune(name); len(runes) > maxFolderRunes {
		name = strings.TrimSpace(string(runes[:maxFolderRunes]))
	}

	// Windows drops trailing dots and spaces, and the node would look for a
	// folder that does not exist.
	name = strings.TrimRight(name, ". ")
	if name == "" {
		return "Untitled"
	}

	return name
}

// savePath is where the client should save a folder: the node's own client sees
// the node's disk, qBittorrent may see it under other names.
func savePath(nodePath string, settings *TorrentSettings) string {
	if settings.Client == ClientEmbedded {
		return nodePath
	}

	return clientPath(nodePath, settings.PathMap)
}

// clientPath is where the client should save a folder the node knows by
// nodePath. Without a mapping both see the same disk.
func clientPath(nodePath string, mapping TorrentPathMap) string {
	if mapping.Node == "" {
		return nodePath
	}

	rest, ok := cutPathPrefix(nodePath, mapping.Node)
	if !ok {
		return nodePath
	}

	sep := "/"
	if strings.Contains(mapping.Client, `\`) && !strings.Contains(mapping.Client, "/") {
		sep = `\`
	}

	base := strings.TrimRight(mapping.Client, `/\`)
	if rest == "" {
		return base
	}

	return base + sep + strings.Join(splitPath(rest), sep)
}

// cutPathPrefix reports the part of path below prefix, comparing whole folder
// names and ignoring case on Windows.
func cutPathPrefix(path, prefix string) (string, bool) {
	pathParts, prefixParts := splitPath(path), splitPath(prefix)
	if len(prefixParts) > len(pathParts) {
		return "", false
	}

	for i, part := range prefixParts {
		if !samePart(pathParts[i], part) {
			return "", false
		}
	}

	return strings.Join(pathParts[len(prefixParts):], "/"), true
}

func splitPath(path string) []string {
	return strings.FieldsFunc(path, func(r rune) bool { return r == '/' || r == '\\' })
}

func samePart(a, b string) bool {
	if filepath.Separator == '\\' {
		return strings.EqualFold(a, b)
	}

	return a == b
}
