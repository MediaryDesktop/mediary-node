// Package manifest is the list of programs the node can install, built into the
// binary: versions, addresses and checksums change only with a new node, never
// from the network.
package manifest

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"runtime"
)

//go:embed manifest.json
var builtIn []byte

type Manifest struct {
	Packages []Package `json:"packages"`
}

// Package is one download that gives the node one or more programs: FFmpeg's
// archive holds ffprobe too.
type Package struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	// Author is whose build it is: the node downloads it from them.
	Author   string             `json:"author"`
	Version  string             `json:"version"`
	Programs []Program          `json:"programs"`
	Archives map[string]Archive `json:"archives"`

	// Hints is the command to install the package by hand, by GOOS, where the
	// node has no archive to install itself.
	Hints map[string]string `json:"hints"`
}

type Program struct {
	Name string `json:"name"`
	// VersionFlag makes the program print its version and exit; running it is
	// how an install proves the files work.
	VersionFlag string `json:"version_flag"`
}

type Archive struct {
	URL    string `json:"url"`
	SHA256 string `json:"sha256"`
	Size   int64  `json:"size"`
	Format string `json:"format"`

	// Root is the folder inside the archive the files are taken from; it is not
	// kept in the install.
	Root string `json:"root"`
	// Files are the only entries taken out, relative to Root. Everything else in
	// the archive — docs, installers, scripts — stays out of the node's folder.
	Files []string `json:"files"`
}

func Load() (*Manifest, error) {
	return Parse(builtIn)
}

func Parse(raw []byte) (*Manifest, error) {
	var m Manifest
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, fmt.Errorf("read the tools manifest: %w", err)
	}

	return &m, nil
}

// Platform is the key of the archive for the machine the node runs on.
func Platform() string {
	return runtime.GOOS + "/" + runtime.GOARCH
}

func (m *Manifest) Package(id string) (*Package, bool) {
	for i := range m.Packages {
		if m.Packages[i].ID == id {
			return &m.Packages[i], true
		}
	}

	return nil, false
}
