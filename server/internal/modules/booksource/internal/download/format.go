package download

import (
	"bytes"
	"errors"
	"fmt"
)

// Extensions are the book files the library keeps and the reader opens. DJVU is
// left out: no source offers it, and the reader cannot open it yet.
var Extensions = map[string]bool{
	".epub": true,
	".pdf":  true,
	".mobi": true,
	".azw3": true,
	".fb2":  true,
}

// sniffBytes is how much of a file is looked at to tell what it is.
const sniffBytes = 1024

var errNotABook = errors.New("the file is not the book format it claims to be")

// checkSignature says whether the start of a file is what its extension
// promises, so a login page or an error page saved as .epub never joins the
// library.
func checkSignature(ext string, head []byte) error {
	var ok bool

	switch ext {
	case ".epub":
		ok = bytes.HasPrefix(head, []byte("PK\x03\x04"))
	case ".pdf":
		ok = bytes.HasPrefix(head, []byte("%PDF-"))
	case ".mobi", ".azw3":
		// A Palm database: the type and creator sit at byte 60.
		ok = len(head) >= 68 && string(head[60:68]) == "BOOKMOBI"
	case ".fb2":
		ok = bytes.Contains(head, []byte("<FictionBook"))
	default:
		return fmt.Errorf("%s is not a book format the library keeps", ext)
	}

	if !ok {
		return fmt.Errorf("%w (%s)", errNotABook, ext)
	}

	return nil
}
