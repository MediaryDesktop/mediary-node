package manifest

import (
	"path"
	"regexp"
	"strings"
	"testing"
)

var sha256Hex = regexp.MustCompile(`^[0-9a-f]{64}$`)

func TestBuiltInManifest(t *testing.T) {
	m, err := Load()
	if err != nil {
		t.Fatal(err)
	}

	if len(m.Packages) == 0 {
		t.Fatal("the manifest lists no packages")
	}

	seen := map[string]bool{}
	for _, pkg := range m.Packages {
		if pkg.ID == "" || pkg.Name == "" || pkg.Author == "" || pkg.Version == "" || len(pkg.Programs) == 0 {
			t.Errorf("package %q is missing its id, name, author, version or programs", pkg.ID)
		}

		for _, program := range pkg.Programs {
			if seen[program.Name] {
				t.Errorf("program %s comes from two packages", program.Name)
			}
			seen[program.Name] = true

			if program.VersionFlag == "" {
				t.Errorf("%s has no version flag to check the install with", program.Name)
			}
		}

		for platform, archive := range pkg.Archives {
			name := pkg.ID + " " + platform

			// Only GitHub releases: an address anywhere else would be a server
			// nobody vetted serving a program the node runs.
			if !strings.HasPrefix(archive.URL, "https://github.com/") {
				t.Errorf("%s: %s is not a GitHub release", name, archive.URL)
			}
			if !sha256Hex.MatchString(archive.SHA256) {
				t.Errorf("%s: %q is not a SHA-256", name, archive.SHA256)
			}
			if archive.Size <= 0 {
				t.Errorf("%s: no size", name)
			}
			if archive.Format != "zip" && archive.Format != "7z" {
				t.Errorf("%s: unknown format %q", name, archive.Format)
			}

			for _, file := range archive.Files {
				if file == "" || path.IsAbs(file) || strings.Contains(file, "\\") || path.Clean(file) != file || strings.HasPrefix(file, "..") {
					t.Errorf("%s: %q is not a plain relative path", name, file)
				}
			}

			for _, program := range pkg.Programs {
				if !hasProgram(archive.Files, program.Name, platform) {
					t.Errorf("%s: the files leave out %s", name, program.Name)
				}
			}
		}
	}
}

func hasProgram(files []string, program, platform string) bool {
	want := program
	if strings.HasPrefix(platform, "windows/") {
		want += ".exe"
	}

	for _, file := range files {
		if file == want {
			return true
		}
	}

	return false
}
