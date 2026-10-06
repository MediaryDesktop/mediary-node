package metainfo

import (
	"crypto/sha1" //nolint:gosec // The hash under test.
	"encoding/hex"
	"testing"

	"github.com/mediaryorg/mediary-node/server/internal/platform/apperr"
)

func TestMagnetWithAHexHash(t *testing.T) {
	info, err := FromMagnet("magnet:?xt=urn:btih:3D686DBC956D6D31534B428C40F28999B6531640&dn=Tensei+Kizoku&tr=http://tr.libria.fun:2710/announce")
	if err != nil {
		t.Fatal(err)
	}
	if info.InfoHash != "3d686dbc956d6d31534b428c40f28999b6531640" || info.Name != "Tensei Kizoku" {
		t.Fatalf("info = %+v", info)
	}
}

func TestMagnetWithABase32Hash(t *testing.T) {
	// The same hash as above, in the base32 form older clients write.
	info, err := FromMagnet("magnet:?xt=urn:btih:HVUG3PEVNVWTCU2LIKGEB4UJTG3FGFSA")
	if err != nil {
		t.Fatal(err)
	}
	if info.InfoHash != "3d686dbc956d6d31534b428c40f28999b6531640" {
		t.Fatalf("hash = %s", info.InfoHash)
	}
}

func TestMagnetsTheNodeCannotUse(t *testing.T) {
	for _, raw := range []string{
		"",
		"https://example.com/file.torrent",
		"magnet:?dn=no-hash",
		"magnet:?xt=urn:btmh:1220abcdef",
		"magnet:?xt=urn:btih:nothex",
	} {
		if _, err := FromMagnet(raw); apperr.KindOf(err) != apperr.KindInvalid {
			t.Errorf("FromMagnet(%q) = %v, want invalid", raw, err)
		}
	}
}

func TestTorrentFileHashesItsInfoDictionary(t *testing.T) {
	info := "d6:lengthi12e4:name13:Frieren 01.mk12:piece lengthi16384e6:pieces20:aaaaaaaaaaaaaaaaaaaae"
	file := "d8:announce20:http://tracker/annou4:info" + info + "e"

	got, err := FromTorrent([]byte(file))
	if err != nil {
		t.Fatal(err)
	}

	sum := sha1.Sum([]byte(info)) //nolint:gosec // See the import.
	if got.InfoHash != hex.EncodeToString(sum[:]) {
		t.Fatalf("hash = %s, want the SHA-1 of the info dictionary as written", got.InfoHash)
	}
	if got.Name != "Frieren 01.mk" {
		t.Fatalf("name = %q", got.Name)
	}
}

func TestFilesThatAreNotTorrents(t *testing.T) {
	for _, raw := range []string{
		"",
		"not bencode",
		"d8:announce3:urle",
		"d4:infoli1eee",
		"d4:info",
		"d4:infod4:name99:shorte",
	} {
		if _, err := FromTorrent([]byte(raw)); apperr.KindOf(err) != apperr.KindInvalid {
			t.Errorf("FromTorrent(%q) = %v, want invalid", raw, err)
		}
	}
}
