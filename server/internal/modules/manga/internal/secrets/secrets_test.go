package secrets

import (
	"path/filepath"
	"testing"
)

func TestPasswordsSurviveANewStore(t *testing.T) {
	path := filepath.Join(t.TempDir(), "opds-secrets.json")

	first := New(path)
	if err := first.SetPassword(3, "secret"); err != nil {
		t.Fatal(err)
	}
	if err := first.SetPassword(4, "other"); err != nil {
		t.Fatal(err)
	}

	second := New(path)
	if got, err := second.Password(3); err != nil || got != "secret" {
		t.Errorf("Password(3) = %q, %v", got, err)
	}

	if err := second.SetPassword(3, ""); err != nil {
		t.Fatal(err)
	}
	if got, _ := New(path).Password(3); got != "" {
		t.Errorf("cleared password = %q", got)
	}
	if got, _ := New(path).Password(4); got != "other" {
		t.Errorf("untouched password = %q", got)
	}
}

func TestNoFileMeansNoPasswords(t *testing.T) {
	if got, err := New(filepath.Join(t.TempDir(), "missing.json")).Password(1); err != nil || got != "" {
		t.Errorf("Password = %q, %v", got, err)
	}
}
