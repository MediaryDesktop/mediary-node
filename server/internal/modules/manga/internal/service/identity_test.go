package service

import "testing"

func TestAnOPDSChapterIsNamedTheSameOnEveryComputer(t *testing.T) {
	const template = "/api/v1/books/0F3/pages/{pageNumber}"
	want := "opds-url:https://komga.example:25600/opds#" + template

	for _, address := range []string{
		"https://komga.example:25600/opds",
		"https://komga.example:25600/opds/",
		"HTTPS://Komga.Example:25600/opds",
		"https://reader:s3cret@komga.example:25600/opds",
	} {
		if got := opdsIdentity(address, template); got != want {
			t.Errorf("%s: %s, want %s", address, got, want)
		}
	}
}
