// Package classicio makes anacrolix/torrent read and write files the classic way
// rather than through memory maps. Its mapped files are never unmapped: on
// Windows a torrent's files could then never be deleted, and every file a node
// ever downloaded would stay mapped for as long as it runs.
//
// The library reads the choice from the environment once, while it initialises,
// so this has to run first. Go initialises packages in import-path order once
// their own imports are done; this one imports only os, and the library's storage
// imports packages that sort after it (github.com/mr-tron/…), so this package is
// always initialised before the library's storage. client_test.go fails if not.
package classicio

import "os"

func init() {
	if _, set := os.LookupEnv("TORRENT_STORAGE_DEFAULT_FILE_IO"); !set {
		_ = os.Setenv("TORRENT_STORAGE_DEFAULT_FILE_IO", "classic")
	}
}
