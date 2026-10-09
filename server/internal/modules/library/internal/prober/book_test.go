package prober

import (
	"archive/zip"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/text/encoding/charmap"
)

func writeEPUB(t *testing.T, path, opf string) {
	t.Helper()

	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = file.Close() }()

	archive := zip.NewWriter(file)

	for name, body := range map[string]string{
		"mimetype":               "application/epub+zip",
		"META-INF/container.xml": `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
		"OEBPS/content.opf":      opf,
	} {
		entry, createErr := archive.Create(name)
		if createErr != nil {
			t.Fatal(createErr)
		}
		if _, writeErr := entry.Write([]byte(body)); writeErr != nil {
			t.Fatal(writeErr)
		}
	}

	if err := archive.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestAnEPUBSaysWhatItIs(t *testing.T) {
	path := filepath.Join(t.TempDir(), "whatever.epub")

	writeEPUB(t, path, `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:0d3c8f6e-1111-2222-3333-444455556666</dc:identifier>
    <dc:identifier>urn:isbn:978-0-441-17271-9</dc:identifier>
    <dc:title>  Dune </dc:title>
    <dc:creator>Frank   Herbert</dc:creator>
    <dc:language>en</dc:language>
  </metadata>
</package>`)

	info, ok := Book(path)
	if !ok {
		t.Fatal("the EPUB was not read")
	}

	if info.Title != "Dune" || strings.Join(info.Authors, "|") != "Frank Herbert" || info.ISBN != "9780441172719" {
		t.Fatalf("info %+v: the UUID is not an ISBN", info)
	}
}

func TestAnFB2SaysWhatItIsInEitherCharset(t *testing.T) {
	const header = `<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description>
  <title-info><author><first-name>Михаил</first-name><middle-name>Афанасьевич</middle-name><last-name>Булгаков</last-name></author>
  <book-title>Мастер и Маргарита</book-title></title-info>
  <publish-info><isbn>5-17-012345-6</isbn></publish-info>
</description><body><p>…</p></body></FictionBook>`

	dir := t.TempDir()

	utf8 := filepath.Join(dir, "a.fb2")
	if err := os.WriteFile(utf8, []byte(`<?xml version="1.0" encoding="utf-8"?>`+header), 0o600); err != nil {
		t.Fatal(err)
	}

	cp1251, err := charmap.Windows1251.NewEncoder().String(`<?xml version="1.0" encoding="windows-1251"?>` + header)
	if err != nil {
		t.Fatal(err)
	}
	windows := filepath.Join(dir, "b.fb2")
	if err := os.WriteFile(windows, []byte(cp1251), 0o600); err != nil {
		t.Fatal(err)
	}

	for _, path := range []string{utf8, windows} {
		info, ok := Book(path)
		if !ok || info.Title != "Мастер и Маргарита" || strings.Join(info.Authors, "|") != "Михаил Афанасьевич Булгаков" || info.ISBN != "5170123456" {
			t.Errorf("%s: %+v %v", filepath.Base(path), info, ok)
		}
	}
}

func TestFormatsWithoutMetadataAreLeftToTheirNames(t *testing.T) {
	dir := t.TempDir()

	pdf := filepath.Join(dir, "book.pdf")
	if err := os.WriteFile(pdf, []byte("%PDF-1.7"), 0o600); err != nil {
		t.Fatal(err)
	}

	broken := filepath.Join(dir, "broken.epub")
	if err := os.WriteFile(broken, []byte("not a zip"), 0o600); err != nil {
		t.Fatal(err)
	}

	for _, path := range []string{pdf, broken, filepath.Join(dir, "missing.fb2")} {
		if _, ok := Book(path); ok {
			t.Errorf("%s must not be read", filepath.Base(path))
		}
	}
}

func TestISBNOf(t *testing.T) {
	cases := []struct {
		raw      string
		declared bool
		want     string
	}{
		{"urn:isbn:9780441172719", false, "9780441172719"},
		{"ISBN: 0-441-17271-7", false, "0441172717"},
		{"978 0 441 17271 9", true, "9780441172719"},
		{"0-8044-2957-X", true, "080442957X"},
		{"9780441172719", false, ""},
		{"urn:uuid:0d3c8f6e", false, ""},
		{"12345", true, ""},
	}

	for _, c := range cases {
		if got := isbnOf(c.raw, c.declared); got != c.want {
			t.Errorf("isbnOf(%q, %v) = %q, want %q", c.raw, c.declared, got, c.want)
		}
	}
}
