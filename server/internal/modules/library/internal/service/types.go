package service

import "time"

type Root struct {
	ID      int64     `json:"id" doc:"Identifier of the root, stable across scans."`
	Path    string    `json:"path" doc:"Absolute path on this machine."`
	AddedAt time.Time `json:"added_at" doc:"When the user added the root."`

	LastScanAt *time.Time `json:"last_scan_at,omitempty" doc:"When the root was last walked. Absent until the first scan."`

	FileCount    int `json:"file_count" doc:"Media files currently present under the root."`
	MissingCount int `json:"missing_count" doc:"Files the last scan did not find. Their matches are kept in case the drive comes back."`
}

type Match struct {
	MediaRef   string  `json:"media_ref" doc:"The title this file belongs to, as provider:id."`
	Season     *int    `json:"season,omitempty" doc:"Season number, when the title has seasons."`
	Episode    *int    `json:"episode,omitempty" doc:"Episode or chapter number within the title."`
	Confidence float64 `json:"confidence" doc:"How sure the matcher was, from 0 to 1. A manual match is always 1."`
	Source     string  `json:"source" enum:"auto,manual" doc:"Who decided the match. A manual one is never overwritten by a scan."`
}

// Parsed is what the file's name says on its own, before any source is asked.
// It is what an unmatched file is shown as, and what the matcher searches with.
type Parsed struct {
	Form  string `json:"form,omitempty" enum:"series,movie,special,extra,manga,book" doc:"What the name says the file holds. An extra — an opening, an ending, a trailer — is never tracked as an episode."`
	Title string `json:"title,omitempty" doc:"Title read from the file name, or from the closest folder that names one."`

	Year    *int `json:"year,omitempty" doc:"Year found in the name."`
	Season  *int `json:"season,omitempty" doc:"Season found in the name or on a folder."`
	Episode *int `json:"episode,omitempty" doc:"Episode number found in the name."`
	Chapter *int `json:"chapter,omitempty" doc:"Chapter number, for comics."`
	Volume  *int `json:"volume,omitempty" doc:"Volume number, for comics."`
}

type File struct {
	ID      int64  `json:"id" doc:"Identifier of the file, stable while its path does not change."`
	RootID  int64  `json:"root_id" doc:"Root the file was found under."`
	Path    string `json:"path" doc:"Absolute path, for the player and for revealing the file."`
	RelPath string `json:"rel_path" doc:"Path relative to the root, with forward slashes."`
	Kind    string `json:"kind" enum:"video,manga,book" doc:"Form of media the extension points at."`

	SizeBytes  int64     `json:"size_bytes" doc:"Size on disk."`
	ModifiedAt time.Time `json:"modified_at" doc:"Modification time the last scan saw."`

	Missing bool   `json:"missing" doc:"True when the last scan did not find the file where it used to be."`
	Parsed  Parsed `json:"parsed" doc:"What the file's name says. Present whether or not the file is matched."`
	Match   *Match `json:"match,omitempty" doc:"What the file was matched to. Absent while unmatched."`
}

type FilePage struct {
	Items  []File `json:"items" doc:"One page of files."`
	Total  int    `json:"total" doc:"How many files match the filter in total."`
	Limit  int    `json:"limit" doc:"Page size that was applied."`
	Offset int    `json:"offset" doc:"Offset that was applied."`
}

type ScanRootResult struct {
	RootID int64  `json:"root_id" doc:"Root this result belongs to."`
	Path   string `json:"path" doc:"Absolute path of the root."`

	Found    int `json:"found" doc:"Media files seen on disk."`
	Added    int `json:"added" doc:"Files recorded for the first time."`
	Changed  int `json:"changed" doc:"Known files whose size or modification time moved."`
	Reparsed int `json:"reparsed" doc:"Untouched files whose names a newer parser read again."`
	Missing  int `json:"missing" doc:"Files that were recorded before and are gone now."`

	Error string `json:"error,omitempty" doc:"Why this root could not be scanned. The other roots are still scanned."`
}

// ScanStatus is the node's single scan slot: one scan runs at a time, and its
// result stays readable until the next one starts. The desktop reads it once on
// mount and follows the library.scan events after that.
type ScanStatus struct {
	Running bool `json:"running" doc:"True while a scan is walking the filesystem."`

	StartedAt  *time.Time `json:"started_at,omitempty" doc:"When the current or last scan started."`
	FinishedAt *time.Time `json:"finished_at,omitempty" doc:"When the last scan finished. Absent while one is running."`

	Roots []ScanRootResult `json:"roots" doc:"Per-root outcome of the current or last scan."`

	Found    int `json:"found" doc:"Media files seen on disk across all scanned roots."`
	Added    int `json:"added" doc:"Files recorded for the first time."`
	Changed  int `json:"changed" doc:"Known files whose size or modification time moved."`
	Reparsed int `json:"reparsed" doc:"Untouched files whose names a newer parser read again."`
	Missing  int `json:"missing" doc:"Files that were recorded before and are gone now."`

	Considered int `json:"considered" doc:"Unmatched files the scan tried to match, including ones left over from earlier scans."`
	Matched    int `json:"matched" doc:"Files matched to a title without asking the user. The rest keep their suggestions for confirmation."`
}
