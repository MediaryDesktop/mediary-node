package repository

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

func entry(edit func(e map[string]any)) map[string]any {
	e := map[string]any{
		"manifest":    "https://plugins.example.org/nyaa/manifest.json",
		"id":          "nyaa",
		"name":        "Nyaa",
		"version":     "1.2.0",
		"type":        "torrent-provider",
		"author":      "someone",
		"description": "Anime releases",
		"lang":        "multi",
		"icon":        "https://plugins.example.org/nyaa/icon.png",
	}
	if edit != nil {
		edit(e)
	}

	return e
}

func parse(t *testing.T, repo map[string]any) (*Repository, int, error) {
	t.Helper()

	raw, err := json.Marshal(repo)
	if err != nil {
		t.Fatal(err)
	}

	return Parse(raw)
}

func TestKeepsGoodEntriesAndCountsBadOnes(t *testing.T) {
	repo, skipped, err := parse(t, map[string]any{
		"name": "  Community\nplugins ",
		"plugins": []any{
			entry(nil),
			entry(func(e map[string]any) { e["type"] = "plugin" }),
			entry(func(e map[string]any) { e["manifest"] = "http://plugins.example.org/m.json" }),
			entry(func(e map[string]any) { e["manifest"] = "file:///C:/m.json" }),
			entry(func(e map[string]any) { e["id"] = "Bad Id" }),
			entry(func(e map[string]any) { e["version"] = "latest" }),
			entry(func(e map[string]any) { e["name"] = " \t " }),
			"not an object",
			entry(func(e map[string]any) {
				e["id"] = "second"
				e["icon"] = "javascript:alert(1)"
				e["lang"] = "English"
				e["description"] = "line\u0000one\nline two"
				e["future"] = "a field this node does not know"
			}),
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	if repo.Name != "Community plugins" {
		t.Errorf("name %q", repo.Name)
	}
	if len(repo.Plugins) != 2 || skipped != 7 {
		t.Fatalf("kept %d, skipped %d; want 2 and 7", len(repo.Plugins), skipped)
	}

	second := repo.Plugins[1]
	if second.Icon != "" || second.Lang != "" || second.Description != "line one line two" {
		t.Fatalf("second entry %+v", second)
	}
}

func TestRefusesWhatIsNotARepository(t *testing.T) {
	for name, raw := range map[string]string{
		"not JSON":           `<html>`,
		"no plugins":         `{"name": "x"}`,
		"plugins not a list": `{"plugins": {"a": 1}}`,
		"too large":          `{"plugins": [` + strings.Repeat(" ", MaxSize) + `]}`,
		"too many": func() string {
			items := make([]string, MaxEntries+1)
			for i := range items {
				items[i] = "{}"
			}
			return fmt.Sprintf(`{"plugins": [%s]}`, strings.Join(items, ","))
		}(),
	} {
		t.Run(name, func(t *testing.T) {
			if _, _, err := Parse([]byte(raw)); err == nil {
				t.Fatal("accepted")
			}
		})
	}
}

func TestLongTextIsCut(t *testing.T) {
	repo, _, err := parse(t, map[string]any{
		"plugins": []any{entry(func(e map[string]any) { e["description"] = strings.Repeat("я", 1000) })},
	})
	if err != nil {
		t.Fatal(err)
	}

	if got := []rune(repo.Plugins[0].Description); len(got) != maxDescription {
		t.Fatalf("description of %d characters", len(got))
	}
}
