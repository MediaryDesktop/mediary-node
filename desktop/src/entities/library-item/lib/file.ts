import { formatDuration } from '@shared/lib'

import type { LibraryFile } from '../api/api'

export function isMatched(file: LibraryFile): boolean {
	return file.match !== undefined && file.match !== null
}

// An opening or a trailer belongs to no episode, so the node never matches it and
// the library does not offer to.
export function isIgnored(file: LibraryFile): boolean {
	return file.ignored
}

export function isTrackable(file: LibraryFile): boolean {
	return file.parsed.form !== 'extra'
}

export function fileTitle(file: LibraryFile): string {
	const parsed = file.parsed.title?.trim()

	return parsed && parsed !== '' ? parsed : file.rel_path
}

// The file's own name, which is what a row about a file should say. rel_path is
// the whole path under the root, and a list of episodes repeats the folder part
// of it on every line for nothing.
export function fileName(file: LibraryFile): string {
	const parts = file.rel_path.split('/')

	return parts[parts.length - 1] || file.rel_path
}

export function fileNumber(file: LibraryFile): number | null {
	return file.parsed.episode ?? file.parsed.chapter ?? null
}

// Which season the file belongs to. The match is asked first because it is what
// the user or the matcher settled on; the name is what the scan read off the file
// itself, which for "s02e01_720.mp4" already says season two.
export function fileSeason(file: LibraryFile): number | null {
	return file.match?.season ?? file.parsed.season ?? null
}

// How long the file runs, as the scan read it out of the container. A container
// the node cannot read leaves this empty, and the row simply shows no time.
export function fileDuration(file: LibraryFile): string | null {
	return file.duration_seconds ? formatDuration(file.duration_seconds) : null
}
