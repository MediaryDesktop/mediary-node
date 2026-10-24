package manifest

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func readExample(t *testing.T) []byte {
	t.Helper()

	raw, err := os.ReadFile(filepath.Join("testdata", "example", "manifest.json"))
	if err != nil {
		t.Fatal(err)
	}

	return raw
}

// The example the sandbox tests run has to stay a valid plugin, its code
// matching the sum its manifest pins.
func TestExampleIsValid(t *testing.T) {
	m, err := Parse(readExample(t))
	if err != nil {
		t.Fatal(err)
	}

	code, err := os.ReadFile(filepath.Join("testdata", "example", "plugin.js"))
	if err != nil {
		t.Fatal(err)
	}

	sum := sha256.Sum256(code)
	if got := hex.EncodeToString(sum[:]); got != m.SHA256 {
		t.Fatalf("plugin.js hashes to %s, the manifest pins %s", got, m.SHA256)
	}
}

// The manga example too: a valid manga provider whose code matches its sum.
func TestMangaExampleIsValid(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("testdata", "manga-example", "manifest.json"))
	if err != nil {
		t.Fatal(err)
	}

	m, err := Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	if m.Type != TypeMangaProvider {
		t.Fatalf("type = %q", m.Type)
	}

	code, err := os.ReadFile(filepath.Join("testdata", "manga-example", "plugin.js"))
	if err != nil {
		t.Fatal(err)
	}

	sum := sha256.Sum256(code)
	if got := hex.EncodeToString(sum[:]); got != m.SHA256 {
		t.Fatalf("plugin.js hashes to %s, the manifest pins %s", got, m.SHA256)
	}
}

// edit parses the example, changes it and validates it again.
func edit(t *testing.T, change func(m map[string]any)) error {
	t.Helper()

	var m map[string]any
	if err := json.Unmarshal(readExample(t), &m); err != nil {
		t.Fatal(err)
	}

	change(m)

	raw, err := json.Marshal(m)
	if err != nil {
		t.Fatal(err)
	}

	_, err = Parse(raw)

	return err
}

func TestRefusesWhatTheUserCouldNotAgreeTo(t *testing.T) {
	cases := map[string]struct {
		change func(m map[string]any)
		says   string
	}{
		"every site":            {func(m map[string]any) { m["network"] = []string{"*"} }, "every site"},
		"wildcard mid-name":     {func(m map[string]any) { m["network"] = []string{"tracker.*.org"} }, "wildcard"},
		"IPv4 address":          {func(m map[string]any) { m["network"] = []string{"192.168.1.1"} }, "IP address"},
		"loopback":              {func(m map[string]any) { m["network"] = []string{"127.0.0.1"} }, "IP address"},
		"IPv6 address":          {func(m map[string]any) { m["network"] = []string{"[::1]"} }, "IP address"},
		"short IPv4":            {func(m map[string]any) { m["network"] = []string{"127.1"} }, "IP address"},
		"single label":          {func(m map[string]any) { m["network"] = []string{"localhost"} }, "host name"},
		"with a scheme":         {func(m map[string]any) { m["network"] = []string{"https://tracker.example.org"} }, "host name"},
		"with a port":           {func(m map[string]any) { m["network"] = []string{"tracker.example.org:8080"} }, "host name"},
		"with a path":           {func(m map[string]any) { m["network"] = []string{"tracker.example.org/api"} }, "host name"},
		"uppercase":             {func(m map[string]any) { m["network"] = []string{"Tracker.example.org"} }, "lowercase"},
		"the same host twice":   {func(m map[string]any) { m["network"] = []string{"a.example.org", "a.example.org"} }, "twice"},
		"unknown type":          {func(m map[string]any) { m["type"] = "plugin" }, "type"},
		"code over http":        {func(m map[string]any) { m["payload"] = "http://plugins.example.org/plugin.js" }, "https"},
		"code from a file":      {func(m map[string]any) { m["payload"] = "file:///C:/plugin.js" }, "https"},
		"no sum":                {func(m map[string]any) { delete(m, "sha256") }, "sha256"},
		"uppercase sum":         {func(m map[string]any) { m["sha256"] = strings.ToUpper(m["sha256"].(string)) }, "sha256"},
		"bad id":                {func(m map[string]any) { m["id"] = "Example Tracker" }, "id"},
		"not semver":            {func(m map[string]any) { m["version"] = "1.0" }, "version"},
		"unknown field":         {func(m map[string]any) { m["permissions"] = []string{"filesystem"} }, "unknown field"},
		"secret select":         {func(m map[string]any) { m["config"].([]any)[0].(map[string]any)["secret"] = true }, "only a text field"},
		"default not an option": {func(m map[string]any) { m["config"].([]any)[0].(map[string]any)["default"] = "elsewhere.org" }, "not one of the options"},
		"secret with a default": {func(m map[string]any) { m["config"].([]any)[1].(map[string]any)["default"] = "abc" }, "no default"},
		"user in the payload":   {func(m map[string]any) { m["payload"] = "https://me:pw@plugins.example.org/p.js" }, "user name"},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			err := edit(t, tc.change)
			if err == nil {
				t.Fatal("accepted")
			}
			if !strings.Contains(err.Error(), tc.says) {
				t.Fatalf("%v; want it to mention %q", err, tc.says)
			}
		})
	}
}

func TestNoNetworkIsAllowed(t *testing.T) {
	if err := edit(t, func(m map[string]any) { m["network"] = []string{} }); err != nil {
		t.Fatalf("a plugin that reaches nothing: %v", err)
	}
}

func TestListsEveryProblemAtOnce(t *testing.T) {
	err := edit(t, func(m map[string]any) {
		m["id"] = "X"
		m["version"] = "one"
		m["network"] = []string{"*"}
	})

	var invalid *InvalidError
	if !errors.As(err, &invalid) || len(invalid.Problems) != 3 {
		t.Fatalf("%v; want three problems", err)
	}
}

func TestRefusesTooLarge(t *testing.T) {
	if _, err := Parse(make([]byte, MaxSize+1)); err == nil || !strings.Contains(err.Error(), "larger") {
		t.Fatalf("%v; want it refused for its size", err)
	}
}

func TestRefusesTwoValues(t *testing.T) {
	raw := append(readExample(t), []byte(`{"id":"second"}`)...)
	if _, err := Parse(raw); err == nil {
		t.Fatal("accepted a manifest followed by another JSON value")
	}
}
