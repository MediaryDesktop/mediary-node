import { formatDuration } from '@shared/lib'

import type { LibraryFile } from '../api/api'

export function isMatched(file: LibraryFile): boolean {
	return file.match !== undefined && file.match !== null
}

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

export function fileName(file: LibraryFile): string {
	const parts = file.rel_path.split('/')

	return parts[parts.length - 1] || file.rel_path
}

export function fileNumber(file: LibraryFile): number | null {
	return file.parsed.episode ?? file.parsed.chapter ?? null
}

export function fileSeason(file: LibraryFile): number | null {
	return file.match?.season ?? file.parsed.season ?? null
}

export function fileDuration(file: LibraryFile): string | null {
	return file.duration_seconds ? formatDuration(file.duration_seconds) : null
}
