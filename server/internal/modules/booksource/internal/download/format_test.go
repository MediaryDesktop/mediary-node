package download

import (
	"strings"
	"testing"
)

func mobi() []byte {
	head := make([]byte, 80)
	copy(head[60:], "BOOKMOBI")

	return head
}

func TestCheckSignature(t *testing.T) {
	for _, tc := range []struct {
		ext  string
		head []byte
		ok   bool
	}{
		{".epub", []byte("PK\x03\x04mimetype"), true},
		{".epub", []byte("<!DOCTYPE html><html>Log in"), false},
		{".pdf", []byte("%PDF-1.7\n"), true},
		{".pdf", []byte("PK\x03\x04"), false},
		{".mobi", mobi(), true},
		{".azw3", mobi(), true},
		{".mobi", []byte("BOOKMOBI"), false},
		{".fb2", []byte("\xef\xbb\xbf<?xml version=\"1.0\"?>\n<FictionBook xmlns=\"http://www.gribuser.ru/xml/fictionbook/2.0\">"), true},
		{".fb2", []byte("<html>"), false},
		{".epub", nil, false},
		{".djvu", []byte("AT&TFORM"), false},
	} {
		err := checkSignature(tc.ext, tc.head)
		if (err == nil) != tc.ok {
			t.Errorf("%s %q: err = %v, want ok = %v", tc.ext, strings.ToValidUTF8(string(tc.head), "?"), err, tc.ok)
		}
	}
}
